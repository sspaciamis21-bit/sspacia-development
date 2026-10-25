'use strict';
const crypto = require('crypto');
const db = require('./db');
const repo = require('./repo');

const COOKIE = 'ssa_session';
const SESSION_DAYS = 14;

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}
function verifyPassword(pw, stored) {
  if (!stored || !stored.startsWith('scrypt$')) return false;
  const [, salt, hash] = stored.split('$');
  const test = crypto.scryptSync(String(pw), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}

function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || '';
  raw.split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

async function createSession(userId, req) {
  const token = crypto.randomBytes(32).toString('hex');
  const exp = new Date(Date.now() + SESSION_DAYS * 86400000);
  await repo.insert('sessions', { token, user_id: userId, expires_at: db.fmtDateTime(exp), user_agent: (req.headers['user-agent'] || '').slice(0, 250) });
  return token;
}

function setCookie(res, token, req) {
  const secure = (req.headers['x-forwarded-proto'] || req.protocol) === 'https';
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure ? '; Secure' : ''}`);
}
function clearCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

async function userFromRequest(req) {
  const token = parseCookies(req)[COOKIE];
  if (!token) return null;
  const s = await db.one('SELECT * FROM sessions WHERE token = ?', [token]);
  if (!s) return null;
  if (db.parseDateTime(s.expires_at) < new Date()) { await db.exec('DELETE FROM sessions WHERE id = ?', [s.id]); return null; }
  const u = await db.one('SELECT id, name, email, mobile, role, centre_id, is_active FROM users WHERE id = ?', [s.user_id]);
  if (!u || !u.is_active) return null;
  return u;
}

/** Attach req.user when a valid session exists. */
async function attach(req, res, next) {
  try { req.user = await userFromRequest(req); } catch (e) { req.user = null; }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Please sign in' });
  next();
}
function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Please sign in' });
    if (req.user.role === 'admin' || roles.includes(req.user.role)) return next();
    return res.status(403).json({ error: 'Your role is not allowed to do this' });
  };
}

async function needsSetup() {
  const n = await db.scalar("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND password_hash IS NOT NULL AND password_hash <> ''", []);
  return Number(n) === 0;
}

function routes(app) {
  app.get('/api/auth/status', async (req, res) => {
    res.json({ needsSetup: await needsSetup(), user: req.user || null });
  });

  // First-run setup: creates (or claims) the Executive account. Only works while no admin password exists.
  app.post('/api/auth/setup', async (req, res) => {
    try {
      if (!(await needsSetup())) return res.status(403).json({ error: 'Setup already completed. Please sign in.' });
      const { name, email, mobile, password } = req.body || {};
      if (!name || !email || !password) return res.status(400).json({ error: 'Name, e-mail and password are required' });
      if (String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
      const existing = await db.one('SELECT id FROM users WHERE email = ?', [String(email).trim().toLowerCase()]);
      let userId;
      const hash = hashPassword(password);
      if (existing) {
        await repo.update('users', existing.id, { name, mobile: mobile || null, role: 'admin', password_hash: hash, is_active: 1 });
        userId = existing.id;
      } else {
        // if a seeded admin placeholder exists (no password), take it over
        const seeded = await db.one("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1", []);
        if (seeded) {
          await repo.update('users', seeded.id, { name, email: String(email).trim().toLowerCase(), mobile: mobile || null, password_hash: hash, is_active: 1 });
          userId = seeded.id;
        } else {
          userId = await repo.insert('users', { name, email: String(email).trim().toLowerCase(), mobile: mobile || null, role: 'admin', password_hash: hash, is_active: 1 });
        }
      }
      const token = await createSession(userId, req);
      setCookie(res, token, req);
      await repo.update('users', userId, { last_login_at: db.fmtDateTime(new Date()) });
      await repo.logActivity(userId, 'SETUP', 'auth', userId, 'Executive account created');
      res.json({ ok: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body || {};
      const u = await db.one('SELECT * FROM users WHERE email = ?', [String(email || '').trim().toLowerCase()]);
      if (!u || !u.is_active || !verifyPassword(password || '', u.password_hash)) {
        await new Promise((r) => setTimeout(r, 400));
        return res.status(401).json({ error: 'Invalid e-mail or password' });
      }
      const token = await createSession(u.id, req);
      setCookie(res, token, req);
      await repo.update('users', u.id, { last_login_at: db.fmtDateTime(new Date()) });
      res.json({ ok: true, user: { id: u.id, name: u.name, role: u.role } });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });

  app.post('/api/auth/logout', async (req, res) => {
    const token = parseCookies(req)[COOKIE];
    if (token) await db.exec('DELETE FROM sessions WHERE token = ?', [token]);
    clearCookie(res);
    res.json({ ok: true });
  });

  app.post('/api/auth/change-password', requireAuth, async (req, res) => {
    const { current, password } = req.body || {};
    const u = await db.one('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!verifyPassword(current || '', u.password_hash)) return res.status(400).json({ error: 'Current password is wrong' });
    if (String(password || '').length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
    await repo.update('users', u.id, { password_hash: hashPassword(password) });
    res.json({ ok: true });
  });
}

module.exports = { hashPassword, verifyPassword, attach, requireAuth, requireRole, routes, needsSetup };
