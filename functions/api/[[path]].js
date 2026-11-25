// Beatrix API. Three seats:
//   paul      - talks to the assistant, sees his requests
//   katherine - his PA: sees everything, approves/edits drafts, works the task list
//   admin     - Vincent: everything Katherine can do, plus devices, delete items and wipe all
// Sign-in has no codes for Paul and Katherine: a phone or browser makes a random token, taps a
// name once (POST /api/enroll) and is remembered. A free seat is given at once while enrolment
// is open; otherwise Vincent allows the device with one tap. The old access codes still work,
// which is how Vincent's own admin link signs in.
// Vincent moderates out of sight: what he writes to Paul goes out as the assistant, and his edits,
// notes and name are never sent to Paul or Katherine. messages.edited: 0 none, 1 Katherine, 2 Vincent.
const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const MODES = ['auto', 'review', 'off']; // auto: AI answers Paul directly · review: Katherine approves first · off: human only
const DAILY_AI_CAP = 300;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

function sameText(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const SEATS = ['paul', 'katherine'];
const MAX_PENDING = 20;

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function deviceLabel(request) {
  const ua = request.headers.get('user-agent') || '';
  const kind = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android'
    : /Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows PC' : /Linux/.test(ua) ? 'Linux PC' : 'Unknown device';
  const inApp = /; wv\)/.test(ua) || (/iPhone|iPad/.test(ua) && !/Safari\//.test(ua));
  return kind + (inApp ? ' app' : ' browser');
}

// Who is asking: { role, deviceId, device }. role is null for a device with no seat yet.
async function identify(request, env) {
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (token.length < 8) return { role: null };
  if (env.PAUL_CODE && sameText(token, env.PAUL_CODE)) return { role: 'paul' };
  if (env.KAT_CODE && sameText(token, env.KAT_CODE)) return { role: 'katherine' };
  if (env.ADMIN_CODE && sameText(token, env.ADMIN_CODE)) return { role: 'admin' };
  if (token.length < 32) return { role: null };
  const deviceId = await sha256(token);
  const device = await env.DB.prepare('SELECT id, role, status, last_seen FROM devices WHERE id=?').bind(deviceId).first();
  if (device && device.status === 'active') {
    if (!device.last_seen || Date.now() - Date.parse(device.last_seen) > 600000) {
      await env.DB.prepare("UPDATE devices SET last_seen=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?").bind(deviceId).run();
    }
    return { role: device.role, deviceId, device };
  }
  return { role: null, deviceId, device };
}

const enrollOpen = (s) => Boolean(s.enroll_until && Date.parse(s.enroll_until) > Date.now());

// A device with no seat asks for one. No typing: the page sends only the name that was tapped.
async function enroll(request, env, who, data) {
  const db = env.DB;
  if (!who.deviceId) return json({ error: 'no device token' }, 400);
  if (!SEATS.includes(data.role)) return json({ error: 'bad role' }, 400);
  if (who.device && who.device.status === 'revoked') return json({ error: 'this device was removed' }, 403);
  const taken = (await db.prepare("SELECT COUNT(*) AS n FROM devices WHERE role=? AND status='active'").bind(data.role).first()).n;
  // While enrolment is open every device gets in at once (several per seat): a one-seat limit left Apple's reviewer stuck waiting.
  const status = enrollOpen(await settings(db)) ? 'active' : 'pending';
  if (!who.device && status === 'pending') {
    const waiting = (await db.prepare("SELECT COUNT(*) AS n FROM devices WHERE status='pending'").first()).n;
    if (waiting >= MAX_PENDING) return json({ error: 'too many requests waiting' }, 429);
  }
  await db.prepare(
    `INSERT INTO devices(id, role, status, label, last_seen) VALUES(?,?,?,?,strftime('%Y-%m-%dT%H:%M:%SZ','now'))
     ON CONFLICT(id) DO UPDATE SET role=excluded.role, status=excluded.status, label=excluded.label`
  ).bind(who.deviceId, data.role, status, deviceLabel(request)).run();
  await bump(db);
  return json({ ok: true, status });
}

async function settings(db) {
  const { results } = await db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(results.map((r) => [r.key, r.value]));
}
const setSetting = (db, key, value) =>
  db.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value')
    .bind(key, String(value)).run();
const bump = (db) =>
  db.prepare("INSERT INTO settings(key,value) VALUES('rev','1') ON CONFLICT(key) DO UPDATE SET value=CAST(value AS INTEGER)+1").run();

const AUTHOR = { paul: 'paul', katherine: 'katherine', admin: 'vincent' };
const isStaff = (role) => role === 'katherine' || role === 'admin';
const clean = (v, max) => String(v ?? '').trim().slice(0, max);
const cleanDue = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null);

