'use strict';
const express = require('express');
const db = require('../db');
const repo = require('../repo');
const fms = require('../fms');
const auth = require('../auth');
const { E } = require('../entities');
const hooks = require('../hooks');

const router = express.Router();

function canRead(def, user) {
  if (!def || def.hidden && def.roles.read.length === 0) return false;
  if (!user) return false;
  return user.role === 'admin' || def.roles.read.includes(user.role);
}
function canWrite(def, user) {
  if (!def || !user) return false;
  return user.role === 'admin' || def.roles.write.includes(user.role);
}

/** Metadata for the UI (fields, options, permissions) */
router.get('/meta', (req, res) => {
  const out = {};
  for (const [name, def] of Object.entries(E)) {
    if (def.hidden && def.roles.read.length === 0) continue;
    out[name] = {
      name, label: def.label, plural: def.plural, group: def.group, icon: def.icon, hidden: !!def.hidden,
      fields: def.fields.map((f) => Object.assign({}, f)),
      searchFields: def.searchFields || [], createFields: def.createFields || null,
      canRead: canRead(def, req.user), canWrite: canWrite(def, req.user),
    };
  }
  res.json(out);
});

/** Reference options for dropdowns */
router.get('/options/:entity', auth.requireAuth, async (req, res) => {
  const def = E[req.params.entity];
  if (!def) return res.status(404).json({ error: 'Unknown entity' });
  const lf = repo.LABEL_FIELD[def.name] || 'name';
  const activeCol = def.fields.find((f) => f.name === 'is_active') ? ' WHERE is_active = 1 OR is_active IS NULL' : '';
  const extra = def.name === 'leads' ? ', enq_no, company, stage' : (def.name === 'users' ? ', role, centre_id' : (def.name === 'clients' ? ', centre_id, status' : ''));
  const rows = await db.query(`SELECT id, \`${lf}\` AS label${extra} FROM \`${def.table}\`${activeCol} ORDER BY \`${lf}\` LIMIT 2000`, []);
  res.json(rows);
});

router.get('/e/:entity', auth.requireAuth, async (req, res) => {
  const def = E[req.params.entity];
  if (!canRead(def, req.user)) return res.status(403).json({ error: 'Not allowed' });
  try {
    const q = req.query || {};
    const filters = {};
    for (const [k, v] of Object.entries(q)) if (!['search', 'sort', 'limit', 'offset'].includes(k)) filters[k] = v;
    const out = await repo.list(def.name, { filters, search: q.search, sort: q.sort, limit: q.limit, offset: q.offset });
    res.json(out);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/e/:entity/export.csv', auth.requireAuth, async (req, res) => {
  const def = E[req.params.entity];
  if (!canRead(def, req.user)) return res.status(403).json({ error: 'Not allowed' });
  const { rows } = await repo.list(def.name, { limit: 5000, filters: req.query });
  const cols = ['id', ...def.fields.filter((f) => f.type !== 'password').map((f) => f.name), 'created_at', 'updated_at'];
  const esc = (v) => { if (v === null || v === undefined) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [cols.join(',')];
  for (const r of rows) lines.push(cols.map((c) => esc(r[c + '_label'] !== undefined && r[c + '_label'] !== null ? r[c + '_label'] : r[c])).join(','));
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${def.name}-${db.today()}.csv"`);
  res.send('﻿' + lines.join('\n'));
});

router.get('/e/:entity/:id', auth.requireAuth, async (req, res) => {
  const def = E[req.params.entity];
  if (!canRead(def, req.user)) return res.status(403).json({ error: 'Not allowed' });
  const row = await repo.get(def.name, req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  res.json(row);
});

router.post('/e/:entity', auth.requireAuth, async (req, res) => {
  const def = E[req.params.entity];
  if (!canWrite(def, req.user)) return res.status(403).json({ error: 'Not allowed' });
  try {
    const { data, errors } = repo.clean(def, req.body || {});
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });
    if (hooks.beforeCreate[def.name]) await hooks.beforeCreate[def.name](data, req);
    const id = await repo.insert(def.name, data);
    if (hooks.afterCreate[def.name]) await hooks.afterCreate[def.name](id, data, req);
    await repo.logActivity(req.user.id, 'CREATE', def.name, id, summary(def, data));
    res.json({ data: await repo.get(def.name, id), message: `${def.label} created` });
  } catch (e) { res.status(400).json({ error: friendly(e) }); }
});

router.put('/e/:entity/:id', auth.requireAuth, async (req, res) => {
  const def = E[req.params.entity];
  if (!canWrite(def, req.user)) return res.status(403).json({ error: 'Not allowed' });
  try {
    const before = await repo.get(def.name, req.params.id);
    if (!before) return res.status(404).json({ error: 'Not found' });
    const { data, errors } = repo.clean(def, req.body || {}, { partial: true });
    if (errors.length) return res.status(400).json({ error: errors.join('; ') });
    if (hooks.beforeUpdate[def.name]) await hooks.beforeUpdate[def.name](before, data, req);
    await repo.update(def.name, before.id, data);
    if (hooks.afterUpdate[def.name]) await hooks.afterUpdate[def.name](before, data, req);
    await repo.logActivity(req.user.id, 'UPDATE', def.name, before.id, summary(def, data), { changed: Object.keys(data) });
    res.json({ data: await repo.get(def.name, before.id), message: `${def.label} updated` });
  } catch (e) { res.status(400).json({ error: friendly(e) }); }
});

router.delete('/e/:entity/:id', auth.requireAuth, async (req, res) => {
  const def = E[req.params.entity];
  if (!canWrite(def, req.user)) return res.status(403).json({ error: 'Not allowed' });
  if (['leads', 'clients', 'users'].includes(def.name) && req.user.role !== 'admin') return res.status(403).json({ error: 'Only the Executive can delete this record' });
  try {
    if (hooks.beforeDelete[def.name]) await hooks.beforeDelete[def.name](req.params.id, req);
    const n = await repo.remove(def.name, req.params.id);
    await repo.logActivity(req.user.id, 'DELETE', def.name, req.params.id, 'deleted');
    res.json({ ok: n > 0 });
  } catch (e) { res.status(400).json({ error: friendly(e) }); }
});

function summary(def, data) {
  const lf = repo.LABEL_FIELD[def.name] || 'name';
  return data[lf] ? String(data[lf]).slice(0, 120) : null;
}
function friendly(e) {
  const m = String(e.message || e);
  if (/UNIQUE|Duplicate entry/i.test(m)) return 'A record with the same unique value already exists';
  return m;
}

module.exports = router;
