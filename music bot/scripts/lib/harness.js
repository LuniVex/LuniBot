/**
 * Music Bot — scripts/lib/harness.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */
/**
 * Fake Discord gateway + test harness for the smoke scripts. Only Discord is faked:
 * a FakeConnection counts the Opus packets the real audio player dispatches.
 */
import { EventEmitter } from 'node:events';
import { setTimeout as sleep } from 'node:timers/promises';
import { Collection } from 'discord.js';

export class FakeConnection extends EventEmitter {
  packets = 0;

  constructor(channelId) {
    super();
    this.joinConfig = { channelId };
    this.state = { status: 'signalling' };
    setTimeout(() => this.setStatus('ready'), 30);
  }

  setStatus(status, extra = {}) {
    const old = this.state;
    this.state = { ...old, status, ...extra };
    this.emit('stateChange', old, this.state);
    this.emit(status, old, this.state);
  }

  subscribe(player) {
    const subscription = player.subscribe(this);
    this.state = { ...this.state, subscription };
    return subscription;
  }

  prepareAudioPacket(buffer) {
    this.packets++;
    return buffer;
  }

  dispatchAudio() { return true; }

  setSpeaking() {}

  rejoin() {
    this.setStatus('signalling');
    setTimeout(() => this.setStatus('ready'), 100);
    return true;
  }

  destroy() {
    this.setStatus('destroyed');
  }
}

let messageSeq = 0;
export function fakeMessage(payload, channel) {
  return {
    id: String(++messageSeq),
    payload,
    edits: 0,
    editLog: [],
    deleted: false,
    async edit(p) {
      this.payload = { ...this.payload, ...p };
      this.edits++;
      this.editLog.push({ at: Date.now(), payload: this.payload });
      return this;
    },
    async delete() { this.deleted = true; channel.lastMessageId = null; },
  };
}

export function fakeGuild(id) {
  const text = {
    id: `${id}-text`,
    lastMessageId: null,
    messages: [],
    async send(payload) {
      const m = fakeMessage(payload, this);
      this.messages.push(m);
      this.lastMessageId = m.id;
      return m;
    },
  };
  const humans = new Collection();
  const voice = {
    id: `${id}-vc`, full: false, members: humans,
    permissionsFor: () => ({ has: () => true }),
    isVoiceBased: () => true,
  };
  const guild = { id, members: { me: {} }, channels: { cache: new Collection([[voice.id, voice], [text.id, text]]) } };
  voice.guild = guild;
  const member = {
    id: `${id}-user`, displayName: `Tester@${id}`, user: { bot: false }, guild,
    voice: { channel: voice, channelId: voice.id },
    permissions: { has: () => false },
    roles: { cache: new Collection() },
  };
  humans.set(member.id, member);
  return { guild, text, voice, member, humans };
}


export function fakeClient(...envs) {
  return {
    user: { id: 'bot' },
    guilds: { cache: new Collection(envs.map((e) => [e.guild.id, e.guild])) },
    channels: { cache: new Collection(envs.map((e) => [e.text.id, e.text])) },
  };
}

export function interaction(env, fields) {
  const log = [];
  return {
    guildId: env.guild.id, channelId: env.text.id, guild: env.guild, member: env.member, user: { id: env.member.id },
    log,
    deferred: false,
    replied: false,
    isAutocomplete: () => false,
    inCachedGuild: () => true,
    isChatInputCommand: () => false,
    isModalSubmit: () => false,
    isButton: () => false,
    isStringSelectMenu: () => false,
    isRepliable: () => true,
    async deferReply() { this.deferred = true; },
    async deferUpdate() { this.deferred = true; },
    async editReply(p) { log.push(['editReply', p]); },
    async deleteReply() { log.push(['deleteReply']); },
    async reply(p) { this.replied = true; log.push(['reply', p]); },
    async followUp(p) { log.push(['followUp', p]); },
    async update(p) { this.replied = true; log.push(['update', p]); },
    async showModal(m) { log.push(['modal', m]); },
    ...fields,
  };
}

export function slash(env, commandName, opts = {}, sub = null) {
  return interaction(env, {
    commandName,
    isChatInputCommand: () => true,
    memberPermissions: { has: () => true },
    options: {
      getString: (n) => opts[n] ?? null,
      getBoolean: (n) => opts[n] ?? null,
      getInteger: (n) => opts[n] ?? null,
      getSubcommand: () => sub,
    },
  });
}

export const button = (env, customId) => interaction(env, { customId, isButton: () => true });
export const select = (env, customId, values) => interaction(env, { customId, values, isStringSelectMenu: () => true });
export const replyText = (i) => i.log.map(([, p]) => p?.content).filter(Boolean).join(' | ');

// ------------------------------------------------------------------ harness

export const results = [];
export async function step(name, fn) {
  const t0 = Date.now();
  try {
    const note = await fn();
    results.push({ name, ok: true, ms: Date.now() - t0, note });
    console.log(`  ✅ ${name} (${Date.now() - t0}ms)${note ? ` — ${note}` : ''}`);
  } catch (err) {
    results.push({ name, ok: false, ms: Date.now() - t0, note: err.message });
    console.log(`  ❌ ${name} (${Date.now() - t0}ms) — ${err.message}`);
  }
}

export async function waitFor(desc, fn, timeoutMs = 30_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await fn()) return;
    await sleep(100);
  }
  throw new Error(`timed out waiting for: ${desc}`);
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