async function getState(env, role, url) {
  const db = env.DB;
  const s = await settings(db);
  const rev = s.rev || '0';
  let katSeen = s.kat_seen || null;
  if (role === 'katherine' && (!katSeen || Date.now() - Date.parse(katSeen) > 20000)) {
    katSeen = new Date().toISOString();
    await setSetting(db, 'kat_seen', katSeen); // presence only: no rev bump
  }
  const base = { role, rev, mode: s.mode || 'auto', kat_seen: katSeen };
  if (url.searchParams.get('rev') === rev) return json({ ...base, unchanged: true });

  const where = role === 'paul' ? "WHERE private=0 AND status='sent'"
    : role === 'katherine' ? "WHERE status!='discarded' AND author!='vincent'" : "WHERE status!='discarded'";
  const messages = (await db.prepare(
    `SELECT * FROM (SELECT id,author,body,status,private,edited,created_at FROM messages ${where} ORDER BY id DESC LIMIT 300) ORDER BY id`
  ).all()).results;
  if (role !== 'admin') for (const m of messages) m.edited = role === 'katherine' && m.edited === 1 ? 1 : 0;
  const tasks = (await db.prepare(
    `SELECT id,title,detail,status,due,note,created_by,created_at,updated_at FROM tasks
     WHERE status IN ('open','doing') OR (status='done' AND updated_at > strftime('%Y-%m-%dT%H:%M:%SZ','now','-14 days'))
     ORDER BY CASE status WHEN 'doing' THEN 0 WHEN 'open' THEN 1 ELSE 2 END, COALESCE(due,'9999'), id DESC`
  ).all()).results;
  const held = role === 'paul'
    ? (await db.prepare("SELECT COUNT(*) AS n FROM messages WHERE status='held'").first()).n
    : messages.filter((m) => m.status === 'held').length;
  const extra = {};
  if (role === 'admin') {
    extra.ai_today = (await db.prepare(
      "SELECT COUNT(*) AS n FROM messages WHERE author='assistant' AND created_at > strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')"
    ).first()).n;
    extra.ai_cap = DAILY_AI_CAP;
    extra.enroll_until = enrollOpen(s) ? s.enroll_until : null;
    extra.devices = (await db.prepare(
      "SELECT id, role, status, label, created_at, last_seen FROM devices WHERE status!='revoked' ORDER BY status DESC, created_at DESC LIMIT 60"
    ).all()).results;
  }
  return json({ ...base, ...extra, messages, tasks, held });
}

// ---- the assistant -------------------------------------------------------

function systemPrompt(openTasks) {
  const today = new Date().toISOString().slice(0, 10);
  const list = openTasks.length
    ? openTasks.map((t) => `- #${t.id} [${t.status}] ${t.title}${t.due ? ` (due ${t.due})` : ''}`).join('\n')
    : '(none)';
  return `You are Beatrix, Paul's personal assistant. Today is ${today}.
Katherine is Paul's human PA. She reads this whole conversation and does the real-world work.
You cannot act in the world yourself: no email, calendar, calls, purchases or bookings.
- If Paul asks for something that needs doing, create a task for Katherine and tell Paul it is with her. Never claim it is done.
- If Paul asks a question you can answer (facts, drafting text, planning, math), answer it yourself, briefly.
- Do not create a task that duplicates one already open.
- If a request is unclear, ask one short question instead of guessing.
Open tasks:
${list}

Reply with ONLY a JSON object, no other text:
{"reply": "what you say to Paul, plain text, short", "tasks": [{"title": "short imperative", "detail": "what Katherine needs to know", "due": "YYYY-MM-DD or null"}]}
"tasks" is [] when nothing needs doing.`;
}

function parseAi(out) {
  let raw = out && typeof out === 'object' && 'response' in out ? out.response : out;
  if (raw && typeof raw === 'object') return raw;
  raw = String(raw || '').trim();
  const a = raw.indexOf('{');
  const b = raw.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(raw.slice(a, b + 1)); } catch { /* fall through to plain text */ }
  }
  return { reply: raw, tasks: [] };
}

