'use strict';
console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'info', message: `server.js loading (node ${process.version}, PORT=${process.env.PORT || 'unset'}, main=${require.main === module})` }));
process.env.TZ = 'Asia/Kolkata';

const path = require('path');
const express = require('express');
const db = require('./src/db');
const { ensureSchema } = require('./src/schema');
const seed = require('./src/seed');
const auth = require('./src/auth');
const fms = require('./src/fms');

const PORT = process.env.PORT || 3000;
const log = (level, message, extra) => console.log(JSON.stringify(Object.assign({ timestamp: new Date().toISOString(), level, message }, extra || {})));
process.on('unhandledRejection', (e) => log('error', 'unhandledRejection: ' + (e && e.message ? e.message : String(e))));
process.on('uncaughtException', (e) => { log('error', 'uncaughtException: ' + (e && e.stack ? e.stack : String(e))); });

const state = { db: 'starting', error: null, attempts: 0, since: new Date().toISOString(), readyAt: null };

async function connectWithRetry() {
  for (;;) {
    state.attempts++;
    try {
      await db.init();
      await ensureSchema();
      await seed.run();
      state.db = 'ready'; state.error = null; state.readyAt = new Date().toISOString();
      log('info', `database ready (driver=${db.driver}) after ${state.attempts} attempt(s)`);
      fms.computeFlags().catch((e) => log('error', 'computeFlags: ' + e.message));
      setInterval(() => fms.computeFlags().catch((e) => log('error', 'computeFlags: ' + e.message)), 10 * 60 * 1000);
      return;
    } catch (e) {
      state.db = 'error'; state.error = String(e && e.message ? e.message : e).replace(/password[^\s,]*/gi, 'password=***');
      log('error', `database init failed (attempt ${state.attempts}): ${state.error}`);
      await new Promise((r) => setTimeout(r, Math.min(15000 * state.attempts, 60000)));
    }
  }
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use((req, res, next) => { res.setHeader('X-Frame-Options', 'SAMEORIGIN'); res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });

app.get('/api/health', (req, res) => res.status(state.db === 'ready' ? 200 : 503).json({ ok: state.db === 'ready', db: state.db, driver: db.driver, attempts: state.attempts, error: state.error, since: state.since, readyAt: state.readyAt, time: db.fmtDateTime(new Date()), node: process.version }));

// Everything under /api waits for the database.
app.use('/api', (req, res, next) => {
  if (state.db === 'ready') return next();
  res.status(503).json({ error: state.db === 'error' ? `Database not available yet: ${state.error}` : 'Starting up, please retry in a few seconds', db: state.db });
});
app.use(auth.attach);
auth.routes(app);
app.use('/api', require('./src/routes/entities'));
app.use('/api', require('./src/routes/ops').router);
app.use('/api', require('./src/routes/import').router);
app.use('/api/analytics', require('./src/routes/analytics').router);

app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));
app.get(/^\/(?!api\/).*/, (req, res) => {
  if (state.db !== 'ready') {
    return res.status(503).send(`<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="10"><title>SSPACIA Sales Autopilot — starting</title><body style="font-family:sans-serif;max-width:640px;margin:60px auto;color:#1b2430"><h2>SSPACIA Sales Autopilot is starting…</h2><p>Database status: <b>${state.db}</b> (attempt ${state.attempts}).</p>${state.error ? `<p style="color:#b00">Last error: ${String(state.error).replace(/[<>&]/g, '')}</p><p>If this persists, check the database environment variables (DB_HOST, DB_NAME, DB_USER, DB_PASSWORD) in Hostinger → Node.js → Environment variables.</p>` : ''}<p>This page refreshes automatically.</p></body>`);
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  log('error', 'request error: ' + (err && err.message ? err.message : String(err)));
  res.status(500).json({ error: 'Something went wrong' });
});

connectWithRetry();

// Run directly (node server.js) → listen. Imported by a host runtime (Hostinger / Passenger) → export the app.
if (require.main === module || process.env.PORT) {
  const server = app.listen(PORT, () => log('info', `SSPACIA Sales Autopilot listening on ${PORT}`));
  server.on('error', (e) => log('error', `listen failed on ${PORT}: ${e.message}`));
}

module.exports = app;
