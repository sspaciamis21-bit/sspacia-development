'use strict';
/**
 * Idempotent seeding: masters are inserted only when missing (matched by code / e-mail);
 * transactional data (SCOT accounts, live enquiries, meeting log) only when the table is empty.
 * Nothing the team edits later is ever overwritten by a restart.
 */
const fs = require('fs');
const path = require('path');
const db = require('./db');
const repo = require('./repo');
const fms = require('./fms');
const wh = require('./workhours');
const hooks = require('./hooks');
const D = require('./seed-data');

const SEED_VERSION = 3;

function readJson(name) {
  const p = path.join(__dirname, '..', 'data', name);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
async function count(table, where = '', params = []) {
  return Number(await db.scalar(`SELECT COUNT(*) AS n FROM \`${table}\` ${where}`, params));
}
async function byCode(table, code, col = 'code') {
  return db.one(`SELECT * FROM \`${table}\` WHERE \`${col}\` = ?`, [code]);
}

async function seedMasters() {
  for (const c of D.CENTRES) if (!(await byCode('centres', c.code))) await repo.insert('centres', Object.assign({ is_active: 1 }, c));
  for (const p of D.PRODUCTS) if (!(await byCode('products', p.code))) await repo.insert('products', Object.assign({ is_active: 1 }, p));
  for (const s of D.LEAD_SOURCES) if (!(await byCode('lead_sources', s.code))) await repo.insert('lead_sources', Object.assign({ is_active: 1 }, s));
  for (const u of D.USERS) {
    if (await byCode('users', u.email, 'email')) continue;
    const { centre, ...rest } = u;
    const c = centre ? await byCode('centres', centre) : null;
    const id = await repo.insert('users', Object.assign({ centre_id: c ? c.id : null }, rest));
    if (c && !c.cm_user_id) await repo.update('centres', c.id, { cm_user_id: id });
  }
  if ((await count('rate_card')) === 0) {
    for (const r of D.RATE_CARD) {
      const p = await byCode('products', r.product);
      if (p) await repo.insert('rate_card', { centre_id: null, product_id: p.id, rate: r.rate, floor_rate: r.floor_rate, deposit_months: r.deposit_months, lockin_months: r.lockin_months, notes: r.notes });
    }
  }
  for (const flow of ['NBD', 'CRM']) {
    for (const st of (flow === 'NBD' ? D.STAGES_NBD : D.STAGES_CRM)) {
      const ex = await db.one('SELECT id FROM fms_stage_defs WHERE flow = ? AND code = ?', [flow, st.code]);
      if (!ex) await repo.insert('fms_stage_defs', Object.assign({ flow, is_active: 1 }, st));
    }
  }
  if ((await count('lost_reasons')) === 0) for (const r of D.LOST_REASONS) await repo.insert('lost_reasons', r);
  if ((await count('golden_segments')) === 0) {
    const owner = await db.one("SELECT id FROM users WHERE role = 'sc_crm' AND is_active = 1 ORDER BY id LIMIT 1", []);
    for (const g of D.GOLDEN_SEGMENTS) await repo.insert('golden_segments', Object.assign({ owner_user_id: owner ? owner.id : null, is_active: 1 }, g));
  }
  if ((await count('lead_gen_channels')) === 0) {
    for (const ch of D.LEAD_GEN_CHANNELS) {
      const { owner_role, ...rest } = ch;
      const owner = owner_role ? await db.one('SELECT id FROM users WHERE role = ? ORDER BY is_active DESC, id LIMIT 1', [owner_role]) : null;
      await repo.insert('lead_gen_channels', Object.assign({ owner_user_id: owner ? owner.id : null }, rest));
    }
  }
  if ((await count('scripts')) === 0) for (const s of D.SCRIPTS) await repo.insert('scripts', s);
  for (const t of D.TEMPLATES) if (!(await byCode('msg_templates', t.code))) await repo.insert('msg_templates', Object.assign({ sort: Number(t.code.slice(1)) }, t));
  if ((await count('kb_articles')) === 0) for (const k of D.KB) await repo.insert('kb_articles', k);
  if ((await count('plan_year')) === 0) {
    const now = new Date();
    const fyStart = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    for (let i = 0; i < 12; i++) {
      const d = new Date(fyStart, 3 + i, 1);
      await repo.insert('plan_year', { month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
    }
  }
  if (!(await db.one("SELECT id FROM settings WHERE skey = 'funnel_targets'", []))) {
    await repo.setSetting('funnel_targets', { closures_per_month: 6, mrr_per_closure: 35000, working_days: 25, ratio_enquiry_to_qualified: 0.6, ratio_qualified_to_meeting: 0.5, ratio_meeting_to_proposal: 0.8, ratio_proposal_to_close: 0.3, scot_calls_per_day: 4, golden_contacts_per_day: 5, calls_per_day: 30 });
  }
  if (!(await db.one("SELECT id FROM settings WHERE skey = 'workhours'", []))) await repo.setSetting('workhours', wh.DEFAULT);
  if (!(await db.one("SELECT id FROM settings WHERE skey = 'redflag'", []))) await repo.setSetting('redflag', { l1: 2, l2: 24, l3: 72 });
}

function mapProduct(products, raw) {
  const t = String(raw || '').toLowerCase();
  const find = (code) => products.find((p) => p.code === code);
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

async function seedClients() {
  if ((await count('clients')) > 0) return;
  const accounts = readJson('scot_accounts.json');
  if (!accounts) return;
  const centres = await db.query('SELECT * FROM centres', []);
  const products = await db.query('SELECT * FROM products', []);
  const owner = await db.one("SELECT id FROM users WHERE role = 'sc_crm' AND is_active = 1 ORDER BY id LIMIT 1", []);
  let i = 0;
  for (const a of accounts) {
    const centre = centres.find((c) => c.name.toLowerCase() === String(a.centre || '').toLowerCase());
    const product = mapProduct(products, a.product);
    const isVO = product && product.code === 'VO';
    const rent = a.monthly_rent || null;
    const mrr = rent ? (isVO ? Math.round(rent / 1.18 / 12) : Math.round(rent / 1.18)) : null;
    const notes = [`Imported from SCOT sheet on ${db.today()}.`, isVO ? 'Virtual-office rent in the sheet treated as an annual fee (÷12 for MRR) — confirm.' : null, a.product_note ? `Note: ${a.product_note}` : null].filter(Boolean).join(' ');
    // stagger first SCOT calls over the next 20 working days so the whole base is called once in the first month
    const firstDue = wh.addWorkingDays(new Date(), 1 + (i % 20));
    const id = await repo.insert('clients', {
      company: String(a.company).replace(/[,\s]+$/, '').trim(), centre_id: centre ? centre.id : null, product_id: product ? product.id : null, product_text: a.product_raw, seats: a.seats || null,
      monthly_rent: rent, mrr_ex_gst: mrr, agreement_end: a.agreement_end, lockin_end: a.lockin_end, due_day: a.due_day, status: a.status || 'Active',
      relationship_owner: owner ? owner.id : null, call_frequency_days: 30, next_call_due: db.fmtDate(firstDue), products_bought: product ? product.name : a.product, source: 'Legacy', notes,
      notice_date: a.status === 'On Notice' ? db.today() : null,
    });
    for (const [j, c] of (a.contacts || []).entries()) {
      if (!c.name && !c.mobile) continue;
      await repo.insert('client_contacts', { client_id: id, name: c.name || '(name missing)', designation: c.designation || null, mobile: c.mobile || null, is_primary: j === 0 ? 1 : 0 });
    }
    i++;
  }
}

async function seedInventory() {
  if ((await count('inventory')) > 0) return;
  const centres = await db.query('SELECT * FROM centres', []);
  const products = await db.query('SELECT * FROM products', []);
  const rc = await db.query('SELECT * FROM rate_card', []);
  const flexiTotals = { MER: 25, AGC: 20, PRH: 20 };
  const rooms = { MER: { MR: '6-seat meeting room', BR: '14-seat board room' }, AGC: { MR: '5-seat meeting room', BR: '11-seat board room' }, PRH: { MR: '4-seat meeting room', BR: '12-seat board room; 40-seat event room' } };
  for (const c of centres) {
    for (const p of products.filter((x) => ['DC', 'EC', 'PC', 'FD', 'FX', 'VO', 'CP', 'MR', 'BR'].includes(x.code))) {
      const occ = await db.one("SELECT COUNT(*) AS n, SUM(seats) AS s FROM clients WHERE centre_id = ? AND product_id = ? AND status IN ('Active','On Notice')", [c.id, p.id]);
      const perSeat = ['DC', 'EC', 'FD', 'FX'].includes(p.code);
      const occupied = perSeat ? Number(occ.s || 0) : Number(occ.n || 0);
      const rate = (rc.find((r) => r.product_id === p.id) || {}).rate || null;
      let total = 0;
      if (p.code === 'FX') total = flexiTotals[c.code] || 0;
      if (p.code === 'MR' || p.code === 'BR') total = 1;
      const notes = p.code === 'VO' ? 'No physical cap' : (rooms[c.code] && rooms[c.code][p.code]) ? rooms[c.code][p.code] : (total === 0 ? 'Fill total units from the occupancy page' : null);
      await repo.insert('inventory', { centre_id: c.id, product_id: p.id, total_units: total, occupied_units: occupied, list_rate: rate, notes });
    }
  }
}

async function seedLeads() {
  if ((await count('leads')) > 0) return;
  if (!(readJson('live_leads.json') || D.LIVE_LEADS).length) return;
  const centres = await db.query('SELECT * FROM centres', []);
  const products = await db.query('SELECT * FROM products', []);
  const sources = await db.query('SELECT * FROM lead_sources', []);
  const liveLeads = readJson('live_leads.json') || D.LIVE_LEADS;
  for (const L of liveLeads) {
    const assigned = await db.one('SELECT id FROM users WHERE name = ?', [L.assigned]);
    const src = sources.find((s) => s.code === (L.source === 'GOOG' ? 'GBP' : L.source === 'OTH' ? 'CALL' : L.source)) || sources[0];
    const data = {
      enq_at: L.enq_at, source_id: src.id, client_name: L.client_name, company: L.company || null, mobile: L.mobile, email: L.email || null,
      nature_of_business: L.nature_of_business || null, geography: L.geography || 'Local', centre_id: L.centre ? (centres.find((c) => c.code === L.centre) || {}).id : null,
      product_id: L.product ? (products.find((p) => p.code === L.product) || {}).id : null, seats: L.seats || null, budget_min: L.budget_min || null, budget_max: L.budget_max || null,
      other_requirement: L.other_requirement || null, assigned_to: assigned ? assigned.id : null, stage: 'New', remarks: L.remarks,
    };
    const d = db.parseDateTime(L.enq_at);
    data.enq_no = `ENQ-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}-${String((await count('leads')) + 1).padStart(3, '0')}`;
    await hooks.beforeCreate.leads(data, { user: null });
    const id = await repo.insert('leads', data);
    await hooks.afterCreate.leads(id);
    if (L.qual_done) {
      const q = await db.one("SELECT id FROM fms_steps WHERE lead_id = ? AND code = 'QUAL'", [id]);
      if (q) await fms.markDone(q.id, { actual_at: db.fmtDateTime(wh.addWorkingHours(d, 1)), outcome: 'Qualified', notes: 'Recorded from the Inquiry Capture sheet', user_id: assigned ? assigned.id : null });
    }
    if (L.proposal_sent) {
      const t = await db.one("SELECT id FROM fms_steps WHERE lead_id = ? AND code = 'TOUR'", [id]);
      if (t) await fms.markDone(t.id, { status: 'na', outcome: 'Virtual office — no tour needed', user_id: assigned ? assigned.id : null });
      const p = await db.one("SELECT id FROM fms_steps WHERE lead_id = ? AND code = 'PROP'", [id]);
      if (p) await fms.markDone(p.id, { actual_at: L.proposal_sent, outcome: 'Proposal shared', notes: 'Proposal sent on 22/10/2026 (Inquiry Capture sheet)', user_id: assigned ? assigned.id : null });
    }
  }
}

async function seedMeetingLog() {
  if ((await count('call_logs', "WHERE notes LIKE '[MeCA log]%'")) > 0) return;
  const rows = readJson('meca_meetings.json');
  if (!rows) return;
  const nikhil = await db.one("SELECT id FROM users WHERE name = 'Nikhil'", []) || await db.one("SELECT id FROM users WHERE role = 'sc_crm' ORDER BY id LIMIT 1", []);
  const clients = await db.query('SELECT id, company FROM clients', []);
  const byName = new Map(clients.map((c) => [c.company.toLowerCase(), c.id]));
  const now = db.fmtDateTime(new Date());
  const batch = [];
  for (const r of rows) {
    const time = (r.at || '').slice(11, 19) || '12:00:00';
    const at = `${r.report_date} ${time}`;
    const clientId = byName.get(String(r.client).toLowerCase()) || null;
    batch.push([at, 'Meeting', clientId, null, nikhil ? nikhil.id : null, r.rs_sales > 0 ? 'Closed - won' : 'Connected', `[MeCA log] ${r.client}${r.contact_name && r.contact_name !== r.client ? ' — ' + r.contact_name : ''}${r.designation ? ' (' + r.designation + ')' : ''}${r.phone ? ' ' + r.phone : ''}: ${r.output || ''}`.slice(0, 2000), r.rs_sales || null, r.client, now, now]);
  }
  const sql = 'INSERT INTO call_logs (at, type, client_id, lead_id, user_id, outcome, notes, amount, client_name, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)';
  for (const b of batch) await db.exec(sql, b);
}

async function run() {
  const v = await repo.getSetting('seed_version', 0);
  await seedMasters();
  await seedClients();
  await seedInventory();
  await seedLeads();
  await seedMeetingLog();
  if (v < SEED_VERSION) await repo.setSetting('seed_version', SEED_VERSION);
}

module.exports = { run };
