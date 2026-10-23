/**
 * Music Bot — src/player/GuildPlayer.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
import { setTimeout as sleep } from 'node:timers/promises';
import {
  AudioPlayerStatus,
  createAudioPlayer,
  entersState,
  NoSubscriberBehavior,
  VoiceConnectionDisconnectReason,
  VoiceConnectionStatus,
} from '@discordjs/voice';
import { config } from '../config.js';
import { logger } from '../logger.js';
import { getLyricsForTrack } from '../lyrics/service.js';
import { ensurePlayable } from '../sources/resolver.js';
import { getStreamInfo } from '../sources/ytdlp.js';
import { toUserError, UserError } from '../util/errors.js';
import { escapeMd, truncate } from '../util/format.js';
import { createStream, describeStreamFailure, FILTERS, isNoAudio } from './stream.js';
import { enrichTrack } from './track.js';

export const PlayerState = Object.freeze({
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  IDLE: 'idle',
  LOADING: 'loading',
  PLAYING: 'playing',
  PAUSED: 'paused',
  RECONNECTING: 'reconnecting',
});

const S = PlayerState;

/** Allowed transitions. Anything else is a bug and gets logged + refused. */
export const TRANSITIONS = Object.freeze({
  [S.DISCONNECTED]: [S.CONNECTING],
  [S.CONNECTING]: [S.IDLE, S.LOADING, S.DISCONNECTED],
  [S.IDLE]: [S.LOADING, S.RECONNECTING, S.DISCONNECTED],
  [S.LOADING]: [S.LOADING, S.PLAYING, S.IDLE, S.RECONNECTING, S.DISCONNECTED],
  [S.PLAYING]: [S.PAUSED, S.LOADING, S.IDLE, S.RECONNECTING, S.DISCONNECTED],
  [S.PAUSED]: [S.PLAYING, S.LOADING, S.IDLE, S.RECONNECTING, S.DISCONNECTED],
  [S.RECONNECTING]: [S.IDLE, S.LOADING, S.PLAYING, S.PAUSED, S.DISCONNECTED],
});

export const LOOP_MODES = ['off', 'track', 'queue'];
const STREAM_INFO_TTL_MS = 20 * 60_000;
const MAX_FAIL_STREAK = 5;
const MAX_STREAM_RETRIES = 2;
const MAX_RECONNECTS = 5;
const HISTORY_SIZE = 50;

export class GuildPlayer {
  queue = [];
  history = [];
  current = null;
  loop = 'off';
  filters = [];
  state = S.DISCONNECTED;
  connection = null;
  stream = null;
  voiceChannelId = null;
  textChannelId = null;
  /** Live lyrics on the now-playing card; the offset belongs to `offsetUserId`. */
  lyricsLive = { enabled: false, offsetMs: 0, offsetUserId: null };

  #loadToken = 0;
  #loading = false;
  #failStreak = 0;
  #streamRetries = 0;
  #reconnectAttempts = 0;
  #stateBeforeReconnect = null;
  #positionBeforeReconnect = 0;
  #leaving = false;
  #destroyed = false;
  #autoPaused = false;
  #pendingRestart = false;
  #timers = { empty: null, idle: null, progress: null, npDebounce: null, lyrics: null };
  #npMessage = null;
  #npChain = Promise.resolve();
  #npPending = null;
  #npBusy = false;
  #lastNpEdit = 0;
  #lyricsKey = null;
  #notice = null;

