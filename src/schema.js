'use strict';
const db = require('./db');
const { E } = require('./entities');

const UNIQUE = {
  leads: ['enq_no'],
  users: ['email'],
  sessions: ['token'],
  settings: ['skey'],
  fms_stage_defs: [['flow', 'code']],
  products: ['code'],
  centres: ['code'],
  lead_sources: ['code'],
  msg_templates: ['code'],
  dsr: [['date', 'user_id']],
  weekly_reviews: ['week_start'],
  plan_year: ['month'],
  inventory: [['centre_id', 'product_id']],
};

function colType(f) {
  const my = db.driver === 'mysql';
  switch (f.type) {
    case 'string': return my ? 'VARCHAR(255)' : 'TEXT';
    case 'text':
    case 'json': return my ? 'TEXT' : 'TEXT';
    case 'int':
    case 'ref': return my ? 'INT' : 'INTEGER';
    case 'decimal':
    case 'money':
    case 'pct': return my ? 'DECIMAL(14,2)' : 'REAL';
    case 'date': return my ? 'DATE' : 'TEXT';
    case 'datetime': return my ? 'DATETIME' : 'TEXT';
    case 'bool': return my ? 'TINYINT(1)' : 'INTEGER';
    case 'select': return my ? 'VARCHAR(100)' : 'TEXT';
    default: return 'TEXT';
  }
}

function physicalFields(def) {
  const cols = def.fields.filter((f) => f.type !== 'password').map((f) => ({ name: f.name, type: f.type }));
  for (const c of def.extraColumns || []) cols.push(c);
  return cols;
}

function createTableSql(def) {
  const my = db.driver === 'mysql';
  const lines = [my ? '`id` INT AUTO_INCREMENT PRIMARY KEY' : '`id` INTEGER PRIMARY KEY AUTOINCREMENT'];
  for (const c of physicalFields(def)) lines.push(`\`${c.name}\` ${colType(c)} NULL`);
  lines.push(`\`created_at\` ${my ? 'DATETIME' : 'TEXT'} NULL`);
  lines.push(`\`updated_at\` ${my ? 'DATETIME' : 'TEXT'} NULL`);
  for (const u of UNIQUE[def.table] || []) {
    const cols = Array.isArray(u) ? u : [u];
    lines.push(`UNIQUE (${cols.map((c) => `\`${c}\``).join(', ')})`);
  }
  return `CREATE TABLE IF NOT EXISTS \`${def.table}\` (\n  ${lines.join(',\n  ')}\n)${my ? ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4' : ''}`;
}

async function existingColumns(table) {
  if (db.driver === 'mysql') {
    const rows = await db.query('SELECT COLUMN_NAME AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?', [table]);
    return new Set(rows.map((r) => r.c));
  }
  const rows = await db.query(`PRAGMA table_info(\`${table}\`)`);
  return new Set(rows.map((r) => r.name));
}

async function ensureIndex(table, col) {
  const name = `ix_${table}_${col}`;
  if (db.driver === 'mysql') {
    const rows = await db.query('SELECT 1 AS x FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?', [table, name]);
    if (rows.length) return;
    await db.exec(`CREATE INDEX \`${name}\` ON \`${table}\` (\`${col}\`)`);
  } else {
    await db.exec(`CREATE INDEX IF NOT EXISTS \`${name}\` ON \`${table}\` (\`${col}\`)`);
  }
}

/** Create missing tables / columns / indexes (idempotent, runs at every boot). */
async function ensureSchema() {
  for (const def of Object.values(E)) {
    await db.exec(createTableSql(def), []);
    const have = await existingColumns(def.table);
    for (const c of physicalFields(def)) {
      if (!have.has(c.name)) await db.exec(`ALTER TABLE \`${def.table}\` ADD COLUMN \`${c.name}\` ${colType(c)} NULL`, []);
    }
    for (const f of def.fields) {
      if (f.type === 'ref' || ['stage', 'status', 'planned_at', 'next_call_due', 'enq_at', 'at', 'date', 'month', 'flow'].includes(f.name)) {
        await ensureIndex(def.table, f.name);
      }
    }
  }
}

module.exports = { ensureSchema, createTableSql };