async function assist(env, msgId, body) {
  const db = env.DB;
  const mode = (await settings(db)).mode || 'auto';
  if (mode === 'off') return;

  let result = null;
  const used = (await db.prepare(
    "SELECT COUNT(*) AS n FROM messages WHERE author='assistant' AND created_at > strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 day')"
  ).first()).n;
  if (env.AI && used < DAILY_AI_CAP) {
    try {
      const history = (await db.prepare(
        "SELECT * FROM (SELECT id,author,body FROM messages WHERE private=0 AND status IN ('sent','held') ORDER BY id DESC LIMIT 30) ORDER BY id"
      ).all()).results;
      const openTasks = (await db.prepare("SELECT id,title,status,due FROM tasks WHERE status IN ('open','doing') ORDER BY id").all()).results;
      const chat = [{ role: 'system', content: systemPrompt(openTasks) }];
      for (const m of history) {
        if (m.author === 'assistant') chat.push({ role: 'assistant', content: JSON.stringify({ reply: m.body, tasks: [] }) });
        else if (m.author === 'paul') chat.push({ role: 'user', content: m.body });
        else chat.push({ role: 'user', content: `[${m.author === 'vincent' ? 'Vincent, who runs this app,' : 'Katherine, the human PA,'} wrote to Paul]: ${m.body}` });
      }
      result = parseAi(await env.AI.run(MODEL, { messages: chat, max_tokens: 700, temperature: 0.3 }));
    } catch (err) {
      console.log('assist failed:', err && err.message);
    }
  }
  if (!result || !clean(result.reply, 4000)) {
    // No model (or it failed, or the free quota ran out): hand it straight to the human.
    result = { reply: "Got it. I've passed this to Katherine.", tasks: [{ title: clean(body, 90), detail: clean(body, 2000) }] };
  }

  const tasks = Array.isArray(result.tasks) ? result.tasks.slice(0, 3) : [];
  for (const t of tasks) {
    const title = clean(t && t.title, 140);
    if (!title) continue;
    await db.prepare("INSERT INTO tasks(title,detail,due,created_by,source_msg) VALUES(?,?,?,'assistant',?)")
      .bind(title, clean(t.detail, 2000), cleanDue(t.due), msgId).run();
  }
  await db.prepare("INSERT INTO messages(author,body,status) VALUES('assistant',?,?)")
    .bind(clean(result.reply, 4000), mode === 'review' ? 'held' : 'sent').run();
  await bump(db);
}

// ---- writes --------------------------------------------------------------

async function postMessage(ctx, role, data) {
  const db = ctx.env.DB;
  const body = clean(data.body, 4000);
  if (!body) return json({ error: 'empty message' }, 400);
  const isPrivate = isStaff(role) && data.private ? 1 : 0;
  const ghost = role === 'admin' && !isPrivate;   // the moderator speaks as the assistant
  const row = await db.prepare('INSERT INTO messages(author,body,private,edited) VALUES(?,?,?,?) RETURNING id')
    .bind(ghost ? 'assistant' : AUTHOR[role], body, isPrivate, ghost ? 2 : 0).first();
  await bump(db);
  if (role === 'paul') ctx.waitUntil(assist(ctx.env, row.id, body));
  return json({ ok: true, id: row.id });
}

async function postDraft(env, role, data) {
  const db = env.DB;
  const draft = await db.prepare("SELECT id, body FROM messages WHERE id=? AND status='held'").bind(Number(data.id)).first();
  if (!draft) return json({ error: 'no such draft' }, 404);
  if (data.action === 'discard') {
    await db.prepare("UPDATE messages SET status='discarded' WHERE id=?").bind(draft.id).run();
  } else if (data.action === 'approve') {
    const body = clean(data.body, 4000) || draft.body;
    await db.prepare("UPDATE messages SET status='sent', body=?, edited=?, created_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?")
      .bind(body, body === draft.body ? 0 : role === 'admin' ? 2 : 1, draft.id).run();
  } else return json({ error: 'bad action' }, 400);
  await bump(db);
  return json({ ok: true });
}

