'use strict';
const db = require('./db');
const { E } = require('./entities');

const LABEL_FIELD = {
  users: 'name', centres: 'name', products: 'name', lead_sources: 'name', clients: 'company',
  leads: 'client_name', golden_segments: 'name', golden_clients: 'company', lead_gen_channels: 'name',
  lost_reasons: 'reason', fms_stage_defs: 'name', proposals: 'id',
};

function fieldMap(def) {
  const m = {};
  for (const f of def.fields) m[f.name] = f;
  return m;
}

function coerce(f, v) {
  if (v === undefined) return undefined;
  if (v === '' || v === null) return null;
  switch (f.type) {
    case 'int':
    case 'ref': { const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; }
    case 'decimal':
    case 'money':
    case 'pct': { const n = parseFloat(String(v).replace(/[,₹\s]/g, '')); return Number.isNaN(n) ? null : n; }
    case 'bool': return (v === true || v === 1 || v === '1' || v === 'true' || v === 'on') ? 1 : 0;
    case 'date': return db.fmtDate(String(v));
    case 'datetime': return db.fmtDateTime(String(v));
    case 'json': return typeof v === 'string' ? v : JSON.stringify(v);
    default: return typeof v === 'string' ? v.trim() : String(v);
  }
}

/** Validate + coerce an incoming body against the entity definition. Returns {data, errors}. */
function clean(def, body, { partial = false } = {}) {
  const data = {};
  const errors = [];
  for (const f of def.fields) {
    if (f.type === 'password') continue;
    if (!(f.name in body)) {
      if (!partial && f.required && !f.readonly && f.default === undefined) errors.push(`${f.label} is required`);
      continue;
    }
    const v = coerce(f, body[f.name]);
    if (f.required && !f.readonly && (v === null || v === '') && f.default === undefined) errors.push(`${f.label} is required`);
    if (f.type === 'select' && v && f.options && !f.options.includes(v) && !(f.options.includes('') && v === '')) errors.push(`${f.label}: '${v}' is not an allowed value`);
    data[f.name] = v;
  }
  return { data, errors };
}

function applyDefaults(def, data) {
  for (const f of def.fields) {
    if (f.type === 'password') continue;
    if (data[f.name] === undefined || data[f.name] === null) {
      if (f.default === 'now') data[f.name] = db.fmtDateTime(new Date());
      else if (f.default === 'today') data[f.name] = db.today();
      else if (f.default !== undefined) data[f.name] = f.default;
    }
  }
  return data;
}

/** Build SELECT with label joins for ref fields. */
function selectSql(def, alias = 't') {
  const cols = [`${alias}.*`];
  const joins = [];
  let j = 0;
  for (const f of def.fields) {
    if (f.type === 'ref' && E[f.ref]) {
      j++;
      const lf = LABEL_FIELD[f.ref] || 'name';
      cols.push(`r${j}.\`${lf}\` AS \`${f.name}_label\``);
      joins.push(`LEFT JOIN \`${f.ref}\` r${j} ON r${j}.id = ${alias}.\`${f.name}\``);
    }
  }
  return { cols: cols.join(', '), joins: joins.join(' ') };
}

async function list(entity, opts = {}) {
  const def = E[entity];
  if (!def) throw new Error('Unknown entity ' + entity);
  const fm = fieldMap(def);
  const { cols, joins } = selectSql(def);
  const where = [];
  const params = [];
  for (const [k, v] of Object.entries(opts.filters || {})) {
    const m = k.match(/^(\w+?)(?:__(gte|lte|gt|lt|ne|like|in|null|notnull))?$/);
    if (!m || !fm[m[1]]) continue;
    const col = `t.\`${m[1]}\``;
    const op = m[2];
    if (op === 'null') where.push(`(${col} IS NULL OR ${col} = '')`);
    else if (op === 'notnull') where.push(`${col} IS NOT NULL AND ${col} <> ''`);
    else if (op === 'in') { const arr = String(v).split(','); where.push(`${col} IN (${arr.map(() => '?').join(',')})`); params.push(...arr); }
    else if (op === 'like') { where.push(`${col} LIKE ?`); params.push(`%${v}%`); }
    else if (op === 'gte') { where.push(`${col} >= ?`); params.push(v); }
    else if (op === 'lte') { where.push(`${col} <= ?`); params.push(v); }
    else if (op === 'gt') { where.push(`${col} > ?`); params.push(v); }
    else if (op === 'lt') { where.push(`${col} < ?`); params.push(v); }
    else if (op === 'ne') { where.push(`${col} <> ?`); params.push(v); }
    else { where.push(`${col} = ?`); params.push(v); }
  }
  if (opts.search && (def.searchFields || []).length) {
    const sf = def.searchFields.map((c) => `t.\`${c}\` LIKE ?`);
    where.push(`(${sf.join(' OR ')})`);
    def.searchFields.forEach(() => params.push(`%${opts.search}%`));
  }
  if (opts.whereSql) { where.push(opts.whereSql); params.push(...(opts.whereParams || [])); }
  let order = def.orderBy || 'id';
  if (opts.sort && fm[opts.sort.replace(/^-/, '')]) {
    const col = opts.sort.replace(/^-/, '');
    order = `t.\`${col}\` ${opts.sort.startsWith('-') ? 'DESC' : 'ASC'}`;
  } else {
    order = order.split(',').map((p) => { const [c, d] = p.trim().split(/\s+/); return `t.\`${c}\`${d ? ' ' + d : ''}`; }).join(', ');
  }
  const limit = Math.min(parseInt(opts.limit || 500, 10) || 500, 5000);
  const offset = parseInt(opts.offset || 0, 10) || 0;
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = await db.query(`SELECT ${cols} FROM \`${def.table}\` t ${joins} ${whereSql} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`, params);
  const total = await db.scalar(`SELECT COUNT(*) AS n FROM \`${def.table}\` t ${whereSql}`, params);
  for (const h of def.hiddenFields || []) rows.forEach((r) => delete r[h]);
  return { rows, total: Number(total), limit, offset };
}

