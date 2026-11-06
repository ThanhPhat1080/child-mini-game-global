// In-memory stand-in for the parts of Supabase the app uses (REST, auth, storage).
// Runs as a real HTTP server because middleware.ts calls Supabase from the Next server,
// which Playwright's page.route cannot intercept. Start: node e2e/support/standin-supabase.mjs
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const PORT = Number(process.env.STANDIN_PORT ?? 54391);
// Three fixed accounts: Super Admin and parent sign in. `admin@test.local` is the parent so the older admin specs keep working.
// The child is a row in `children` (not an account); its PIN is 1234.
const SUPER = { email: 'super@test.local', password: 'secret', id: '11111111-1111-4111-8111-111111111111' };
const PARENT = { email: 'admin@test.local', password: 'secret', id: '22222222-2222-4222-8222-222222222222' };
const CHILD = { id: '33333333-3333-4333-8333-333333333333', name: 'Test', pin: '1234' };
const TABLES = ['children', 'memory_cards', 'card_groups', 'spot_levels', 'find_levels', 'child_settings', 'quiz_sets', 'questions', 'answers', 'profiles', 'support_messages', 'review_events'];
const CONTENT = ['quiz_sets', 'memory_cards', 'spot_levels', 'card_groups', 'find_levels'];
const QUOTA = 50 * 1024 * 1024;
const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

const SAMPLE_WORDS = [
  'apple', 'banana', 'berry', 'bird', 'cat', 'circle', 'duck', 'fish', 'grapes',
  'heart', 'square', 'apple2', 'banana2', 'berry2', 'bird2', 'cat2', 'duck2', 'fish2',
];

const profile = (u, role, extra = {}) => ({
  user_id: u.id, role, display_name: role, banned: false, ban_reason_code: null, ban_note: null,
  banned_at: null, quota_bytes: QUOTA, created_at: new Date(Date.UTC(2026, 0, 1)).toISOString(), ...extra,
});

const seedChild = () => ({
  id: CHILD.id, parent_id: PARENT.id, child_name: CHILD.name.toLowerCase(), display_name: CHILD.name, avatar_path: null,
  gender: 'female', age_band: '2-5', pin: CHILD.pin, created_at: new Date(Date.UTC(2026, 0, 1)).toISOString(),
});
const childSettings = (childId) => ({ child_id: childId, music_volume: 30, greeting_path: null, music_path: null });

function defaultState() {
  return {
    profiles: [
      profile(SUPER, 'super_admin', { display_name: 'Super' }),
      profile(PARENT, 'parent', { display_name: 'Parent' }),
    ],
    children: [seedChild()],
    support_messages: [],
    review_events: [],
    memory_cards: SAMPLE_WORDS.map((w, i) => ({
      id: `00000000-0000-4000-9000-${String(i + 1).padStart(12, '0')}`,
      word: w,
      image_path: `seed/${w.replace(/2$/, '')}.svg`,
      active: true,
      position: i + 1,
      created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
    })),
    card_groups: [],
    spot_levels: [],
    find_levels: [],
    child_settings: [childSettings(CHILD.id)],
    quiz_sets: [],
    questions: [],
    answers: [],
  };
}

let state = defaultState();
let currentUserId = null; // the account behind the request being handled (column defaults like auth.uid())
const files = new Map(); // storage path -> { type, body }
const accessTokens = new Map(); // token -> user id

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

const users = new Map(); // id -> { id, email, password }
const resetUsers = () => {
  users.clear();
  for (const u of [SUPER, PARENT]) users.set(u.id, { ...u });
};
resetUsers();
normalize();

const authUser = (u) => ({
  id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email,
  email_confirmed_at: new Date().toISOString(), app_metadata: {}, user_metadata: {},
  created_at: new Date().toISOString(),
});

