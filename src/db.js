'use strict';
/**
 * Dialect-agnostic database layer.
 *  - Production (Hostinger): MySQL via mysql2, credentials from the environment
 *    (DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD or DATABASE_URL — written by
 *    Hostinger's "Setup website database").
 *  - Local development / tests: SQLite via node:sqlite (DB_DRIVER=sqlite, DB_FILE=...).
 *
 * All dates are stored as naive strings: DATE 'YYYY-MM-DD', DATETIME 'YYYY-MM-DD HH:MM:SS'
 * in Asia/Kolkata (process.env.TZ is pinned in server.js), so values never shift.
 */

const driver = process.env.DB_DRIVER || ((process.env.DATABASE_URL || process.env.DB_HOST) ? 'mysql' : 'sqlite');

let pool = null;   // mysql2 pool
let sqlite = null; // node:sqlite DatabaseSync

function fixHost(h) { return !h || h === 'localhost' ? '127.0.0.1' : h; }
function mysqlConfigFromEnv() {
  if (process.env.DB_HOST || process.env.DB_NAME) {
    return {
      host: fixHost(process.env.DB_HOST),
      port: Number(process.env.DB_PORT || 3306),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    };
  }
  const u = new URL(process.env.DATABASE_URL);
  return {
    host: fixHost(u.hostname),
    port: Number(u.port || 3306),
    database: decodeURIComponent(u.pathname.replace(/^\//, '')),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
  };
}

async function init() {
  if (driver === 'mysql') {
    const mysql = require('mysql2/promise');
    const cfg = mysqlConfigFromEnv();
    pool = mysql.createPool({
      ...cfg,
      waitForConnections: true,
      connectionLimit: 8,
      dateStrings: true,
      charset: 'utf8mb4',
      timezone: '+05:30',
      namedPlaceholders: false,
      decimalNumbers: true,
    });
    // fail fast with a clear message
    const conn = await pool.getConnection();
    try { await conn.query("SET time_zone = '+05:30'"); } catch (_) { /* optional */ }
    conn.release();
  } else {
    const { DatabaseSync } = require('node:sqlite');
    const file = process.env.DB_FILE || './dev.sqlite';
    sqlite = new DatabaseSync(file);
    sqlite.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  }
  return module.exports;
}

function normaliseParams(params) {
  return (params || []).map((p) => {
    if (p === undefined) return null;
    if (p instanceof Date) return fmtDateTime(p);
    if (typeof p === 'boolean') return p ? 1 : 0;
    if (typeof p === 'object' && p !== null) return JSON.stringify(p);
    return p;
  });
}

/** SELECT → array of plain objects */
async function query(sql, params) {
  const ps = normaliseParams(params);
  if (driver === 'mysql') {
    const [rows] = await pool.query(sql, ps);
    return rows;
  }
  const stmt = sqlite.prepare(sql);
  return stmt.all(...ps).map((r) => Object.assign({}, r));
}

/** INSERT/UPDATE/DELETE → { insertId, affectedRows } */
async function exec(sql, params) {
  const ps = normaliseParams(params);
  if (driver === 'mysql') {
    const [res] = await pool.query(sql, ps);
    return { insertId: res.insertId, affectedRows: res.affectedRows };
  }
  const stmt = sqlite.prepare(sql);
  const res = stmt.run(...ps);
  return { insertId: Number(res.lastInsertRowid), affectedRows: Number(res.changes) };
}

async function one(sql, params) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

async function scalar(sql, params) {
  const row = await one(sql, params);
  if (!row) return null;
  return row[Object.keys(row)[0]];
}

/** Run several statements separated by ';' (DDL). */
async function execScript(script) {
  const stmts = script.split(/;\s*\n/).map((s) => s.trim()).filter(Boolean);
  for (const s of stmts) await exec(s, []);
}

/** Simple transaction helper (serialised on sqlite). */
async function transaction(fn) {
  if (driver === 'mysql') {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const api = {
        query: async (sql, params) => (await conn.query(sql, normaliseParams(params)))[0],
        exec: async (sql, params) => {
          const [res] = await conn.query(sql, normaliseParams(params));
          return { insertId: res.insertId, affectedRows: res.affectedRows };
        },
      };
      const out = await fn(api);
      await conn.commit();
      return out;
    } catch (e) {
      try { await conn.rollback(); } catch (_) { /* ignore */ }
      throw e;
    } finally {
      conn.release();
    }
  }
  sqlite.exec('BEGIN');
  try {
    const out = await fn({ query, exec });
    sqlite.exec('COMMIT');
    return out;
  } catch (e) {
    sqlite.exec('ROLLBACK');
    throw e;
  }
}

/* ---------- date helpers (naive local time, TZ pinned to Asia/Kolkata) ---------- */
function pad(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtDateTime(d) {
  if (!d) return null;
  if (typeof d === 'string') return d.length === 10 ? d + ' 00:00:00' : d.replace('T', ' ').slice(0, 19);
  return `${fmtDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function parseDateTime(s) {
  if (!s) return null;
  if (s instanceof Date) return s;
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
}
function now() { return new Date(); }
function today() { return fmtDate(new Date()); }

/** Dialect-specific SQL fragments */
const sqlf = {
  // substring of a datetime column to month 'YYYY-MM'
  month: (col) => (driver === 'mysql' ? `DATE_FORMAT(${col}, '%Y-%m')` : `substr(${col}, 1, 7)`),
  date: (col) => (driver === 'mysql' ? `DATE(${col})` : `substr(${col}, 1, 10)`),
  concat: (...parts) => (driver === 'mysql' ? `CONCAT(${parts.join(', ')})` : parts.join(' || ')),
  ifnull: 'IFNULL',
  insertIgnore: driver === 'mysql' ? 'INSERT IGNORE' : 'INSERT OR IGNORE',
};

module.exports = { driver, init, query, exec, one, scalar, execScript, transaction, fmtDate, fmtDateTime, parseDateTime, now, today, sqlf };
