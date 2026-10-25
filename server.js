'use strict';
process.env.TZ = 'Asia/Kolkata';

const path = require('path');
const express = require('express');
const db = require('./src/db');
const { ensureSchema } = require('./src/schema');
const seed = require('./src/seed');
const auth = require('./src/auth');
const fms = require('./src/fms');

const PORT = process.env.PORT || 3000;

async function main() {
  await db.init();
  await ensureSchema();
  await seed.run();

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', true);
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => { res.setHeader('X-Frame-Options', 'SAMEORIGIN'); res.setHeader('X-Content-Type-Options', 'nosniff'); next(); });
  app.use(auth.attach);

  app.get('/api/health', (req, res) => res.json({ ok: true, driver: db.driver, time: db.fmtDateTime(new Date()) }));
  auth.routes(app);
  app.use('/api', require('./src/routes/entities'));
  app.use('/api', require('./src/routes/ops').router);
  app.use('/api', require('./src/routes/import').router);
  app.use('/api/analytics', require('./src/routes/analytics').router);

  app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h', etag: true }));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  });

  // red-flag engine: every 10 minutes
  setInterval(() => fms.computeFlags().catch((e) => console.error('computeFlags', e.message)), 10 * 60 * 1000);
  fms.computeFlags().catch(() => {});

  app.listen(PORT, () => console.log(`SSPACIA Sales Autopilot listening on :${PORT} (db=${db.driver})`));
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