function issueSession(u) {
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 3600 * 24;
  const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: u.id, role: 'authenticated', aud: 'authenticated', email: u.email, exp: expiresAt, iat: now })}.${randomUUID().replace(/-/g, '')}`;
  accessTokens.set(jwt, u.id);
  return {
    access_token: jwt, token_type: 'bearer', expires_in: 3600 * 24, expires_at: expiresAt,
    refresh_token: `refresh-${u.id}-${randomUUID()}`, user: authUser(u),
  };
}

/** The account a request's bearer token belongs to, or null (the anon key and unknown tokens are anonymous). */
function bearerUser(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
  const id = m && accessTokens.get(m[1]);
  return id ? users.get(id) ?? null : null;
}
const bearerOk = (req) => !!bearerUser(req);

function cors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS,HEAD');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] ?? '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Type');
  res.setHeader('Vary', 'Origin');
}

function send(res, status, body, headers = {}) {
  const isBuf = Buffer.isBuffer(body);
  const payload = body === undefined ? '' : isBuf ? body : JSON.stringify(body);
  res.writeHead(status, { ...(body === undefined || isBuf ? {} : { 'Content-Type': 'application/json' }), ...headers });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

/** Returns { type, body } for the file in a multipart/form-data payload (what supabase-js sends for a Blob/File). */
function parseUpload(contentType, buf) {
  const m = /multipart\/form-data;\s*boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? '');
  if (!m) return { type: contentType || 'application/octet-stream', body: buf };
  const delim = Buffer.from(`--${m[1] ?? m[2]}`);
  let file = null;
  let pos = buf.indexOf(delim);
  while (pos >= 0) {
    const start = pos + delim.length;
    if (buf.slice(start, start + 2).toString() === '--') break;
    const next = buf.indexOf(delim, start);
    if (next < 0) break;
    const part = buf.slice(start + 2, next - 2); // drop the CRLF after the boundary and before the next
    const split = part.indexOf('\r\n\r\n');
    const head = part.slice(0, split).toString('utf8');
    const data = part.slice(split + 4);
    const ct = /content-type:\s*([^\r\n]+)/i.exec(head);
    if (/filename=/i.test(head) || (!file && ct)) file = { type: ct ? ct[1].trim() : 'application/octet-stream', body: data };
    pos = next;
  }
  return file ?? { type: 'application/octet-stream', body: Buffer.alloc(0) };
}

const parseJson = (buf) => { try { return buf.length ? JSON.parse(buf.toString('utf8')) : undefined; } catch { return undefined; } };
const same = (a, b) => String(a) === String(b);

function cmp(a, b) {
  const na = Number(a), nb = Number(b);
  if (a !== null && b !== null && a !== '' && b !== '' && !Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return String(a).localeCompare(String(b));
}

function splitIn(v) {
  return v.replace(/^\(|\)$/g, '').split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
}

class Unsupported extends Error {}
const OPS = new Set(['eq', 'neq', 'in', 'is', 'gt', 'gte', 'lt', 'lte']);

/** One `column.op.value` test, as used inside `or=(...)`. */
function leaf(expr) {
  const [col, op, ...rest] = expr.split('.');
  const val = rest.join('.');
  return (row) => {
    const x = row[col];
    if (op === 'eq') return same(x, val);
    if (op === 'neq') return !same(x, val);
    if (op === 'is') return val === 'null' ? x == null : same(x, val);
    throw new Unsupported(`stand-in: unsupported operator "${op}" inside or()`);
  };
}

function matcher(params) {
  const tests = [];
  for (const [key, raw] of params) {
    if (RESERVED.has(key)) continue;
    if (key === 'or') {
      const alts = raw.replace(/^\(|\)$/g, '').split(',').map(leaf);
      tests.push((row) => alts.some((t) => t(row)));
      continue;
    }
    if (key === 'and') throw new Unsupported(`stand-in: unsupported filter "${key}"`);
    const dot = raw.indexOf('.');
    if (dot < 0) throw new Unsupported(`stand-in: cannot parse filter ${key}=${raw}`);
    let op = raw.slice(0, dot);
    let val = raw.slice(dot + 1);
    let neg = false;
    if (op === 'not') { neg = true; const d2 = val.indexOf('.'); op = val.slice(0, d2); val = val.slice(d2 + 1); }
    if (!OPS.has(op)) throw new Unsupported(`stand-in: unsupported operator "${op}" on column ${key}`);
    const t = (row) => {
      const x = row[key];
      switch (op) {
        case 'eq': return same(x, val);
        case 'neq': return !same(x, val);
        case 'in': return splitIn(val).some((v) => same(x, v));
        case 'is': return val === 'null' ? x == null : same(x, val);
        case 'gt': return x != null && cmp(x, val) > 0;
        case 'gte': return x != null && cmp(x, val) >= 0;
        case 'lt': return x != null && cmp(x, val) < 0;
        case 'lte': return x != null && cmp(x, val) <= 0;
        default: return false;
      }
    };
    tests.push(neg ? (r) => !t(r) : t);
  }
  return (row) => tests.every((t) => t(row));
}

function applyOrder(rows, order) {
  if (!order) return rows;
  const keys = order.split(',').map((p) => { const [col, dir = 'asc'] = p.split('.'); return { col, desc: dir === 'desc' }; });
  return [...rows].sort((a, b) => {
    for (const { col, desc } of keys) {
      const x = a[col], y = b[col];
      const c = x == null && y == null ? 0 : x == null ? 1 : y == null ? -1 : cmp(x, y);
      if (c) return desc ? -c : c;
    }
    return 0;
  });
}

function withDefaults(table, row) {
  const r = { ...row };
  if (table === 'children' && r.parent_id === undefined) r.parent_id = currentUserId;
  if (table !== 'child_settings' && table !== 'profiles' && r.id === undefined) r.id = randomUUID();
  if (r.created_at === undefined && table !== 'child_settings') r.created_at = new Date().toISOString();
  if (table === 'memory_cards' && r.active === undefined) r.active = true;
  if (CONTENT.includes(table)) {
    if (r.owner_id === undefined) r.owner_id = currentUserId;
    if (r.visibility === undefined) r.visibility = 'private';
  }
  if (table === 'support_messages') Object.assign(r, { from_user: currentUserId, read_at: null, resolved_at: null, ...r });
  if (table === 'spot_levels' || table === 'find_levels') {
    if (r.active === undefined) r.active = true;
    if (r.sort_order === undefined) r.sort_order = 0;
  }
  return r;
}

const nowIso = () => new Date().toISOString();

/** Rows made by older specs have no owner or visibility: they belong to the parent and are private. */
function normalize() {
  for (const t of CONTENT) {
    state[t] = state[t].map((r) => ({ owner_id: PARENT.id, visibility: 'private', ...r }));
  }
}

function createUser(email, password) {
  const u = { id: randomUUID(), email: String(email).toLowerCase(), password };
  users.set(u.id, u);
  state.profiles.push(profile(u, 'parent', { display_name: null, created_at: nowIso() })); // the sign-up trigger
  return u;
}

const bad = (res, message, code = 'P0001') => send(res, 400, { code, details: null, hint: null, message });

/** Stand-ins for the definer functions of the review migration: same effect on the in-memory rows, no real checks beyond the role. */
function rpc(req, res, name, args) {
  const me = bearerUser(req);
  const myRole = me && state.profiles.find((p) => p.user_id === me.id)?.role;
  if (!me) return bad(res, 'not_authenticated', '42501');
  if (name === 'storage_used') return send(res, 200, 0);
  if (name === 'media_in_use') return send(res, 200, false);
  const find = () => state[args.p_table]?.find((r) => String(r.id) === String(args.p_id));
  const setVis = (v) => {
    const row = find();
    if (!row) return false;
    row.visibility = v;
    return true;
  };
  const event = (action) => state.review_events.push({ id: randomUUID(), table_name: args.p_table, item_id: args.p_id, action, note: args.p_note ?? null, created_at: nowIso() });
  switch (name) {
    case 'share_item': {
      const row = find();
      if (!row || row.owner_id !== me.id || row.visibility !== 'private') return bad(res, 'not_shareable');
      row.visibility = 'pending';
      event('shared');
      return send(res, 200, null);
    }
    case 'request_edit':
      event('edit_requested');
      return send(res, 200, null);
    case 'review_approve': {
      // V8: the original goes back to private; the Super Admin gets a global copy that points at it.
      if (myRole !== 'super_admin') return bad(res, 'forbidden', '42501');
      const orig = find();
      if (!orig || orig.visibility !== 'pending') return bad(res, 'not_found');
      orig.visibility = 'private';
      const copy = { ...orig, id: randomUUID(), owner_id: me.id, visibility: 'global', source_id: orig.id, source_owner_id: orig.owner_id };
      state[args.p_table].push(copy);
      event(name);
      return send(res, 200, copy.id);
    }
    case 'publish_own': {
      if (myRole !== 'super_admin') return bad(res, 'forbidden', '42501');
      const row = find();
      if (!row || row.owner_id !== me.id || row.visibility !== 'private') return bad(res, 'not_found');
      row.visibility = 'global';
      event(name);
      return send(res, 200, null);
    }
    case 'review_reject':
    case 'unpublish_item':
    case 'delete_item': {
      if (myRole !== 'super_admin') return bad(res, 'forbidden', '42501');
      if (name === 'delete_item') state[args.p_table] = state[args.p_table].filter((r) => String(r.id) !== String(args.p_id));
      else if (!setVis('private')) return bad(res, 'not_found');
      event(name);
      return send(res, 200, null);
    }
    case 'ban_parent':
    case 'unban_parent':
    case 'set_quota': {
      if (myRole !== 'super_admin') return bad(res, 'forbidden', '42501');
      const p = state.profiles.find((x) => x.user_id === args.p_user && x.role === 'parent');
      if (!p) return bad(res, 'not_a_parent');
      if (name === 'ban_parent') Object.assign(p, { banned: true, ban_reason_code: args.p_code, ban_note: args.p_note ?? null, banned_at: nowIso() });
      else if (name === 'unban_parent') Object.assign(p, { banned: false, ban_reason_code: null, ban_note: null, banned_at: null });
      else p.quota_bytes = Number(args.p_bytes);
      return send(res, 200, null);
    }
    default:
      return bad(res, `stand-in: no rpc ${name}`);
  }
}

function rest(req, res, table, url, bodyBuf) {
  const params = url.searchParams;
  const prefer = req.headers.prefer ?? '';
  const single = (req.headers.accept ?? '').includes('application/vnd.pgrst.object+json');
  const wantRows = prefer.includes('return=representation');
  const rows = state[table];
  let match;
  try {
    match = matcher(params);
  } catch (e) {
    if (e instanceof Unsupported) return send(res, 501, { code: 'STANDIN501', details: null, hint: null, message: e.message });
    throw e;
  }
  const hasFilter = [...params.keys()].some((k) => !RESERVED.has(k));
  if ((req.method === 'PATCH' || req.method === 'DELETE') && !hasFilter) {
    return send(res, 400, { code: 'PGRST106', details: null, hint: null, message: `${req.method} requires a filter` });
  }

  const respond = (status, out) => {
    if (!wantRows && req.method !== 'GET') return send(res, status === 200 ? 204 : status);
    if (single) {
      if (out.length !== 1) {
        return send(res, 406, { code: 'PGRST116', details: `The result contains ${out.length} rows`, hint: null, message: 'JSON object requested, multiple (or no) rows returned' });
      }
      return send(res, status, out[0]);
    }
    return send(res, status, out, { 'Content-Range': `0-${Math.max(out.length - 1, 0)}/${out.length}` });
  };

  if (req.method === 'GET' || req.method === 'HEAD') {
    let out = applyOrder(rows.filter(match), params.get('order'));
    const off = Number(params.get('offset') ?? 0);
    if (off) out = out.slice(off);
    if (params.get('limit')) out = out.slice(0, Number(params.get('limit')));
    if (req.method === 'HEAD') return send(res, 200, undefined, { 'Content-Range': `0-${Math.max(out.length - 1, 0)}/${out.length}` });
    return respond(200, out);
  }

  const body = parseJson(bodyBuf);
  currentUserId = bearerUser(req)?.id ?? null;

  if (req.method === 'POST') {
    const incoming = Array.isArray(body) ? body : [body ?? {}];
    const merge = prefer.includes('resolution=merge-duplicates');
    const ignore = prefer.includes('resolution=ignore-duplicates');
    const conflictCols = (params.get('on_conflict') ?? 'id').split(',');
    const out = [];
    for (const r of incoming) {
      const idx = rows.findIndex((e) => conflictCols.every((c) => e[c] !== undefined && same(e[c], r[c])));
      if (idx >= 0 && (merge || ignore)) {
        if (merge) rows[idx] = { ...rows[idx], ...r }; // column defaults only apply to inserts, like Postgres
        out.push(rows[idx]);
      } else if (idx >= 0) {
        return send(res, 409, { code: '23505', details: null, hint: null, message: 'duplicate key value violates unique constraint' });
      } else {
        const created = withDefaults(table, r);
        if (table === 'children') {
          const norm = (n) => String(n).trim().replace(/\s+/g, ' ').toLowerCase();
          if (rows.some((c) => norm(c.child_name) === norm(created.child_name))) {
            return send(res, 409, { code: '23505', details: null, hint: null, message: 'duplicate key value violates unique constraint "children_child_name_key"' });
          }
          if (rows.filter((c) => c.parent_id === created.parent_id).length >= 5) return bad(res, 'too_many_children: a parent has at most 5 children', '23514');
          state.child_settings.push(childSettings(created.id)); // the create_child_settings trigger
        }
        rows.push(created);
        out.push(created);
      }
    }
    return respond(201, out);
  }

  if (req.method === 'PATCH') {
    const out = [];
    for (let i = 0; i < rows.length; i++) {
      if (match(rows[i])) { rows[i] = { ...rows[i], ...(body ?? {}) }; out.push(rows[i]); }
    }
    return respond(200, out);
  }

  if (req.method === 'DELETE') {
    const out = rows.filter(match);
    state[table] = rows.filter((r) => !out.includes(r));
    if (table === 'children') { // ON DELETE CASCADE
      const gone = new Set(out.map((c) => String(c.id)));
      state.child_settings = state.child_settings.filter((c) => !gone.has(String(c.child_id)));
    }
    if (table === 'card_groups') { // ON DELETE SET NULL
      const gone = new Set(out.map((g) => String(g.id)));
      state.memory_cards = state.memory_cards.map((c) => (c.group_id != null && gone.has(String(c.group_id)) ? { ...c, group_id: null } : c));
    }
    return respond(200, out);
  }

  return send(res, 405, { message: 'method not allowed' });
}

const server = createServer(async (req, res) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return send(res, 204);
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const path = url.pathname;
  const bodyBuf = await readBody(req);

  try {
    if (path === '/__reset' && req.method === 'POST') {
      const { storage = [], ...rows } = parseJson(bodyBuf) ?? {};
      state = { ...defaultState(), ...rows };
      resetUsers();
      normalize();
      files.clear();
      for (const p of storage) files.set(p, { type: 'application/octet-stream', body: Buffer.alloc(0) }); // files already in the bucket
      return send(res, 200, { ok: true });
    }
    if (path === '/__state') return send(res, 200, { ...state, storage: [...files.keys()] });

    if (path === '/auth/v1/token' && req.method === 'POST') {
      const grant = url.searchParams.get('grant_type');
      const body = parseJson(bodyBuf) ?? {};
      if (grant === 'password') {
        const u = [...users.values()].find((x) => x.email === String(body.email).toLowerCase() && x.password === body.password);
        if (u) return send(res, 200, issueSession(u));
      }
      if (grant === 'refresh_token' && typeof body.refresh_token === 'string') {
        const id = /^refresh-([0-9a-f-]{36})-/.exec(body.refresh_token)?.[1];
        if (id && users.has(id)) return send(res, 200, issueSession(users.get(id)));
      }
      return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    }
    if (path === '/auth/v1/user' && req.method === 'GET') {
      const u = bearerUser(req);
      if (!u) return send(res, 401, { code: 401, error_code: 'bad_jwt', msg: 'invalid JWT' });
      return send(res, 200, authUser(u));
    }
    if (path === '/auth/v1/logout') return send(res, 204);
    if (path === '/auth/v1/signup' && req.method === 'POST') {
      const body = parseJson(bodyBuf) ?? {};
      if ([...users.values()].some((x) => x.email === String(body.email).toLowerCase())) {
        return send(res, 422, { code: 422, error_code: 'user_already_exists', msg: 'User already registered' });
      }
      const u = createUser(body.email, body.password);
      return send(res, 200, authUser(u)); // confirmed already; no session, like a project that needs email confirmation
    }
    if (path === '/auth/v1/admin/users' && req.method === 'POST') {
      const body = parseJson(bodyBuf) ?? {};
      if ([...users.values()].some((x) => x.email === String(body.email).toLowerCase())) {
        return send(res, 422, { code: 422, error_code: 'email_exists', msg: 'A user with this email address has already been registered' });
      }
      return send(res, 200, authUser(createUser(body.email, body.password)));
    }
    const adminDel = /^\/auth\/v1\/admin\/users\/([0-9a-f-]+)$/.exec(path);
    if (adminDel && req.method === 'DELETE') {
      users.delete(adminDel[1]);
      state.profiles = state.profiles.filter((p) => p.user_id !== adminDel[1]);
      return send(res, 200, {});
    }

    const rpcM = /^\/rest\/v1\/rpc\/([a-z_]+)$/.exec(path);
    if (rpcM && req.method === 'POST') return rpc(req, res, rpcM[1], parseJson(bodyBuf) ?? {});

    const m = /^\/rest\/v1\/([a-z_]+)$/.exec(path);
    if (m && TABLES.includes(m[1])) return rest(req, res, m[1], url, bodyBuf);

    if (path === '/storage/v1/object/media' && req.method === 'DELETE') {
      const prefixes = parseJson(bodyBuf)?.prefixes ?? [];
      for (const p of prefixes) files.delete(p);
      return send(res, 200, prefixes.map((name) => ({ name })));
    }
    if (path === '/storage/v1/object/list/media' && req.method === 'POST') {
      // the folder listing the media library uses: files directly under `prefix`, and one entry per sub-folder (id null)
      const { prefix = '', limit = 100, offset = 0 } = parseJson(bodyBuf) ?? {};
      const base = prefix ? `${prefix}/` : '';
      const seen = new Map();
      for (const key of files.keys()) {
        if (!key.startsWith(base)) continue;
        const rest = key.slice(base.length);
        const slash = rest.indexOf('/');
        if (slash < 0) seen.set(rest, { name: rest, id: randomUUID() });
        else seen.set(rest.slice(0, slash), { name: rest.slice(0, slash), id: null });
      }
      return send(res, 200, [...seen.values()].slice(offset, offset + limit));
    }
    const up = /^\/storage\/v1\/object\/media\/(.+)$/.exec(path);
    if (up && (req.method === 'POST' || req.method === 'PUT')) {
      const p = decodeURIComponent(up[1]);
      files.set(p, parseUpload(req.headers['content-type'], bodyBuf));
      return send(res, 200, { Key: `media/${p}`, Id: randomUUID() });
    }
    const pub = /^\/storage\/v1\/object\/public\/media\/(.+)$/.exec(path);
    if (pub && req.method === 'GET') {
      const f = files.get(decodeURIComponent(pub[1]));
      if (!f) return send(res, 404, { message: 'not found' });
      return send(res, 200, f.body, { 'Content-Type': f.type });
    }
  } catch (e) {
    return send(res, 500, { message: String(e) });
  }
  return send(res, 404, { message: `stand-in: no route for ${req.method} ${path}` });
});

server.listen(PORT, '127.0.0.1', () => console.log(`stand-in Supabase on http://127.0.0.1:${PORT}`));
