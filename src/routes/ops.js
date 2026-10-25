'use strict';
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const repo = require('../repo');
const fms = require('../fms');
const wh = require('../workhours');
const auth = require('../auth');
const hooks = require('../hooks');
const { E } = require('../entities');

const router = express.Router();
const num = (v) => Number(v || 0);
const r2 = (v) => Math.round(v * 100) / 100;

/* ---------- FMS ---------- */
router.get('/fms/lead/:id', auth.requireAuth, async (req, res) => {
  const lead = await repo.get('leads', req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  await fms.computeFlags();
  const steps = await db.query("SELECT s.*, u.name AS owner_name FROM fms_steps s LEFT JOIN users u ON u.id = s.owner_user_id WHERE s.lead_id = ? AND s.flow = 'NBD' ORDER BY s.seq", [lead.id]);
  const cfg = await fms.workCfg();
  const now = new Date();
  steps.forEach((s) => { const p = db.parseDateTime(s.planned_at); s.delay_hours = s.status === 'pending' && p ? r2(wh.workingHoursBetween(p, now, cfg)) : (s.actual_at && p ? r2(wh.workingHoursBetween(p, db.parseDateTime(s.actual_at), cfg)) : 0); });
  const logs = await db.query('SELECT c.*, u.name AS user_name FROM call_logs c LEFT JOIN users u ON u.id = c.user_id WHERE c.lead_id = ? ORDER BY c.at DESC LIMIT 100', [lead.id]);
  const proposals = (await repo.list('proposals', { filters: { lead_id: lead.id } })).rows;
  res.json({ lead, steps, logs, proposals });
});

router.get('/fms/client/:id', auth.requireAuth, async (req, res) => {
  const client = await repo.get('clients', req.params.id);
  if (!client) return res.status(404).json({ error: 'Not found' });
  await fms.computeFlags();
  const steps = await db.query("SELECT s.*, u.name AS owner_name FROM fms_steps s LEFT JOIN users u ON u.id = s.owner_user_id WHERE s.client_id = ? AND s.flow = 'CRM' ORDER BY s.seq", [client.id]);
  const contacts = (await repo.list('client_contacts', { filters: { client_id: client.id } })).rows;
  const logs = await db.query('SELECT c.*, u.name AS user_name FROM call_logs c LEFT JOIN users u ON u.id = c.user_id WHERE c.client_id = ? ORDER BY c.at DESC LIMIT 100', [client.id]);
  res.json({ client, steps, contacts, logs });
});

router.post('/fms/client/:id/generate', auth.requireRole(['sales_head', 'sc_crm', 'cm', 'pc']), async (req, res) => {
  try { await fms.rechain('CRM', req.params.id); res.json({ ok: true }); } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/fms/step/:id/done', auth.requireRole(['sales_head', 'sc_crm', 'cm', 'pc', 'accounts', 'mis']), async (req, res) => {
  try {
    const { actual_at, outcome, notes, status } = req.body || {};
    const step = await fms.markDone(req.params.id, { actual_at, outcome, notes, user_id: req.user.id, status: status || 'done' });
    await repo.logActivity(req.user.id, 'FMS_DONE', 'fms_steps', step.id, `${step.code} ${step.name} → ${outcome || 'done'}`);
    res.json({ data: step });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

router.post('/fms/step/:id/reopen', auth.requireRole(['sales_head', 'pc']), async (req, res) => {
  const step = await db.one('SELECT * FROM fms_steps WHERE id = ?', [req.params.id]);
  if (!step) return res.status(404).json({ error: 'Not found' });
  await repo.update('fms_steps', step.id, { status: 'pending', actual_at: null, outcome: null });
  if (step.flow === 'NBD') await fms.rechain('NBD', step.lead_id); else await fms.rechain('CRM', step.client_id);
  res.json({ ok: true });
});

router.post('/fms/step/:id/reassign', auth.requireRole(['sales_head', 'pc']), async (req, res) => {
  await repo.update('fms_steps', req.params.id, { owner_user_id: req.body.owner_user_id || null });
  res.json({ ok: true });
});

/** FMS board: every open enquiry with its steps (the "NBD – Sales FMS" grid) */
router.get('/fms/board', auth.requireAuth, async (req, res) => {
  await fms.computeFlags();
  const flow = req.query.flow === 'CRM' ? 'CRM' : 'NBD';
  const defs = (await repo.list('fms_stage_defs', { filters: { flow, is_active: 1 }, limit: 100 })).rows;
  let heads;
  if (flow === 'NBD') {
    const where = req.query.all === '1' ? '' : "WHERE l.stage NOT IN ('Won','Lost','Disqualified','Dormant')";
    heads = await db.query(`SELECT l.id, l.enq_no, l.enq_at, l.client_name, l.company, l.mobile, l.stage, l.expected_mrr, l.seats, u.name AS assigned_name, c.name AS centre, s.name AS source FROM leads l LEFT JOIN users u ON u.id = l.assigned_to LEFT JOIN centres c ON c.id = l.centre_id LEFT JOIN lead_sources s ON s.id = l.source_id ${where} ORDER BY l.enq_at DESC LIMIT 300`, []);
  } else {
    heads = await db.query("SELECT c.id, c.company, c.start_date, c.status, c.mrr_ex_gst, ce.name AS centre, u.name AS assigned_name FROM clients c LEFT JOIN centres ce ON ce.id = c.centre_id LEFT JOIN users u ON u.id = c.relationship_owner WHERE c.id IN (SELECT DISTINCT client_id FROM fms_steps WHERE flow = 'CRM') ORDER BY c.start_date DESC LIMIT 300", []);
  }
  const ids = heads.map((h) => h.id);
  let steps = [];
  if (ids.length) steps = await db.query(`SELECT * FROM fms_steps WHERE flow = ? AND ${flow === 'NBD' ? 'lead_id' : 'client_id'} IN (${ids.map(() => '?').join(',')})`, [flow, ...ids]);
  const byHead = {};
  for (const s of steps) { const k = flow === 'NBD' ? s.lead_id : s.client_id; (byHead[k] = byHead[k] || {})[s.code] = s; }
  res.json({ flow, defs, rows: heads.map((h) => Object.assign(h, { steps: byHead[h.id] || {} })) });
});

/* ---------- SCOT call logging shortcut ---------- */
router.post('/clients/:id/call', auth.requireRole(['sales_head', 'sc_crm', 'cm', 'pc', 'accounts']), async (req, res) => {
  try {
    const client = await db.one('SELECT * FROM clients WHERE id = ?', [req.params.id]);
    if (!client) return res.status(404).json({ error: 'Not found' });
    const b = req.body || {};
    const data = { at: db.fmtDateTime(b.at || new Date()), type: b.type || 'SCOT call', client_id: client.id, user_id: req.user.id, outcome: b.outcome || 'Connected', notes: b.notes || null, next_action: b.next_action || null, next_action_at: b.next_action_at ? db.fmtDateTime(b.next_action_at) : null, duration_min: b.duration_min || null };
    const id = await repo.insert('call_logs', data);
    await hooks.afterCreate.call_logs(id, data);
    if (b.nps !== undefined && b.nps !== '') await repo.update('clients', client.id, { nps: Number(b.nps) });
    if (b.referral_potential) await repo.update('clients', client.id, { referral_potential: b.referral_potential });
    if (b.upsell_lead) {
      const contact = await db.one('SELECT * FROM client_contacts WHERE client_id = ? ORDER BY is_primary DESC, id LIMIT 1', [client.id]);
      const src = await db.one("SELECT id FROM lead_sources WHERE code = 'EXIST' OR name LIKE 'Existing%' ORDER BY id LIMIT 1", []);
      const leadData = { source_id: src ? src.id : null, client_name: contact ? contact.name : client.company, company: client.company, mobile: contact ? contact.mobile : '-', email: contact ? contact.email : null, centre_id: client.centre_id, is_existing_client: 'Existing', assigned_to: client.relationship_owner || req.user.id, remarks: `Upsell / expansion from SCOT call: ${b.notes || ''}`, client_id: client.id, stage: 'New' };
      await hooks.beforeCreate.leads(leadData, req);
      const lid = await repo.insert('leads', leadData);
      await hooks.afterCreate.leads(lid);
    }
    res.json({ ok: true, client: await repo.get('clients', client.id) });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/* ---------- Settings ---------- */
const SETTING_DEFAULTS = {
  company: { name: 'SSPACIA India Private Limited', brand: 'SSPACIA', city: 'Ahmedabad', phone: '', email: '', website: 'https://sspacia.com' },
  workhours: wh.DEFAULT,
  redflag: { l1: 2, l2: 24, l3: 72 },
  discount_levels: { cm: 5, sales_head: 10 },
  commercials: { gst_pct: 18, deposit_months: 2, lockin_months: 11, notice_months: 1, escalation_pct: 5, docs_charges: 2500 },
  expense_thresholds: { auto_approve: 5000, three_quotes: 10000, executive: 25000 },
  scot: { default_frequency_days: 30, renewal_case_days: 90, nps_frequency_months: 3 },
};
router.get('/settings', auth.requireAuth, async (req, res) => {
  const all = await repo.allSettings();
  const out = {};
  for (const [k, v] of Object.entries(SETTING_DEFAULTS)) out[k] = Object.assign({}, v, all[k] || {});
  for (const k of ['funnel_targets', 'gap_analysis', 'compounding', 'intake_api_key_set']) if (all[k] !== undefined) out[k] = all[k];
  out.intake_api_key_set = !!all.intake_api_key;
  res.json(out);
});
router.post('/settings/:key', auth.requireRole([]), async (req, res) => {
  const key = req.params.key;
  if (!(key in SETTING_DEFAULTS) && !['funnel_targets', 'gap_analysis', 'compounding'].includes(key)) return res.status(400).json({ error: 'Unknown setting' });
  const cur = (await repo.allSettings())[key] || {};
  const next = Object.assign({}, SETTING_DEFAULTS[key] || {}, cur, req.body || {});
  if (key === 'workhours') {
    next.startMin = Number(next.startMin); next.endMin = Number(next.endMin);
    next.workingDays = (Array.isArray(next.workingDays) ? next.workingDays : String(next.workingDays).split(',')).map(Number).filter((n) => !Number.isNaN(n));
    next.holidays = (Array.isArray(next.holidays) ? next.holidays : String(next.holidays || '').split(/[,\s]+/)).map((s) => s.trim()).filter(Boolean);
  }
  await repo.setSetting(key, next);
  if (key === 'workhours' || key === 'redflag') { const open = await db.query("SELECT id FROM leads WHERE stage NOT IN ('Won','Lost','Disqualified','Dormant')", []); for (const l of open) await fms.rechain('NBD', l.id); }
  await repo.logActivity(req.user.id, 'SETTINGS', key, null, 'updated');
  res.json({ ok: true, value: next });
});
router.post('/settings/intake-key/rotate', auth.requireRole([]), async (req, res) => {
  const key = 'ssp_' + crypto.randomBytes(18).toString('hex');
  await repo.setSetting('intake_api_key', key);
  res.json({ key, note: 'Shown once. Put it in the website form backend as header X-Api-Key.' });
});

/* ---------- Calculators ---------- */
router.get('/calc/quote', auth.requireAuth, async (req, res) => {
  const q = req.query;
  const centre = q.centre_id ? Number(q.centre_id) : null;
  const product = Number(q.product_id);
  let rc = centre ? await db.one('SELECT * FROM rate_card WHERE product_id = ? AND centre_id = ?', [product, centre]) : null;
  if (!rc) rc = await db.one('SELECT * FROM rate_card WHERE product_id = ? AND (centre_id IS NULL OR centre_id = 0) ORDER BY id LIMIT 1', [product]);
  const com = Object.assign({}, SETTING_DEFAULTS.commercials, await repo.getSetting('commercials', {}));
  const lv = await repo.getSetting('discount_levels', SETTING_DEFAULTS.discount_levels);
  const seats = num(q.seats) || 1, rate = q.rate !== undefined && q.rate !== '' ? num(q.rate) : num(rc && rc.rate), disc = num(q.discount_pct);
  const monthly = Math.round(seats * rate * (1 - disc / 100));
  const gst = Math.round(monthly * num(com.gst_pct) / 100);
  const dep = num(q.deposit_months !== undefined && q.deposit_months !== '' ? q.deposit_months : (rc ? rc.deposit_months : com.deposit_months));
  const months = num(q.lockin_months) || (rc ? rc.lockin_months : com.lockin_months);
  res.json({ rate_card: rc, seats, rate, discount_pct: disc, monthly_ex_gst: monthly, gst, monthly_incl_gst: monthly + gst, deposit_months: dep, deposit: Math.round(monthly * dep), first_payment: Math.round(monthly * dep) + monthly + gst, lockin_months: months, contract_value_ex_gst: monthly * months,
    approval: disc <= 0 ? 'None needed' : disc <= num(lv.cm) ? `Community Manager (≤${lv.cm}%)` : disc <= num(lv.sales_head) ? `Sales Head (≤${lv.sales_head}%)` : `Praveen (>${lv.sales_head}%)`,
    below_floor: rc && rc.floor_rate ? rate * (1 - disc / 100) < num(rc.floor_rate) : false });
});

function gapCompute(i) {
  const rev = num(i.revenue), vc = num(i.variable_cost), fc = num(i.fixed_cost);
  const gp = rev - vc, np = gp - fc, gpPct = rev ? gp / rev : 0;
  const targetNp = num(i.target_net_profit);
  const newFc = fc * (1 + num(i.fixed_cost_growth_pct) / 100);
  const newGp = targetNp + newFc;
  const newRev = gpPct ? newGp / gpPct : 0;
  const clients = num(i.active_clients), avg = clients ? rev / clients : num(i.avg_mrr);
  const neededClients = avg ? newRev / avg : 0;
  const churnPct = num(i.annual_churn_pct);
  const grossAdd = neededClients - clients + clients * churnPct / 100;
  return { current: { revenue: rev, variable_cost: vc, gross_profit: gp, gp_pct: r2(gpPct * 100), fixed_cost: fc, net_profit: np },
    target: { net_profit: targetNp, fixed_cost: Math.round(newFc), gross_profit: Math.round(newGp), revenue: Math.round(newRev), gap_revenue: Math.round(newRev - rev), growth_pct: rev ? r2((newRev / rev - 1) * 100) : 0 },
    clients: { active: clients, avg_mrr: Math.round(avg), needed: Math.ceil(neededClients), gross_adds_12m: Math.ceil(Math.max(grossAdd, 0)), per_month: r2(Math.max(grossAdd, 0) / 12) },
    steps: ['Step 1: decide the new Net Profit (1 year from now)', 'Step 2: estimate Fixed Cost a year from now', 'Step 3: New GP = New NP + New FC', 'Step 4: New Revenue = New GP ÷ GP%', 'Step 5: clients needed = New Revenue ÷ average MRR; plus churn replacement'] };
}
router.get('/calc/gap', auth.requireAuth, async (req, res) => {
  const i = await repo.getSetting('gap_analysis', { revenue: 0, variable_cost: 0, fixed_cost: 0, target_net_profit: 0, fixed_cost_growth_pct: 10, active_clients: 0, avg_mrr: 0, annual_churn_pct: 20 });
  if (!i.revenue) {
    const r = await db.one("SELECT SUM(mrr_ex_gst) AS rev, COUNT(*) AS n FROM clients WHERE status IN ('Active','On Notice')", []);
    i.revenue = Math.round(num(r.rev)); i.active_clients = num(r.n);
  }
  res.json({ inputs: i, result: gapCompute(i) });
});
router.post('/calc/gap', auth.requireRole(['sales_head', 'accounts']), async (req, res) => {
  const i = {}; for (const [k, v] of Object.entries(req.body || {})) i[k] = Number(v);
  await repo.setSetting('gap_analysis', i);
  res.json({ inputs: i, result: gapCompute(i) });
});

function compoundingCompute(i) {
  const rows = [];
  let leads = num(i.leads), cr = num(i.conversion_pct), avg = num(i.avg_sale), tr = num(i.transactions), gpPct = num(i.gp_pct), fc = num(i.fixed_cost);
  const g = { leads: num(i.g_leads), cr: num(i.g_conversion), avg: num(i.g_avg_sale), tr: num(i.g_transactions), gp: num(i.g_gp_pct) };
  const start = new Date(); const first = { np: null };
  for (let m = 0; m < 12; m++) {
    const d = new Date(start.getFullYear(), start.getMonth() + m, 1);
    const clients = leads * cr / 100;
    const rev = clients * avg * tr;
    const gp = rev * gpPct / 100;
    const np = gp - fc;
    if (first.np === null) first.np = np;
    rows.push({ month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, leads: r2(leads), conversion_pct: r2(cr), clients: r2(clients), avg_sale: Math.round(avg), transactions: r2(tr), revenue: Math.round(rev), gp_pct: r2(gpPct), gross_profit: Math.round(gp), fixed_cost: Math.round(fc), net_profit: Math.round(np) });
    leads *= 1 + g.leads / 100; cr *= 1 + g.cr / 100; avg *= 1 + g.avg / 100; tr *= 1 + g.tr / 100; gpPct = Math.min(gpPct * (1 + g.gp / 100), 95);
  }
  const last = rows[rows.length - 1];
  return { rows, multiple: first.np ? r2(last.net_profit / first.np) : null, annual_profit: rows.reduce((s, r) => s + r.net_profit, 0) };
}
router.get('/calc/compounding', auth.requireAuth, async (req, res) => {
  const i = await repo.getSetting('compounding', { leads: 40, conversion_pct: 15, avg_sale: 25000, transactions: 1, gp_pct: 60, fixed_cost: 300000, g_leads: 5, g_conversion: 5, g_avg_sale: 3, g_transactions: 0, g_gp_pct: 1 });
  res.json({ inputs: i, result: compoundingCompute(i) });
});
router.post('/calc/compounding', auth.requireRole(['sales_head', 'accounts']), async (req, res) => {
  const i = {}; for (const [k, v] of Object.entries(req.body || {})) i[k] = Number(v);
  await repo.setSetting('compounding', i);
  res.json({ inputs: i, result: compoundingCompute(i) });
});

/* ---------- Templates ---------- */
router.get('/templates/render', auth.requireAuth, async (req, res) => {
  const t = await db.one('SELECT * FROM msg_templates WHERE code = ?', [req.query.code]);
  if (!t) return res.status(404).json({ error: 'Template not found' });
  const vars = { user: req.user.name, date: db.today(), time: '', link: '', rate: '', seats: '', centre: '', name: '', company: '' };
  if (req.query.lead_id) {
    const l = await repo.get('leads', req.query.lead_id);
    if (l) Object.assign(vars, { name: l.client_name, company: l.company || '', centre: l.centre_id_label || '', seats: l.seats || '', rate: l.expected_mrr || '' });
  }
  if (req.query.client_id) {
    const c = await repo.get('clients', req.query.client_id);
    const p = c ? await db.one('SELECT name FROM client_contacts WHERE client_id = ? ORDER BY is_primary DESC, id LIMIT 1', [c.id]) : null;
    if (c) Object.assign(vars, { name: p ? p.name : c.company, company: c.company, centre: c.centre_id_label || '', seats: c.seats || '', rate: c.mrr_ex_gst || '' });
  }
  for (const [k, v] of Object.entries(req.query)) if (!['code', 'lead_id', 'client_id'].includes(k)) vars[k] = v;
  const text = String(t.body || '').replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m));
  res.json({ code: t.code, name: t.name, text });
});

/* ---------- Public lead intake (website / WhatsApp bot) ---------- */
router.post('/public/enquiry', async (req, res) => {
  try {
    const key = await repo.getSetting('intake_api_key', null);
    const given = req.headers['x-api-key'] || (req.body && req.body.api_key);
    if (!key || given !== key) return res.status(401).json({ error: 'Invalid API key' });
    const b = req.body || {};
    const src = await db.one('SELECT id FROM lead_sources WHERE code = ? OR name = ?', [b.source || 'WEB', b.source || 'Website']);
    const centre = b.centre ? await db.one('SELECT id FROM centres WHERE name = ? OR code = ?', [b.centre, b.centre]) : null;
    const data = { source_id: src ? src.id : (await db.one('SELECT id FROM lead_sources ORDER BY id LIMIT 1', [])).id, client_name: b.name || b.client_name, company: b.company || null, mobile: b.mobile || b.phone, email: b.email || null, centre_id: centre ? centre.id : null, seats: b.seats ? parseInt(b.seats, 10) : null, other_requirement: [b.requirement, b.message, b.preferred_visit_date ? 'Preferred visit: ' + b.preferred_visit_date : ''].filter(Boolean).join(' | ') || null, geography: 'Local', stage: 'New' };
    if (!data.client_name || !data.mobile) return res.status(400).json({ error: 'name and mobile are required' });
    await hooks.beforeCreate.leads(data, { user: null, body: b });
    const id = await repo.insert('leads', data);
    await hooks.afterCreate.leads(id);
    const lead = await repo.get('leads', id);
    res.json({ ok: true, enq_no: lead.enq_no, id });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

/* ---------- Backup ---------- */
router.get('/export/backup.json', auth.requireRole(['mis']), async (req, res) => {
  const out = { exported_at: db.fmtDateTime(new Date()), tables: {} };
  for (const def of Object.values(E)) {
    if (def.name === 'sessions') continue;
    const rows = await db.query(`SELECT * FROM \`${def.table}\``, []);
    if (def.name === 'users') rows.forEach((r) => delete r.password_hash);
    out.tables[def.name] = rows;
  }
  res.setHeader('Content-Disposition', `attachment; filename="sspacia-sales-autopilot-${db.today()}.json"`);
  res.json(out);
});

module.exports = { router, SETTING_DEFAULTS };
