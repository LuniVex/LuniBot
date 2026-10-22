/**
 * Modmail — src/handlers/transcriptGenerator.js
 * Created by LuniVex (https://github.com/LuniVex/lunibot)
 * Please keep this credit when copying or modifying this file.
 */

const fs = require('fs');
const path = require('path');
const db = require('../database/db');

const transcriptsDir = path.join(process.cwd(), 'transcripts');
if (!fs.existsSync(transcriptsDir)) {
  fs.mkdirSync(transcriptsDir, { recursive: true });
}

// ── Helpers ──────────────────────────────────────────────────

function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function markdownToHtml(text) {
  if (!text) return '';
  let html = escapeHtml(text);
  // Code blocks (must run before inline)
  html = html.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    '<pre><code class="$1">$2</code></pre>'
  );
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  // Italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Underline
  html = html.replace(/__(.+?)__/g, '<u>$1</u>');
  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  // Line breaks
  html = html.replace(/\n/g, '<br>');
  return html;
}

// ── Main generator ───────────────────────────────────────────

async function generateTranscript(ticket, client) {
  const messages = db
    .prepare('SELECT * FROM messages WHERE ticket_id = ? ORDER BY created_at ASC')
    .all(ticket.id);

  const user = await client.users.fetch(ticket.user_id).catch(() => null);
  const userName = user ? user.tag : `Unknown User (${ticket.user_id})`;

  // Build a cache of author info so we only fetch once per author
  const authorCache = new Map();
  for (const msg of messages) {
    if (!authorCache.has(msg.author_id)) {
      const author = await client.users.fetch(msg.author_id).catch(() => null);
      authorCache.set(msg.author_id, {
        tag: author ? author.tag : `Unknown (${msg.author_id})`,
        avatar: author
          ? author.displayAvatarURL({ extension: 'png', size: 64 })
          : '',
        isUser: msg.author_id === ticket.user_id,
      });
    }
  }

  // ── Render messages ──
  const messageHtml = messages
    .map((msg) => {
      const author = authorCache.get(msg.author_id);
      const date = new Date(msg.created_at + 'Z');
      const timestamp = date.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      let attachmentsHtml = '';
      if (msg.attachments) {
        try {
          const atts = JSON.parse(msg.attachments);
          attachmentsHtml = atts
            .map((a) => {
              if (a.url?.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
                return `<div class="mt-3"><img src="${escapeHtml(
                  a.url
                )}" alt="${escapeHtml(a.name || 'image')}" loading="lazy" class="max-w-md w-full h-auto rounded-lg shadow-md cursor-pointer hover:opacity-90 transition-opacity"></div>`;
              }
              return `<div class="mt-2"><a href="${escapeHtml(
                a.url
              )}" class="text-blue-400 hover:text-blue-300 underline text-sm flex items-center gap-1">📎 ${escapeHtml(a.name || 'attachment')}</a></div>`;
            })
            .join('');
        } catch {
          /* ignore malformed JSON */
        }
      }

      const authorColor = author.isUser ? 'text-indigo-400' : 'text-green-400';
      const bgHover = 'hover:bg-gray-800/50';

      return `
      <div class="p-4 rounded-lg transition-colors duration-200 ${bgHover}">
        <div class="flex items-center gap-3 mb-2">
          ${
            author.avatar
              ? `<img class="w-10 h-10 rounded-full object-cover shadow-sm" src="${author.avatar}" alt="">`
              : `<div class="w-10 h-10 rounded-full bg-gray-700 shadow-sm"></div>`
          }
          <div class="flex items-baseline gap-2">
            <span class="font-bold text-[0.95rem] ${authorColor}">${escapeHtml(author.tag)}</span>
            <span class="text-xs text-gray-500">${timestamp}</span>
          </div>
        </div>
        <div class="pl-[3.25rem] message-content break-words text-[0.95rem] leading-relaxed text-gray-200">
          ${markdownToHtml(msg.content)}
          ${attachmentsHtml}
        </div>
      </div>`;
    })
    .join('');

  const createdDate = new Date(ticket.created_at + 'Z').toLocaleString('en-GB');
  const closedDate = ticket.closed_at
    ? new Date(ticket.closed_at + 'Z').toLocaleString('en-GB')
    : 'N/A';

  // ── Full HTML document ──
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ticket Transcript — ${escapeHtml(ticket.subject || 'Untitled')}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    .message-content code { background-color: #374151; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    .message-content pre { background-color: #1f2937; padding: 12px; border-radius: 8px; overflow-x: auto; margin: 8px 0; }
    .message-content a { color: #60a5fa; text-decoration: underline; }
  </style>
</head>
<body class="bg-gray-900 text-gray-200 font-sans antialiased">
  <div class="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
    <div class="bg-gray-800 border border-gray-700 rounded-xl shadow-lg mb-8 overflow-hidden">
      <div class="bg-gradient-to-r from-blue-900 to-indigo-900 px-6 py-8 border-b border-gray-700">
        <h1 class="text-2xl font-bold text-white mb-2">📋 Ticket Transcript — ${escapeHtml(ticket.subject || 'Untitled')}</h1>
        <p class="text-indigo-200 text-sm">Archived conversation log</p>
      </div>
      <div class="p-6 grid grid-cols-2 md:grid-cols-3 gap-6">
        <div class="bg-gray-850 p-3 rounded-lg border border-gray-700/50">
          <label class="block text-xs uppercase tracking-wider text-gray-500 mb-1">User</label>
          <span class="font-semibold text-gray-100">${escapeHtml(userName)}</span>
        </div>
        <div class="bg-gray-850 p-3 rounded-lg border border-gray-700/50">
          <label class="block text-xs uppercase tracking-wider text-gray-500 mb-1">User ID</label>
          <span class="font-semibold text-gray-100">${ticket.user_id}</span>
        </div>
        <div class="bg-gray-850 p-3 rounded-lg border border-gray-700/50">
          <label class="block text-xs uppercase tracking-wider text-gray-500 mb-1">Ticket ID</label>
          <span class="font-semibold text-gray-100">#${ticket.id}</span>
        </div>
        <div class="bg-gray-850 p-3 rounded-lg border border-gray-700/50">
          <label class="block text-xs uppercase tracking-wider text-gray-500 mb-1">Opened</label>
          <span class="font-semibold text-gray-100">${createdDate}</span>
        </div>
        <div class="bg-gray-850 p-3 rounded-lg border border-gray-700/50">
          <label class="block text-xs uppercase tracking-wider text-gray-500 mb-1">Closed</label>
          <span class="font-semibold text-gray-100">${closedDate}</span>
        </div>
        <div class="bg-gray-850 p-3 rounded-lg border border-gray-700/50">
          <label class="block text-xs uppercase tracking-wider text-gray-500 mb-1">Messages</label>
          <span class="font-semibold text-gray-100">${messages.length}</span>
        </div>
      </div>
    </div>
    
    <div class="space-y-4">
      ${
        messageHtml ||
        '<p class="text-center text-gray-500 py-12 italic">No messages in this ticket.</p>'
      }
    </div>
    
    <div class="mt-12 pt-6 border-t border-gray-800 text-center text-sm text-gray-500">
      Generated on ${new Date().toLocaleString('en-GB')} • Modmail Bot
    </div>
  </div>
</body>
</html>`;

  const fileName = `ticket-${ticket.id}.html`;
  const filePath = path.join(transcriptsDir, fileName);
  fs.writeFileSync(filePath, html, 'utf-8');

  // Persist transcript metadata
  db.prepare(
    'INSERT INTO transcripts (ticket_id, user_id, file_path) VALUES (?, ?, ?)'
  ).run(ticket.id, ticket.user_id, filePath);

  return filePath;
}

module.exports = { generateTranscript };