async function get(entity, id) {
  const def = E[entity];
  const { cols, joins } = selectSql(def);
  const row = await db.one(`SELECT ${cols} FROM \`${def.table}\` t ${joins} WHERE t.id = ?`, [id]);
  if (row) for (const h of def.hiddenFields || []) delete row[h];
  return row;
}

async function insert(entity, data) {
  const def = E[entity];
  const d = applyDefaults(def, Object.assign({}, data));
  const now = db.fmtDateTime(new Date());
  d.created_at = d.created_at || now;
  d.updated_at = now;
  const keys = Object.keys(d).filter((k) => d[k] !== undefined);
  const sql = `INSERT INTO \`${def.table}\` (${keys.map((k) => `\`${k}\``).join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`;
  const res = await db.exec(sql, keys.map((k) => d[k]));
  return res.insertId;
}

async function update(entity, id, data) {
  const def = E[entity];
  const d = Object.assign({}, data, { updated_at: db.fmtDateTime(new Date()) });
  delete d.id; delete d.created_at;
  const keys = Object.keys(d).filter((k) => d[k] !== undefined);
  if (!keys.length) return 0;
  const sql = `UPDATE \`${def.table}\` SET ${keys.map((k) => `\`${k}\` = ?`).join(', ')} WHERE id = ?`;
  const res = await db.exec(sql, [...keys.map((k) => d[k]), id]);
  return res.affectedRows;
}

async function remove(entity, id) {
  const def = E[entity];
  const res = await db.exec(`DELETE FROM \`${def.table}\` WHERE id = ?`, [id]);
  return res.affectedRows;
}

/* ---------- settings ---------- */
const settingsCache = new Map();
async function getSetting(key, fallback) {
  if (settingsCache.has(key)) return settingsCache.get(key);
  const row = await db.one('SELECT svalue FROM settings WHERE skey = ?', [key]);
  let v = fallback;
  if (row && row.svalue !== null && row.svalue !== undefined) {
    try { v = JSON.parse(row.svalue); } catch (_) { v = row.svalue; }
  }
  settingsCache.set(key, v);
  return v;
}
async function setSetting(key, value) {
  const existing = await db.one('SELECT id FROM settings WHERE skey = ?', [key]);
  const now = db.fmtDateTime(new Date());
  if (existing) await db.exec('UPDATE settings SET svalue = ?, updated_at = ? WHERE skey = ?', [JSON.stringify(value), now, key]);
  else await db.exec('INSERT INTO settings (skey, svalue, created_at, updated_at) VALUES (?, ?, ?, ?)', [key, JSON.stringify(value), now, now]);
  settingsCache.set(key, value);
}
async function allSettings() {
  const rows = await db.query('SELECT skey, svalue FROM settings', []);
  const out = {};
  for (const r of rows) { try { out[r.skey] = JSON.parse(r.svalue); } catch (_) { out[r.skey] = r.svalue; } }
  return out;
}

async function logActivity(userId, action, module, recordId, summary, data) {
  try {
    await insert('activity_log', { user_id: userId || null, action, module, record_id: recordId || null, summary: summary || null, data: data ? JSON.stringify(data).slice(0, 20000) : null });
  } catch (e) { /* never block on audit */ }
}

module.exports = { list, get, insert, update, remove, clean, applyDefaults, getSetting, setSetting, allSettings, logActivity, LABEL_FIELD, fieldMap };