async function postTask(env, role, data) {
  const db = env.DB;
  if (!data.id) {
    const title = clean(data.title, 140);
    if (!title) return json({ error: 'title required' }, 400);
    await db.prepare('INSERT INTO tasks(title,detail,due,created_by) VALUES(?,?,?,?)')
      .bind(title, clean(data.detail, 2000), cleanDue(data.due), role === 'admin' ? 'assistant' : AUTHOR[role]).run();
    await bump(db);
    return json({ ok: true });
  }
  if (!isStaff(role)) return json({ error: 'only Katherine updates tasks' }, 403);
  const task = await db.prepare('SELECT * FROM tasks WHERE id=?').bind(Number(data.id)).first();
  if (!task) return json({ error: 'no such task' }, 404);
  const status = ['open', 'doing', 'done', 'dropped'].includes(data.status) ? data.status : task.status;
  const note = data.note === undefined ? task.note : clean(data.note, 2000);
  const title = data.title === undefined ? task.title : clean(data.title, 140) || task.title;
  const due = data.due === undefined ? task.due : cleanDue(data.due);
  await db.prepare("UPDATE tasks SET status=?, note=?, title=?, due=?, updated_at=strftime('%Y-%m-%dT%H:%M:%SZ','now') WHERE id=?")
    .bind(status, note, title, due, task.id).run();
  if (status === 'done' && task.status !== 'done') {
    await db.prepare('INSERT INTO messages(author,body,edited) VALUES(?,?,?)')
      .bind(role === 'admin' ? 'assistant' : AUTHOR[role], `Done: ${title}${note ? ` — ${note}` : ''}`, role === 'admin' ? 2 : 0).run();
  }
  await bump(db);
  return json({ ok: true });
}

export async function onRequest(ctx) {
  const { request, env } = ctx;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '');
  if (!env.DB) return json({ error: 'database not bound' }, 500);
  try {
    const who = await identify(request, env);
    const role = who.role;
    const post = request.method === 'POST';
    const data = post ? await request.json().catch(() => ({})) : {};
    if (!role) {
      if (post && path === 'enroll') return await enroll(request, env, who, data);
      const d = who.device;
      return json({
        error: 'not signed in',
        waiting: d && d.status === 'pending' ? d.role : null,
        removed: Boolean(d && d.status === 'revoked'),
      }, 401);
    }
    if (request.method === 'GET' && path === 'state') return await getState(env, role, url);
    if (!post) return json({ error: 'not found' }, 404);
    if (path === 'message') return await postMessage(ctx, role, data);
    if (path === 'task') return await postTask(env, role, data);
    if (path === 'leave') {   // Sign out on this device: forget it, so it can pick a name again
      if (who.deviceId) { await env.DB.prepare('DELETE FROM devices WHERE id=?').bind(who.deviceId).run(); await bump(env.DB); }
      return json({ ok: true });
    }
    if (!isStaff(role)) return json({ error: 'not found' }, 404);
    if (path === 'draft') return await postDraft(env, role, data);
    if (path === 'mode') {
      if (!MODES.includes(data.mode)) return json({ error: 'bad mode' }, 400);
      await setSetting(env.DB, 'mode', data.mode);
      await bump(env.DB);
      return json({ ok: true });
    }
    if (role !== 'admin') return json({ error: 'not found' }, 404);
    if (path === 'admin/delete') {
      const table = { message: 'messages', task: 'tasks' }[data.kind];
      if (!table) return json({ error: 'bad kind' }, 400);
      await env.DB.prepare(`DELETE FROM ${table} WHERE id=?`).bind(Number(data.id)).run();
      await bump(env.DB);
      return json({ ok: true });
    }
    if (path === 'admin/device') {
      const id = clean(data.id, 64);
      if (data.action === 'allow' && SEATS.includes(data.role)) {
        await env.DB.prepare("UPDATE devices SET status='active', role=? WHERE id=?").bind(data.role, id).run();
      } else if (data.action === 'remove') {
        await env.DB.prepare("UPDATE devices SET status='revoked' WHERE id=?").bind(id).run();
      } else return json({ error: 'bad action' }, 400);
      await bump(env.DB);
      return json({ ok: true });
    }
    if (path === 'admin/enroll') {
      const hours = Math.max(0, Math.min(168, Number(data.hours) || 0));
      await setSetting(env.DB, 'enroll_until', hours ? new Date(Date.now() + hours * 3600000).toISOString() : '');
      await bump(env.DB);
      return json({ ok: true });
    }
    if (path === 'admin/wipe') {
      if (data.confirm !== 'wipe') return json({ error: 'confirm required' }, 400);
      await env.DB.batch([env.DB.prepare('DELETE FROM messages'), env.DB.prepare('DELETE FROM tasks')]);
      await bump(env.DB);
      return json({ ok: true });
    }
    return json({ error: 'not found' }, 404);
  } catch (err) {
    console.log('api error:', err && err.stack);
    return json({ error: 'server error' }, 500);
  }
}
