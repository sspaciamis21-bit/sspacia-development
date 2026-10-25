'use strict';
/**
 * Data import (Executive / MIS): SCOT sheet CSV or JSON, enquiries JSON, meeting log JSON.
 * Keeps client data out of the code repository — it is loaded into the production database here.
 */
const express = require('express');
const db = require('../db');
const repo = require('../repo');
const fms = require('../fms');
const wh = require('../workhours');
const hooks = require('../hooks');
const auth = require('../auth');

const router = express.Router();
router.use(auth.requireRole(['mis']));

/* ---------- CSV parsing (RFC-4180-ish) ---------- */
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', inQ = false;
  const s = String(text).replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQ) {
      if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
const clean = (v) => (v === undefined || v === null ? '' : String(v).trim());
function toInt(v) { const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10); return Number.isNaN(n) ? null : n; }
function toDateIso(v) {
  const s = clean(v);
  if (!s) return null;
  let m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (m) { const y = m[3].length === 2 ? '20' + m[3] : m[3]; return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

/** Parse the team's "SCOT sspacia coworking" sheet export (2 header rows; client row followed by contact-only rows). */
function parseScotCsv(text) {
  const rows = parseCsv(text);
  let headerIdx = rows.findIndex((r) => r.some((c) => /company name/i.test(c)) && r.some((c) => /centre|center/i.test(c)));
  if (headerIdx < 0) headerIdx = rows.findIndex((r) => r.some((c) => /company/i.test(c)));
  if (headerIdx < 0) throw new Error('Could not find the header row (needs "Center" and "Company Name")');
  const h = rows[headerIdx].map((c) => clean(c).toLowerCase());
  const col = (re) => h.findIndex((c) => re.test(c));
  const ix = { centre: col(/^cent(er|re)$/), company: col(/company/), contact: col(/contact person/), desig: col(/designation/), mobile: col(/mobile|phone|ph no/), product: col(/cabin|seats|product/), rent: col(/rent|mrr/), agr: col(/agreement end/), lock: col(/lock-?in end/), due: col(/due day/), status: col(/^status$/), email: col(/e-?mail/) };
  const accounts = [];
  let cur = null;
  for (const r of rows.slice(headerIdx + 1)) {
    const g = (k) => (ix[k] >= 0 ? clean(r[ix[k]]) : '');
    if (g('company')) {
      const productRaw = g('product');
      const seatsM = productRaw.match(/\((\d+)\s*seats?\)/i);
      cur = { centre: g('centre'), company: g('company').replace(/[,\s]+$/, ''), product_raw: productRaw, product: productRaw.replace(/\s*\([^)]*\)\s*$/, '').trim(), seats: seatsM ? Number(seatsM[1]) : null, monthly_rent: toInt(g('rent')), agreement_end: toDateIso(g('agr')), lockin_end: toDateIso(g('lock')), due_day: toInt(g('due')), status: g('status') || 'Active', contacts: [] };
      accounts.push(cur);
    }
    if (cur && (g('contact') || g('mobile'))) cur.contacts.push({ name: g('contact'), designation: g('desig'), mobile: g('mobile'), email: g('email') });
  }
  return accounts.filter((a) => !/test/i.test(a.company));
}

function mapProduct(products, raw) {
  const t = String(raw || '').toLowerCase();
  const find = (code) => products.find((p) => p.code === code) || null;
  if (t.includes('dedicated cabin')) return find('DC');
  if (t.includes('executive cabin')) return find('EC');
  if (t.includes('private cabin')) return find('PC');
  if (t.includes('fixed desk')) return find('FD');
  if (t.includes('flexi desk')) return find('FX');
  if (t.includes('virtual office')) return find('VO');
  if (t.includes('board room')) return find('BR');
  if (t.includes('meeting room')) return find('MR');
  if (t.includes('car parking')) return find('CP');
  return null;
}

async function importAccounts(accounts, { mode = 'merge' } = {}) {
  const centres = await db.query('SELECT * FROM centres', []);
  const products = await db.query('SELECT * FROM products', []);
  const owner = await db.one("SELECT id FROM users WHERE role = 'sc_crm' AND is_active = 1 ORDER BY id LIMIT 1", []);
  const result = { created: 0, updated: 0, skipped: 0, contacts: 0, errors: [] };
  let i = 0;
  for (const a of accounts) {
    try {
      a.company = String(a.company || '').replace(/[,\s]+$/, '').trim();
      if (!a.company) { result.skipped++; continue; }
      const centre = centres.find((c) => c.name.toLowerCase() === String(a.centre || '').toLowerCase() || c.code.toLowerCase() === String(a.centre || '').toLowerCase());
      const product = mapProduct(products, a.product || a.product_raw);
      const isVO = product && product.code === 'VO';
      const rent = a.monthly_rent ? Number(a.monthly_rent) : null;
      const mrr = a.mrr_ex_gst ? Number(a.mrr_ex_gst) : (rent ? (isVO ? Math.round(rent / 1.18 / 12) : Math.round(rent / 1.18)) : null);
      const existing = await db.one('SELECT * FROM clients WHERE LOWER(company) = LOWER(?)', [a.company]);
      const data = { company: a.company, centre_id: centre ? centre.id : null, product_id: product ? product.id : null, product_text: a.product_raw || a.product || null, seats: a.seats || null, monthly_rent: rent, mrr_ex_gst: mrr, agreement_end: a.agreement_end || null, lockin_end: a.lockin_end || null, due_day: a.due_day || null, status: a.status || 'Active' };
      let id;
      if (existing) {
        if (mode === 'skip') { result.skipped++; continue; }
        await repo.update('clients', existing.id, data); id = existing.id; result.updated++;
      } else {
        const firstDue = wh.addWorkingDays(new Date(), 1 + (i % 20));
        id = await repo.insert('clients', Object.assign(data, { relationship_owner: owner ? owner.id : null, call_frequency_days: 30, next_call_due: db.fmtDate(firstDue), products_bought: product ? product.name : (a.product || null), source: 'Legacy', notes: `Imported from SCOT sheet on ${db.today()}.${isVO ? ' Virtual-office rent treated as annual (÷12 for MRR) — confirm.' : ''}`, notice_date: (a.status === 'On Notice') ? db.today() : null }));
        result.created++;
      }
      for (const [j, c] of (a.contacts || []).entries()) {
        if (!c.name && !c.mobile) continue;
        const dup = await db.one("SELECT id FROM client_contacts WHERE client_id = ? AND (name = ? OR (mobile IS NOT NULL AND mobile <> '' AND mobile = ?))", [id, c.name || '', c.mobile || '']);
        if (dup) continue;
        await repo.insert('client_contacts', { client_id: id, name: c.name || '(name missing)', designation: c.designation || null, mobile: c.mobile || null, email: c.email || null, is_primary: j === 0 ? 1 : 0 });
        result.contacts++;
      }
      i++;
    } catch (e) { result.errors.push(`${a.company}: ${e.message}`); }
  }
  return result;
}

router.post('/import/scot', async (req, res) => {
  try {
    const b = req.body || {};
    let accounts = [];
    if (b.csv) accounts = parseScotCsv(b.csv);
    else if (Array.isArray(b.accounts)) accounts = b.accounts;
    else if (typeof b.json === 'string') accounts = JSON.parse(b.json);
    if (!accounts.length) return res.status(400).json({ error: 'No accounts found in the data' });
    const result = await importAccounts(accounts, { mode: b.mode || 'merge' });
    await repo.logActivity(req.user.id, 'IMPORT', 'clients', null, `SCOT import: ${result.created} created, ${result.updated} updated`);
    res.json({ parsed: accounts.length, ...result });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/import/scot/preview', async (req, res) => {
  try {
    const accounts = req.body.csv ? parseScotCsv(req.body.csv) : (Array.isArray(req.body.accounts) ? req.body.accounts : JSON.parse(req.body.json || '[]'));
    res.json({ count: accounts.length, sample: accounts.slice(0, 5), centres: [...new Set(accounts.map((a) => a.centre))], total_rent: accounts.reduce((s, a) => s + Number(a.monthly_rent || 0), 0) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/** Enquiries: JSON array of {enq_at, source (code), client_name, company, mobile, email, nature_of_business, geography, centre (code/name), product (code), seats, budget_min, budget_max, other_requirement, remarks, assigned (user name), qual_done, proposal_sent} */
router.post('/import/leads', async (req, res) => {
  try {
    const list = Array.isArray(req.body.leads) ? req.body.leads : JSON.parse(req.body.json || '[]');
    const centres = await db.query('SELECT * FROM centres', []);
    const products = await db.query('SELECT * FROM products', []);
    const sources = await db.query('SELECT * FROM lead_sources', []);
    const result = { created: 0, skipped: 0, errors: [] };
    for (const L of list) {
      try {
        if (!L.client_name || !L.mobile) { result.skipped++; continue; }
        const dup = await db.one('SELECT id FROM leads WHERE mobile = ? AND client_name = ?', [String(L.mobile), L.client_name]);
        if (dup) { result.skipped++; continue; }
        const assigned = L.assigned ? await db.one('SELECT id FROM users WHERE name LIKE ?', [L.assigned + '%']) : null;
        const srcCode = L.source === 'GOOG' ? 'GBP' : L.source === 'OTH' ? 'CALL' : (L.source || 'CALL');
        const src = sources.find((s) => s.code === srcCode) || sources.find((s) => s.name === L.source) || sources[0];
        const centre = L.centre ? centres.find((c) => c.code === L.centre || c.name === L.centre) : null;
        const product = L.product ? products.find((p) => p.code === L.product || p.name === L.product) : null;
        const data = { enq_at: db.fmtDateTime(L.enq_at || new Date()), source_id: src.id, client_name: L.client_name, company: L.company || null, mobile: String(L.mobile), email: L.email || null, nature_of_business: L.nature_of_business || null, geography: L.geography || 'Local', centre_id: centre ? centre.id : null, product_id: product ? product.id : null, seats: L.seats || null, budget_min: L.budget_min || null, budget_max: L.budget_max || null, other_requirement: L.other_requirement || null, assigned_to: assigned ? assigned.id : null, stage: 'New', remarks: L.remarks || null };
        const d = db.parseDateTime(data.enq_at);
        const prefix = `ENQ-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}-`;
        const last = await db.one('SELECT enq_no FROM leads WHERE enq_no LIKE ? ORDER BY enq_no DESC LIMIT 1', [prefix + '%']);
        data.enq_no = prefix + String(last ? parseInt(last.enq_no.slice(prefix.length), 10) + 1 : 1).padStart(3, '0');
        await hooks.beforeCreate.leads(data, { user: req.user });
        const id = await repo.insert('leads', data);
        await hooks.afterCreate.leads(id);
        if (L.qual_done) { const q = await db.one("SELECT id FROM fms_steps WHERE lead_id = ? AND code = 'QUAL'", [id]); if (q) await fms.markDone(q.id, { actual_at: db.fmtDateTime(wh.addWorkingHours(d, 1)), outcome: 'Qualified', notes: 'Recorded at import', user_id: data.assigned_to }); }
        if (L.proposal_sent) {
          const t = await db.one("SELECT id FROM fms_steps WHERE lead_id = ? AND code = 'TOUR'", [id]); if (t) await fms.markDone(t.id, { status: 'na', outcome: 'No tour needed', user_id: data.assigned_to });
          const p = await db.one("SELECT id FROM fms_steps WHERE lead_id = ? AND code = 'PROP'", [id]); if (p) await fms.markDone(p.id, { actual_at: db.fmtDateTime(L.proposal_sent), outcome: 'Proposal shared', notes: 'Recorded at import', user_id: data.assigned_to });
        }
        result.created++;
      } catch (e) { result.errors.push(`${L.client_name}: ${e.message}`); }
    }
    await repo.logActivity(req.user.id, 'IMPORT', 'leads', null, `Enquiry import: ${result.created} created`);
    res.json(result);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/** Meeting log: JSON array of {at, report_date, client, output, contact_name, designation, phone, email, rs_sales} */
router.post('/import/meetings', async (req, res) => {
  try {
    const rows = Array.isArray(req.body.meetings) ? req.body.meetings : JSON.parse(req.body.json || '[]');
    const user = (req.body.user_name ? await db.one('SELECT id FROM users WHERE name LIKE ?', [req.body.user_name + '%']) : null) || await db.one("SELECT id FROM users WHERE role = 'sc_crm' ORDER BY id LIMIT 1", []);
    const clients = await db.query('SELECT id, company FROM clients', []);
    const byName = new Map(clients.map((c) => [c.company.toLowerCase(), c.id]));
    const existing = Number(await db.scalar("SELECT COUNT(*) FROM call_logs WHERE notes LIKE '[MeCA log]%'", []));
    if (existing && !req.body.force) return res.status(409).json({ error: `Meeting log already imported (${existing} rows). Send force=true to add anyway.` });
    const now = db.fmtDateTime(new Date());
    let n = 0;
    for (const r of rows) {
      if (!r.client) continue;
      const time = (r.at || '').slice(11, 19) || '12:00:00';
      const at = `${(r.report_date || r.at || '').slice(0, 10)} ${time}`;
      await db.exec('INSERT INTO call_logs (at, type, client_id, user_id, outcome, notes, amount, client_name, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)', [at, 'Meeting', byName.get(String(r.client).toLowerCase()) || null, user ? user.id : null, Number(r.rs_sales) > 0 ? 'Closed - won' : 'Connected', `[MeCA log] ${r.client}${r.contact_name && r.contact_name !== r.client ? ' — ' + r.contact_name : ''}${r.designation ? ' (' + r.designation + ')' : ''}${r.phone ? ' ' + r.phone : ''}: ${r.output || ''}`.slice(0, 2000), Number(r.rs_sales) > 0 ? Number(r.rs_sales) : null, r.client, now, now]);
      n++;
    }
    await repo.logActivity(req.user.id, 'IMPORT', 'call_logs', null, `Meeting log import: ${n} rows`);
    res.json({ imported: n });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.get('/import/status', async (req, res) => {
  res.json({ clients: Number(await db.scalar('SELECT COUNT(*) FROM clients', [])), contacts: Number(await db.scalar('SELECT COUNT(*) FROM client_contacts', [])), leads: Number(await db.scalar('SELECT COUNT(*) FROM leads', [])), meetings: Number(await db.scalar("SELECT COUNT(*) FROM call_logs WHERE notes LIKE '[MeCA log]%'", [])) });
});

module.exports = { router, parseScotCsv, importAccounts };