  constructor({ guildId, manager }) {
    this.guildId = guildId;
    this.manager = manager;
    this.log = logger.child({ guild: guildId });
    this.volume = manager.store.getSettings(guildId).volume;
    this.audio = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Pause } });
    this.audio.on('stateChange', (oldState, newState) => this.#onAudioState(oldState, newState));
    this.audio.on('error', (err) => this.log.warn({ err: err.message }, 'audio resource error'));
  }

  // ------------------------------------------------------------------ state

  #transition(to, why) {
    const from = this.state;
    if (from === to) return true;
    if (!TRANSITIONS[from]?.includes(to)) {
      this.log.error({ from, to, why }, 'refused illegal player transition');
      return false;
    }
    this.state = to;
    this.log.debug({ from, to, why }, 'player state');
    this.#syncProgressTimer();
    return true;
  }

  get position() {
    if (this.stream) return this.stream.position();
    if (this.state === S.RECONNECTING) return this.#positionBeforeReconnect;
    return 0;
  }

  get isActive() {
    return Boolean(this.current) || this.#loading;
  }

  get settings() {
    return this.manager.store.getSettings(this.guildId);
  }

  // ------------------------------------------------------------------ voice

  async connect(voiceChannel) {
    const conn = this.connection;
    if (conn && conn.state.status !== VoiceConnectionStatus.Destroyed && conn.joinConfig.channelId === voiceChannel.id) return;

    const moving = Boolean(conn) && conn.state.status !== VoiceConnectionStatus.Destroyed;
    if (!moving) this.#transition(S.CONNECTING, 'connect');
    this.#leaving = false;

    const connection = this.manager.joinVoice({ guildId: this.guildId, channelId: voiceChannel.id });
    if (!moving) {
      this.connection = connection;
      connection.on('stateChange', (o, n) => {
        this.#onConnectionState(connection, o, n).catch((err) => this.log.error({ err }, 'connection handler failed'));
      });
      connection.on('error', (err) => this.log.warn({ err: err.message }, 'voice connection error'));
      connection.subscribe(this.audio);
    }

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
    } catch (err) {
      if (!moving) {
        this.#leaving = true;
        try { connection.destroy(); } catch { /* already gone */ }
        this.connection = null;
        this.#transition(S.DISCONNECTED, 'connect failed');
        this.#leaving = false;
      }
      throw new UserError(`I couldn't join <#${voiceChannel.id}>.`, {
        hint: 'Check that I have **Connect** and **Speak** there and that the channel isn\'t full.',
        code: 'VOICE_JOIN_FAILED',
        cause: err,
      });
    }

    this.voiceChannelId = voiceChannel.id;
    this.manager.store.updateSettings(this.guildId, { lastVoiceChannelId: voiceChannel.id });
    if (this.state === S.CONNECTING) this.#transition(S.IDLE, 'connected');
    this.checkAlone();
  }

  async #onConnectionState(connection, oldState, newState) {
    if (connection !== this.connection) return;
    const Status = VoiceConnectionStatus;

    if (newState.status === Status.Disconnected) {
      if (this.#leaving) return;
      if (newState.reason === VoiceConnectionDisconnectReason.WebSocketClose && newState.closeCode === 4014) {
        // 4014 = moved to another channel (Discord reconnects us) or kicked (it won't).
        try {
          await entersState(connection, Status.Connecting, 5_000);
        } catch {
          if (connection.state.status !== Status.Destroyed) {
            await this.destroy({ announce: '👋 I was disconnected from the voice channel.' });
          }
        }
        return;
      }
      if (this.#reconnectAttempts >= MAX_RECONNECTS) {
        await this.destroy({ announce: '⚠️ Lost the voice connection and could not get it back. Use `/play` to start again.' });
        return;
      }
      this.#enterReconnecting();
      this.#reconnectAttempts++;
      await sleep(this.#reconnectAttempts * 2_000);
      if (connection.state.status === Status.Disconnected && !this.#leaving) {
        this.log.info({ attempt: this.#reconnectAttempts }, 'rejoining voice');
        connection.rejoin();
      }
      return;
    }

    if (newState.status === Status.Ready) {
      this.#reconnectAttempts = 0;
      if (connection.joinConfig.channelId) this.voiceChannelId = connection.joinConfig.channelId;
      if (this.state === S.RECONNECTING) this.#leaveReconnecting();
      return;
    }

    if (newState.status === Status.Destroyed && !this.#leaving) {
      await this.destroy({});
    }
  }

  #enterReconnecting() {
    if (this.state === S.RECONNECTING || this.state === S.DISCONNECTED || this.state === S.CONNECTING) return;
    this.#stateBeforeReconnect = this.state;
    this.#positionBeforeReconnect = this.position;
    this.#transition(S.RECONNECTING, 'voice dropped');
    this.refreshNowPlaying();
  }

  #leaveReconnecting() {
    const before = this.#stateBeforeReconnect;
    this.log.info({ before, position: this.#positionBeforeReconnect }, 'voice reconnected');
    if (this.#loading) {
      this.#transition(S.LOADING, 'reconnected while loading');
    } else if (this.current && !this.stream) {
      // The stream died while we were away: pick the track up where it was.
      void this.#start(this.current, this.#positionBeforeReconnect, { fresh: true, announce: false });
    } else if (this.stream) {
      this.#transition(before === S.PAUSED ? S.PAUSED : S.PLAYING, 'reconnected');
    } else {
      this.#transition(S.IDLE, 'reconnected idle');
    }
    this.refreshNowPlaying();
  }

  /** Pause when everyone leaves; leave after a grace period (unless 24/7 is on). */
  checkAlone() {
    const guild = this.manager.client?.guilds.cache.get(this.guildId);
    const channel = guild?.channels.cache.get(this.voiceChannelId);
    if (!channel) return;
    const humans = channel.members.filter((m) => !m.user.bot).size;
    const alwaysOn = this.settings.alwaysOn;

    if (humans === 0 && !alwaysOn) {
      if (this.#timers.empty) return;
      if (this.state === S.PLAYING) {
        this.audio.pause();
        this.#autoPaused = true;
        this.#transition(S.PAUSED, 'channel empty');
        this.refreshNowPlaying();
      }
      this.#timers.empty = setTimeout(() => {
        void this.destroy({ announce: '👋 Left the voice channel because everyone else left.' });
      }, config.leaveWhenEmptyAfterSec * 1000);
      this.log.info('voice channel empty, leave timer started');
    } else if (humans > 0) {
      if (this.#timers.empty) {
        clearTimeout(this.#timers.empty);
        this.#timers.empty = null;
        this.log.info('listener returned, leave timer cancelled');
      }
      if (this.#autoPaused && this.state === S.PAUSED) this.resume();
      this.#autoPaused = false;
    }
  }

  // ------------------------------------------------------------------ playback core

  #onAudioState(oldState, newState) {
    if (newState.status === AudioPlayerStatus.Playing && oldState.status !== AudioPlayerStatus.Playing) {
      if (this.state === S.LOADING) {
        this.#transition(S.PLAYING, 'audio started');
        this.#failStreak = 0;
        this.refreshNowPlaying();
        this.#prefetchNext();
      }
    } else if (newState.status === AudioPlayerStatus.Idle && oldState.status !== AudioPlayerStatus.Idle) {
      void this.#onResourceEnded(oldState.resource);
    }
  }

  async #onResourceEnded(resource) {
    const handle = this.stream;
    // Ignore resources we replaced on purpose (skip, seek, volume/filter restart).
    if (!handle || handle.resource !== resource) return;
    this.stream = null;
    const token = this.#loadToken;
    const track = this.current;
    const position = handle.position();
    const exit = await Promise.race([handle.exited, sleep(2_000).then(() => ({ code: null }))]);
    handle.kill();
    if (token !== this.#loadToken || !track) return;

    const endedEarly = position < 1
      || (exit.code !== 0 && exit.code !== null)
      || (!track.isLive && track.durationSec && position < track.durationSec - 5);

    if (endedEarly && this.state === S.RECONNECTING) return; // #leaveReconnecting restarts it
    if (endedEarly && this.#streamRetries < MAX_STREAM_RETRIES && !isNoAudio(handle.stderr())) {
      this.#streamRetries++;
      this.log.warn({ position, code: exit.code, stderr: handle.stderr().slice(-300), retry: this.#streamRetries }, 'stream ended early, resuming');
      // First retry reuses the (usually still valid) URL; the second re-resolves it.
      void this.#start(track, Math.max(0, position - 1), { fresh: this.#streamRetries > 1, announce: false });
      return;
    }
    if (endedEarly) {
      this.announce(`⚠️ Skipped **${escapeMd(truncate(track.title, 80))}**: ${describeStreamFailure(handle.stderr())}.`);
    }
    void this.advance();
  }

  async #getStreamInfo(track, fresh = false) {
    const cached = track.stream;
    if (!fresh && cached && Date.now() - cached.resolvedAt < STREAM_INFO_TTL_MS) return cached;
    const resolved = await getStreamInfo(track.url);
    enrichTrack(track, resolved.info);
    delete resolved.info;
    track.stream = resolved;
    return resolved;
  }

  #prefetchNext() {
    const next = this.loop === 'track' ? null : this.queue[0];
    if (!next || next.prefetching || (next.stream && Date.now() - next.stream.resolvedAt < STREAM_INFO_TTL_MS)) return;
    next.prefetching = true;
    ensurePlayable(next)
      .then(() => {
        if (this.lyricsLive.enabled) this.#loadLyrics(next);
        return this.#getStreamInfo(next);
      })
      .catch((err) => this.log.debug({ err: err.message }, 'prefetch failed (will retry at play time)'))
      .finally(() => { next.prefetching = false; });
  }

  /**
   * Load and play `track` from `seekSec`. Superseded loads (user skipped meanwhile) are
   * discarded via the load token. With `seamless`, the old audio keeps playing until the
   * replacement is ready (used for volume/filter changes).
   */
  async #start(track, seekSec = 0, { fresh = false, announce = true, seamless = false } = {}) {
    const token = ++this.#loadToken;
    this.#clearTimer('idle');
    this.current = track;
    if (announce) this.#streamRetries = 0;

    const previous = this.stream;
    this.stream = null;
    if (!seamless) {
      previous?.kill();
      this.audio.stop(true);
      this.#loading = true;
      this.#transition(S.LOADING, 'start');
    }
    if (announce) this.refreshNowPlaying({ newTrack: true });

    try {
      await ensurePlayable(track);
      if (this.lyricsLive.enabled) this.#loadLyrics(track);
      const streamInfo = await this.#getStreamInfo(track, fresh);
      const gate = streamInfo.availableAt - Date.now();
      if (gate > 0) await sleep(Math.min(gate + 250, 30_000));
      if (token !== this.#loadToken) return;
      const handle = createStream({
        streamInfo,
        pageUrl: track.url,
        seekSec,
        volume: this.volume,
        filters: this.filters,
        isLive: track.isLive,
        metadata: { trackId: track.id },
      });
      this.stream = handle;
      if (seamless) {
        // Keep the play/pause state; swap the resource under it.
        const wasPaused = this.state === S.PAUSED;
        this.audio.play(handle.resource);
        if (wasPaused) this.audio.pause();
        previous?.kill();
      } else {
        this.audio.play(handle.resource);
      }
      this.#loading = false;
      if (announce && seekSec === 0) {
        try {
          this.manager.store.addHistory(this.guildId, track.requester?.id, track);
        } catch (err) {
          this.log.warn({ err: err.message }, 'could not record history');
        }
      }
    } catch (err) {
      if (token !== this.#loadToken) return;
      this.#loading = false;
      if (seamless && previous) {
        // Keep playing the old stream rather than dropping audio.
        this.stream = previous;
        throw err;
      }
      this.#failStreak++;
      const ue = toUserError(err, 'Could not play that track.');
      this.log.warn({ code: ue.code, err: err.message, url: track.url, title: track.title }, 'track failed to load');
      this.announce(`⚠️ Skipped **${escapeMd(truncate(track.title, 80))}** — ${ue.message}${ue.hint ? `\n💡 ${ue.hint}` : ''}`);
      if (this.#failStreak >= MAX_FAIL_STREAK) {
        this.queue = [];
        this.current = null;
        this.#failStreak = 0;
        this.announce(`🛑 Stopped: ${MAX_FAIL_STREAK} tracks in a row failed to load. The source may be blocking the bot right now.`);
        this.#finishQueue();
        return;
      }
      this.current = null;
      await this.advance();
    }
  }

  async #restartAtPosition() {
    if (!this.current || !this.stream) return;
    if (this.state === S.PAUSED) {
      this.#pendingRestart = true;
      return;
    }
    await this.#start(this.current, this.position, { announce: false, seamless: true });
  }

  #finishQueue() {
    const previous = this.stream;
    this.stream = null;
    previous?.kill();
    this.audio.stop(true);
    this.current = null;
    this.#loading = false;
    if (this.state !== S.DISCONNECTED && this.state !== S.CONNECTING) this.#transition(S.IDLE, 'queue finished');
    this.refreshNowPlaying();
    if (!this.settings.alwaysOn) {
      this.#clearTimer('idle');
      this.#timers.idle = setTimeout(() => {
        void this.destroy({ announce: '👋 Left after being idle. Use `/play` to bring me back.' });
      }, config.leaveWhenIdleAfterSec * 1000);
    }
  }

  // ------------------------------------------------------------------ public controls

  /** Move to the next track according to loop mode. `skipped` ignores track-loop. */
  async advance({ skipped = false } = {}) {
    const prev = this.current;
    if (prev && !skipped && this.loop === 'track') return this.#start(prev, 0);
    if (prev) {
      this.history.push(prev);
      if (this.history.length > HISTORY_SIZE) this.history.shift();
      if (this.loop === 'queue') this.queue.push(prev);
    }
    this.current = null;
    const next = this.queue.shift();
    if (!next) return this.#finishQueue();
    return this.#start(next, 0);
  }

  /** Add tracks; starts playback if idle. Returns what happened for the reply. */
  enqueue(tracks, { next = false } = {}) {
    const room = Math.max(0, config.maxQueueSize - this.queue.length);
    const accepted = tracks.slice(0, room);
    const position = next ? 1 : this.queue.length + 1;
    if (next) this.queue.unshift(...accepted);
    else this.queue.push(...accepted);

    const startNow = accepted.length > 0 && !this.isActive && this.state !== S.DISCONNECTED;
    if (startNow) void this.advance();
    else if (accepted.length) {
      this.#prefetchNext();
      this.refreshNowPlaying();
    }
    return { added: accepted.length, dropped: tracks.length - accepted.length, startedPlaying: startNow, position };
  }

  #requireTrack() {
    if (!this.current) throw new UserError('Nothing is playing right now.', { hint: 'Start something with `/play`.', code: 'NOTHING_PLAYING' });
  }

  pause() {
    this.#requireTrack();
    if (this.state !== S.PLAYING) return this.state;
    this.audio.pause();
    this.#autoPaused = false;
    this.#transition(S.PAUSED, 'pause');
    this.refreshNowPlaying();
    return this.state;
  }

  resume() {
    this.#requireTrack();
    if (this.state !== S.PAUSED) return this.state;
    this.audio.unpause();
    this.#transition(S.PLAYING, 'resume');
    this.refreshNowPlaying();
    if (this.#pendingRestart) {
      this.#pendingRestart = false;
      void this.#restartAtPosition().catch((err) => this.log.warn({ err: err.message }, 'deferred restart failed'));
    }
    return this.state;
  }

  togglePause() {
    return this.state === S.PAUSED ? this.resume() : this.pause();
  }

  async skip() {
    this.#requireTrack();
    const skipped = this.current;
    await this.advance({ skipped: true });
    return skipped;
  }

  async previous() {
    if (!this.current && this.history.length === 0) {
      throw new UserError('There is no previous track.', { hint: 'Play something first.', code: 'NO_PREVIOUS' });
    }
    // Like most players: past 5 seconds, "previous" restarts the current track.
    if (this.current && (this.position > 5 || this.history.length === 0)) {
      return this.#start(this.current, 0, { announce: false });
    }
    const prev = this.history.pop();
    if (this.current) this.queue.unshift(this.current);
    this.current = null;
    return this.#start(prev, 0);
  }

  /** Clear everything; leave the channel unless 24/7 mode is on. */
  async stop({ by = null } = {}) {
    this.queue = [];
    this.#loadToken++;
    if (this.settings.alwaysOn) {
      this.#finishQueue();
      return 'idle';
    }
    await this.destroy({ final: by ? `Stopped by ${by}` : 'Stopped' });
    return 'left';
  }

  shuffle() {
    for (let i = this.queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.queue[i], this.queue[j]] = [this.queue[j], this.queue[i]];
    }
    this.refreshNowPlaying();
    return this.queue.length;
  }

  cycleLoop() {
    this.loop = LOOP_MODES[(LOOP_MODES.indexOf(this.loop) + 1) % LOOP_MODES.length];
    this.refreshNowPlaying();
    return this.loop;
  }

  async setVolume(volume) {
    this.volume = Math.max(0, Math.min(config.maxVolume, Math.round(volume)));
    this.refreshNowPlaying();
    await this.#restartAtPosition();
    return this.volume;
  }

  async setFilters(names) {
    if (this.current?.isLive && names.includes('nightcore')) {
      throw new UserError('Nightcore can\'t be used on a live stream.', { hint: 'Pick another filter.', code: 'FILTER_LIVE' });
    }
    this.filters = names.filter((n) => FILTERS[n]);
    this.refreshNowPlaying();
    await this.#restartAtPosition();
    return this.filters;
  }

  remove(index) {
    if (index < 0 || index >= this.queue.length) throw new UserError('There is no track at that position.', { code: 'BAD_INDEX' });
    const [removed] = this.queue.splice(index, 1);
    this.refreshNowPlaying();
    return removed;
  }

  clearQueue() {
    const count = this.queue.length;
    this.queue = [];
    this.refreshNowPlaying();
    return count;
  }

  // ------------------------------------------------------------------ lyrics

  /** Fetch lyrics in the background; playback never waits for this. */
  #loadLyrics(track) {
    if (!track || track.lyrics) return;
    track.lyrics = { status: 'loading' };
    getLyricsForTrack(track).then((result) => {
      track.lyrics = result;
      if (track === this.current && this.lyricsLive.enabled) this.refreshNowPlaying();
    });
  }

  /** Lyrics for the current track (loads them if needed). */
  async lyricsForCurrent() {
    const track = this.current;
    if (!track) return null;
    if (!track.lyrics || track.lyrics.status === 'loading') track.lyrics = await getLyricsForTrack(track);
    return track.lyrics;
  }

  setLyricsLive(enabled, userId) {
    this.lyricsLive.enabled = enabled;
    if (enabled) {
      this.lyricsLive.offsetMs = this.manager.store.getLyricsOffset(userId);
      this.lyricsLive.offsetUserId = userId;
      this.#loadLyrics(this.current);
      if (this.queue[0]) this.#loadLyrics(this.queue[0]);
    }
    this.#lyricsKey = null;
    this.#syncProgressTimer();
    this.refreshNowPlaying();
    return enabled;
  }

  /** ±delta (ms) or reset (0); saved per user and applied to the live card. */
  nudgeLyrics(userId, deltaMs) {
    const base = this.lyricsLive.offsetUserId === userId ? this.lyricsLive.offsetMs : this.manager.store.getLyricsOffset(userId);
    const next = deltaMs === 0 ? 0 : Math.max(-30_000, Math.min(30_000, base + deltaMs));
    this.manager.store.setLyricsOffset(userId, next);
    this.lyricsLive.offsetMs = next;
    this.lyricsLive.offsetUserId = userId;
    this.#lyricsKey = null;
    this.refreshNowPlaying();
    return next;
  }

  /**
   * Live-lyrics tick (twice a second while playing). Edits the card only when the visible
   * lines change or every 5s for the progress bar, never more than once per
   * `liveMinEditMs`, and never while a previous edit is still in flight.
   */
  #lyricsTick() {
    if (this.state !== S.PLAYING || !this.lyricsLive.enabled || !this.current) return;
    const key = `${this.manager.ui.liveLyricsKey(this)}:${Math.floor(this.position / 5)}`;
    if (key === this.#lyricsKey) return;
    if (this.#npBusy || this.#npPending || Date.now() - this.#lastNpEdit < config.lyrics.liveMinEditMs) return;
    this.#lyricsKey = key;
    void this.#queueNowPlaying({});
  }

  setTextChannel(channelId) {
    if (!channelId || channelId === this.textChannelId) return;
    this.textChannelId = channelId;
    this.manager.store.updateSettings(this.guildId, { lastTextChannelId: channelId });
  }

  async destroy({ announce = null, final = 'Disconnected' } = {}) {
    if (this.#destroyed) return;
    this.#destroyed = true;
    this.#leaving = true;
    this.#loadToken++;
    for (const key of Object.keys(this.#timers)) this.#clearTimer(key);
    const previous = this.stream;
    this.stream = null;
    previous?.kill();
    this.audio.stop(true);
    try {
      this.connection?.destroy();
    } catch {
      // already destroyed
    }
    this.connection = null;
    this.queue = [];
    this.current = null;
    this.#loading = false;
    this.#transition(S.DISCONNECTED, 'destroy');
    this.manager.remove(this.guildId, this);
    this.#npPending = null;
    await this.#queueNowPlaying({ final });
    if (announce) await this.announce(announce);
  }

  // ------------------------------------------------------------------ messages

  #textChannel() {
    return this.textChannelId ? this.manager.client?.channels.cache.get(this.textChannelId) ?? null : null;
  }

  /** Post a short notice. Notices within a few seconds of each other share one message. */
  async announce(content) {
    const channel = this.#textChannel();
    if (!channel) return;
    try {
      const recent = this.#notice && Date.now() - this.#notice.at < 8_000 && this.#notice.lines.length < 6;
      if (recent) {
        this.#notice.lines.push(content);
        this.#notice.at = Date.now();
        await this.#notice.message.edit({ content: this.#notice.lines.join('\n') });
        return;
      }
      const message = await channel.send({ content, allowedMentions: { parse: [] } });
      this.#notice = { message, at: Date.now(), lines: [content] };
    } catch (err) {
      this.log.warn({ err: err.message }, 'could not send notice');
    }
  }

  /** Debounced update of the persistent now-playing card. */
  refreshNowPlaying({ newTrack = false } = {}) {
    if (this.#destroyed) return;
    this.#npPending = { newTrack: newTrack || this.#npPending?.newTrack };
    clearTimeout(this.#timers.npDebounce);
    this.#timers.npDebounce = setTimeout(() => {
      const opts = this.#npPending;
      this.#npPending = null;
      if (opts) void this.#queueNowPlaying(opts);
    }, 350);
  }

  #queueNowPlaying(opts) {
    this.#npBusy = true;
    this.#npChain = this.#npChain.then(() => this.#flushNowPlaying(opts)).catch((err) => {
      this.log.warn({ err: err.message }, 'now-playing update failed');
    }).finally(() => {
      this.#npBusy = false;
    });
    return this.#npChain;
  }

  async #flushNowPlaying({ newTrack = false, final = null }) {
    const channel = this.#textChannel();
    if (!channel) return;
    // Every card edit passes through here (serialised), so this is where the live-lyrics
    // rate limit is enforced, whatever triggered the update.
    if (!final && this.lyricsLive.enabled) {
      const wait = this.#lastNpEdit + config.lyrics.liveMinEditMs - Date.now();
      if (wait > 0) await sleep(wait);
    }
    this.#lastNpEdit = Date.now();
    if (this.lyricsLive.enabled && this.current) this.#lyricsKey = `${this.manager.ui.liveLyricsKey(this)}:${Math.floor(this.position / 5)}`;
    const payload = this.manager.ui.nowPlaying(this, { final });
    if (this.#npMessage) {
      // Re-post on a new track if chat has buried the card; otherwise edit in place.
      const buried = newTrack && channel.lastMessageId && channel.lastMessageId !== this.#npMessage.id;
      if (!buried || final) {
        try {
          await this.#npMessage.edit(payload);
          return;
        } catch (err) {
          if (err.code !== 10008) throw err; // 10008 = message was deleted; send a new one
        }
      } else {
        this.#npMessage.delete().catch(() => {});
      }
      this.#npMessage = null;
    }
    if (final) return;
    this.#npMessage = await channel.send(payload);
  }

  get nowPlayingMessageId() {
    return this.#npMessage?.id ?? null;
  }

  #syncProgressTimer() {
    const playing = this.state === S.PLAYING;
    if (playing && !this.#timers.progress) {
      this.#timers.progress = setInterval(() => this.refreshNowPlaying(), config.nowPlayingUpdateSec * 1000);
    } else if (!playing && this.#timers.progress) {
      this.#clearTimer('progress');
    }
    // Live lyrics only tick while audio is actually playing (paused = no edits).
    const live = playing && this.lyricsLive.enabled;
    if (live && !this.#timers.lyrics) {
      this.#timers.lyrics = setInterval(() => this.#lyricsTick(), 500);
    } else if (!live && this.#timers.lyrics) {
      this.#clearTimer('lyrics');
    }
  }

  #clearTimer(key) {
    if (!this.#timers[key]) return;
    clearTimeout(this.#timers[key]);
    clearInterval(this.#timers[key]);
    this.#timers[key] = null;
  }
}
