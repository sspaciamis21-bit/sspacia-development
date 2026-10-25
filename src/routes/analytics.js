'use strict';
const express = require('express');
const db = require('../db');
const repo = require('../repo');
const fms = require('../fms');
const wh = require('../workhours');
const auth = require('../auth');

const router = express.Router();
router.use(auth.requireAuth);

const pad = (n) => String(n).padStart(2, '0');
function monthKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
function monthsBack(n) {
  const out = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) out.push(monthKey(new Date(d.getFullYear(), d.getMonth() - i, 1)));
  return out;
}
function monthRange(m) { return [m + '-01 00:00:00', nextMonth(m) + '-01 00:00:00']; }
function nextMonth(m) { const [y, mo] = m.split('-').map(Number); const d = new Date(y, mo, 1); return monthKey(d); }
const num = (v) => Number(v || 0);
const r2 = (v) => Math.round(v * 100) / 100;

async function funnelTargets() {
  return repo.getSetting('funnel_targets', {
    closures_per_month: 6, mrr_per_closure: 35000, working_days: 25,
    ratio_enquiry_to_qualified: 0.6, ratio_qualified_to_meeting: 0.5, ratio_meeting_to_proposal: 0.8, ratio_proposal_to_close: 0.3,
    scot_calls_per_day: 4, golden_contacts_per_day: 5, calls_per_day: 30,
  });
}
/** Conversion math from closures back to enquiries (the team's Funnel Targets sheet). */
function targetsFromFunnel(ft) {
  const closures = num(ft.closures_per_month);
  const proposals = closures / Math.max(num(ft.ratio_proposal_to_close), 0.01);
  const meetings = proposals / Math.max(num(ft.ratio_meeting_to_proposal), 0.01);
  const qualified = meetings / Math.max(num(ft.ratio_qualified_to_meeting), 0.01);
  const enquiries = qualified / Math.max(num(ft.ratio_enquiry_to_qualified), 0.01);
  const wd = Math.max(num(ft.working_days), 1);
  const m = { closures, proposals, meetings, qualified, enquiries, mrr: closures * num(ft.mrr_per_closure), follow_ups: proposals * 5 };
  const perDay = {};
  for (const k of Object.keys(m)) perDay[k] = r2(m[k] / wd);
  perDay.scot_calls = num(ft.scot_calls_per_day); perDay.golden_contacts = num(ft.golden_contacts_per_day); perDay.calls = num(ft.calls_per_day);
  const week = {}; for (const k of Object.keys(m)) week[k] = r2(m[k] * 12 / 52);
  week.scot_calls = num(ft.scot_calls_per_day) * 6; week.golden_contacts = num(ft.golden_contacts_per_day) * 6;
  return { month: Object.fromEntries(Object.entries(m).map(([k, v]) => [k, r2(v)])), perDay, week, meeting_to_close: r2(num(ft.ratio_proposal_to_close) * num(ft.ratio_meeting_to_proposal) * 100) };
}

/* ---------- MeCA: Meetings → Conversion → Average sale, by month (company) ---------- */
async function mecaMonths(months, userId) {
  const out = [];
  const userSql = userId ? ' AND l.assigned_to = ?' : '';
  const ft = await funnelTargets();
  const plan = targetsFromFunnel(ft).month;
  for (const m of months) {
    const [a, b] = monthRange(m);
    const p = userId ? [a, b, userId] : [a, b];
    const enquiries = num(await db.scalar(`SELECT COUNT(*) FROM leads l WHERE l.enq_at >= ? AND l.enq_at < ?${userSql}`, p));
    const qualified = num(await db.scalar(`SELECT COUNT(DISTINCT s.lead_id) FROM fms_steps s JOIN leads l ON l.id = s.lead_id WHERE s.flow='NBD' AND s.code='QUAL' AND s.status='done' AND (s.outcome IS NULL OR s.outcome <> 'Not qualified') AND s.actual_at >= ? AND s.actual_at < ?${userSql}`, p));
    const tourMeetings = num(await db.scalar(`SELECT COUNT(DISTINCT s.lead_id) FROM fms_steps s JOIN leads l ON l.id = s.lead_id WHERE s.flow='NBD' AND s.code='TOUR' AND s.status='done' AND s.actual_at >= ? AND s.actual_at < ?${userSql}`, p));
    const logMeetings = num(await db.scalar(`SELECT COUNT(DISTINCT COALESCE(c.client_name, c.client_id)) FROM call_logs c WHERE c.type IN ('Meeting','Tour','Client visit') AND c.lead_id IS NULL AND c.at >= ? AND c.at < ?${userId ? ' AND c.user_id = ?' : ''}`, p));
    const logSales = await db.one(`SELECT COUNT(*) AS n, SUM(amount) AS v FROM call_logs c WHERE c.amount > 0 AND c.at >= ? AND c.at < ?${userId ? ' AND c.user_id = ?' : ''}`, p);
    const meetings = tourMeetings + logMeetings;
    const proposals = num(await db.scalar(`SELECT COUNT(*) FROM leads l WHERE l.proposal_sent_at >= ? AND l.proposal_sent_at < ?${userSql}`, p));
    const wonRow = await db.one(`SELECT COUNT(*) AS n, SUM(won_mrr) AS mrr FROM leads l WHERE l.stage='Won' AND l.won_at >= ? AND l.won_at < ?${userSql}`, p);
    const lost = num(await db.scalar(`SELECT COUNT(*) FROM leads l WHERE l.stage='Lost' AND l.lost_at >= ? AND l.lost_at < ?${userSql}`, p));
    const won = num(wonRow && wonRow.n) + num(logSales.n), mrr = num(wonRow && wonRow.mrr) + num(logSales.v);
    const py = await db.one('SELECT * FROM plan_year WHERE month = ?', [m]);
    out.push({
      month: m, enquiries, qualified, meetings, proposals, won, lost, mrr_won: mrr, transactions: num(logSales.n), transaction_value: num(logSales.v),
      conversion: meetings ? r2(won / meetings * 100) : 0, avg_sale: won ? Math.round(mrr / won) : 0,
      enquiry_to_meeting: enquiries ? r2(meetings / enquiries * 100) : 0,
      plan: { meetings: py && py.meetings_plan ? num(py.meetings_plan) : plan.meetings, won: py && py.clients_plan ? num(py.clients_plan) : plan.closures, enquiries: plan.enquiries, proposals: plan.proposals, mrr_won: plan.mrr, conversion: targetsFromFunnel(ft).meeting_to_close, avg_sale: num(ft.mrr_per_closure) },
    });
  }
  return out;
}

router.get('/meca', async (req, res) => {
  const n = Math.min(parseInt(req.query.months || 6, 10), 24);
  const months = monthsBack(n);
  const company = await mecaMonths(months, null);
  const reps = await db.query("SELECT id, name FROM users WHERE role IN ('sc_crm','sales_head','cm','admin') AND is_active = 1 ORDER BY name", []);
  const byRep = [];
  for (const u of reps) byRep.push({ user: u, months: await mecaMonths(months.slice(-3), u.id) });
  const ft = await funnelTargets();
  res.json({ months, company, byRep, funnel: targetsFromFunnel(ft), inputs: ft });
});

/* ---------- Sales Rep MeCA — weekly, per rep ---------- */
router.get('/meca/weekly', async (req, res) => {
  const weeks = Math.min(parseInt(req.query.weeks || 6, 10), 26);
  const today = new Date();
  const dow = (today.getDay() + 6) % 7; // Monday=0
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow);
  const reps = await db.query("SELECT id, name FROM users WHERE role IN ('sc_crm','sales_head','cm','admin') AND is_active = 1 ORDER BY name", []);
  const ft = await funnelTargets();
  const t = targetsFromFunnel(ft);
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() - 7 * i);
    const we = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 7);
    const a = db.fmtDateTime(ws), b = db.fmtDateTime(we);
    const row = { week_start: db.fmtDate(ws), reps: [] };
    for (const u of reps) {
      const meetings = num(await db.scalar("SELECT COUNT(DISTINCT lead_id) FROM fms_steps WHERE flow='NBD' AND code='TOUR' AND status='done' AND actual_at >= ? AND actual_at < ? AND owner_user_id = ?", [a, b, u.id]));
      const wonRow = await db.one("SELECT COUNT(*) AS n, SUM(won_mrr) AS mrr FROM leads WHERE stage='Won' AND won_at >= ? AND won_at < ? AND assigned_to = ?", [a, b, u.id]);
      const won = num(wonRow.n), mrr = num(wonRow.mrr);
      const enquiries = num(await db.scalar('SELECT COUNT(*) FROM leads WHERE enq_at >= ? AND enq_at < ? AND assigned_to = ?', [a, b, u.id]));
      row.reps.push({ user: u, enquiries, meetings, won, conversion: meetings ? r2(won / meetings * 100) : 0, avg_sale: won ? Math.round(mrr / won) : 0, turnover: mrr,
        plan: { meetings: r2(t.month.meetings * 12 / 52 / Math.max(reps.length, 1)), won: r2(t.month.closures * 12 / 52 / Math.max(reps.length, 1)), avg_sale: num(ft.mrr_per_closure) } });
    }
    out.push(row);
  }
  res.json({ weeks: out, reps });
});

/* ---------- NBD vs CRR ---------- */
router.get('/nbd-crr', async (req, res) => {
  const n = Math.min(parseInt(req.query.months || 6, 10), 24);
  const months = monthsBack(n);
  const out = [];
  for (const m of months) {
    const [a, b] = monthRange(m);
    const crr = num(await db.scalar("SELECT SUM(mrr_ex_gst) FROM clients WHERE status IN ('Active','On Notice') AND (start_date IS NULL OR start_date < ?) AND (exit_date IS NULL OR exit_date >= ?)", [a.slice(0, 10), a.slice(0, 10)]));
    const nbd = num(await db.scalar("SELECT SUM(mrr_ex_gst) FROM clients WHERE start_date >= ? AND start_date < ?", [a.slice(0, 10), b.slice(0, 10)]));
    const nbdCount = num(await db.scalar("SELECT COUNT(*) FROM clients WHERE start_date >= ? AND start_date < ?", [a.slice(0, 10), b.slice(0, 10)]));
    const crrCount = num(await db.scalar("SELECT COUNT(*) FROM clients WHERE status IN ('Active','On Notice') AND (start_date IS NULL OR start_date < ?) AND (exit_date IS NULL OR exit_date >= ?)", [a.slice(0, 10), a.slice(0, 10)]));
    const py = await db.one('SELECT * FROM plan_year WHERE month = ?', [m]);
    const total = crr + nbd;
    out.push({ month: m, crr_rev: crr, nbd_rev: nbd, total_rev: total, crr_pct: total ? r2(crr / total * 100) : 0, nbd_pct: total ? r2(nbd / total * 100) : 0, crr_clients: crrCount, nbd_clients: nbdCount,
      plan: { total: py ? num(py.revenue_plan) : null, crr: py ? num(py.crr_rev_plan) : null, nbd: py ? num(py.nbd_rev_plan) : null }, actual_books: py ? num(py.revenue_actual) : null });
  }
  res.json({ months: out });
});

/* ---------- Leaking bucket ---------- */
router.get('/leaking-bucket', async (req, res) => {
  const n = Math.min(parseInt(req.query.months || 6, 10), 24);
  const months = monthsBack(n);
  const out = [];
  const today = db.today();
  for (const m of months) {
    const [a, b] = monthRange(m);
    const enquiries = num(await db.scalar('SELECT COUNT(*) FROM leads WHERE enq_at >= ? AND enq_at < ?', [a, b]));
    const late = await db.one("SELECT COUNT(*) AS n, SUM(COALESCE(l.expected_mrr, (COALESCE(l.budget_min,0)+COALESCE(l.budget_max,0))/2)) AS v FROM leads l JOIN fms_steps s ON s.lead_id = l.id AND s.flow='NBD' AND s.code='QUAL' WHERE l.enq_at >= ? AND l.enq_at < ? AND (s.status='pending' OR s.actual_at > s.planned_at)", [a, b]);
    const noFollow = await db.one("SELECT COUNT(*) AS n, SUM(COALESCE(l.expected_mrr, (COALESCE(l.budget_min,0)+COALESCE(l.budget_max,0))/2)) AS v FROM leads l WHERE l.enq_at >= ? AND l.enq_at < ? AND l.stage IN ('Dormant')", [a, b]);
    const lostRow = await db.one("SELECT COUNT(*) AS n, SUM(COALESCE(l.expected_mrr, (COALESCE(l.budget_min,0)+COALESCE(l.budget_max,0))/2)) AS v FROM leads l WHERE l.lost_at >= ? AND l.lost_at < ? AND l.stage='Lost'", [a, b]);
    const noProposal = num(await db.scalar("SELECT COUNT(*) FROM leads WHERE lost_at >= ? AND lost_at < ? AND stage='Lost' AND proposal_sent_at IS NULL", [a, b]));
    const churn = await db.one("SELECT COUNT(*) AS n, SUM(mrr_ex_gst) AS v FROM clients WHERE exit_date >= ? AND exit_date < ?", [a.slice(0, 10), b.slice(0, 10)]);
    out.push({ month: m, enquiries, late_first_call: num(late.n), late_first_call_pct: enquiries ? r2(num(late.n) / enquiries * 100) : 0, late_value: num(late.v),
      dormant: num(noFollow.n), dormant_value: num(noFollow.v), lost: num(lostRow.n), lost_value: num(lostRow.v), lost_without_proposal: noProposal,
      clients_lost: num(churn.n), mrr_lost: num(churn.v), annualised_leak: Math.round((num(churn.v) + num(lostRow.v) + num(noFollow.v)) * 12) });
  }
  const scotOverdue = num(await db.scalar("SELECT COUNT(*) FROM clients WHERE status IN ('Active','On Notice') AND next_call_due < ?", [today]));
  const onNotice = await db.one("SELECT COUNT(*) AS n, SUM(mrr_ex_gst) AS v FROM clients WHERE status = 'On Notice'", []);
  const reasons = await db.query("SELECT r.reason, COUNT(*) AS n FROM leads l JOIN lost_reasons r ON r.id = l.lost_reason_id WHERE l.stage='Lost' GROUP BY r.reason ORDER BY n DESC", []);
  res.json({ months: out, scot_overdue: scotOverdue, on_notice: { n: num(onNotice.n), mrr: num(onNotice.v) }, lost_reasons: reasons });
});

/* ---------- MCAP and 5-for-5 (MeCA + margin + transactions → profit) ---------- */
router.get('/mcap', async (req, res) => {
  const n = Math.min(parseInt(req.query.months || 6, 10), 24);
  const months = monthsBack(n);
  const meca = await mecaMonths(months, null);
  const gp = await db.query("SELECT SUM(c.mrr_ex_gst) AS rev, SUM(c.mrr_ex_gst * COALESCE(p.variable_cost_pct,0) / 100) AS vc FROM clients c LEFT JOIN products p ON p.id = c.product_id WHERE c.status IN ('Active','On Notice')", []);
  const gpPct = gp[0] && num(gp[0].rev) ? r2((num(gp[0].rev) - num(gp[0].vc)) / num(gp[0].rev) * 100) : 60;
  const gap = await repo.getSetting('gap_analysis', {});
  const out = [];
  for (const m of meca) {
    const py = await db.one('SELECT * FROM plan_year WHERE month = ?', [m.month]);
    const fixed = py && py.fixed_cost_actual ? num(py.fixed_cost_actual) : num(gap.fixed_cost);
    const revenue = m.mrr_won;
    const margin = Math.round(revenue * gpPct / 100);
    out.push({ month: m.month, meetings: m.meetings, conversion: m.conversion, clients: m.won, avg_sale: m.avg_sale, transactions: (m.won || 0), revenue, gp_pct: gpPct, margin, fixed_cost: fixed, profit: margin - (fixed ? Math.round(fixed * (revenue / Math.max(num(py && py.revenue_plan) || revenue, 1))) : 0),
      plan: { meetings: m.plan.meetings, conversion: m.plan.conversion, clients: m.plan.won, avg_sale: m.plan.avg_sale, revenue: m.plan.mrr_won, margin: Math.round(m.plan.mrr_won * gpPct / 100) } });
  }
  res.json({ months: out, gp_pct: gpPct, note: 'Revenue here = new MRR added in the month (NBD) plus booked transactions; margin uses the blended GP% from the G.P. Sheet; profit allocates fixed cost in proportion to the revenue plan. The 5 levers: meetings, conversion, average sale, transactions, margin — lift each by 5%.' });
});

/* ---------- Leaking bucket extras: pricing below benchmark & renewal risk ---------- */
router.get('/leaking-bucket/accounts', async (req, res) => {
  const today = db.today();
  const rows = await db.query("SELECT c.id, c.company, c.product_id, c.seats, c.mrr_ex_gst, c.agreement_end, c.lockin_end, c.status, c.next_call_due, p.name AS product, p.code AS pcode, ce.name AS centre FROM clients c LEFT JOIN products p ON p.id = c.product_id LEFT JOIN centres ce ON ce.id = c.centre_id WHERE c.status IN ('Active','On Notice')", []);
  const rc = await db.query('SELECT * FROM rate_card', []);
  const belowBenchmark = [];
  const expired = [];
  for (const c of rows) {
    const prod = rc.find((x) => x.product_id === (c.product_id || -1)) || null;
    const perSeat = ['DC', 'EC', 'FD', 'FX'].includes(c.pcode) && num(c.seats) > 0 ? num(c.mrr_ex_gst) / num(c.seats) : null;
    const floor = prod ? num(prod.floor_rate) : null;
    if (perSeat !== null && floor && perSeat < floor) belowBenchmark.push({ id: c.id, company: c.company, centre: c.centre, product: c.product, seats: c.seats, per_seat: Math.round(perSeat), floor, monthly_gap: Math.round((floor - perSeat) * num(c.seats)) });
    if (c.agreement_end && c.agreement_end < today) expired.push({ id: c.id, company: c.company, centre: c.centre, agreement_end: c.agreement_end, mrr: num(c.mrr_ex_gst), status: c.status });
  }
  res.json({ below_benchmark: belowBenchmark, below_benchmark_total: belowBenchmark.reduce((s, b) => s + b.monthly_gap, 0), expired_agreements: expired, expired_mrr: expired.reduce((s, e) => s + e.mrr, 0) });
});

/* ---------- G.P. sheet (product mix) ---------- */
router.get('/gp-sheet', async (req, res) => {
  const rows = await db.query("SELECT p.id, p.name, p.variable_cost_pct, COUNT(c.id) AS clients, SUM(c.seats) AS seats, SUM(c.mrr_ex_gst) AS revenue FROM products p LEFT JOIN clients c ON c.product_id = p.id AND c.status IN ('Active','On Notice') WHERE p.is_active = 1 GROUP BY p.id, p.name, p.variable_cost_pct ORDER BY revenue DESC", []);
  const totalRev = rows.reduce((s, r) => s + num(r.revenue), 0);
  let totalGp = 0;
  const out = rows.map((r) => {
    const rev = num(r.revenue), vc = rev * num(r.variable_cost_pct) / 100, gp = rev - vc;
    totalGp += gp;
    return { product_id: r.id, product: r.name, clients: num(r.clients), seats: num(r.seats), revenue: rev, rev_pct: totalRev ? r2(rev / totalRev * 100) : 0, variable_cost_pct: num(r.variable_cost_pct), variable_cost: Math.round(vc), gp: Math.round(gp), gp_pct: rev ? r2(gp / rev * 100) : 0 };
  });
  out.forEach((o) => { o.gp_share = totalGp ? r2(o.gp / totalGp * 100) : 0; });
  out.sort((a, b) => b.gp - a.gp);
  res.json({ products: out, total_revenue: totalRev, total_gp: Math.round(totalGp), gp_pct: totalRev ? r2(totalGp / totalRev * 100) : 0 });
});

/* ---------- SCOT board: calls due, renewals, notice ---------- */
async function renewalStage(c, today) {
  const t = db.parseDateTime(today);
  const lock = c.lockin_end ? db.parseDateTime(c.lockin_end) : null;
  const agr = c.agreement_end ? db.parseDateTime(c.agreement_end) : null;
  const dl = lock ? Math.round((lock - t) / 86400000) : null;
  const da = agr ? Math.round((agr - t) / 86400000) : null;
  let stage = '';
  const ref = da !== null ? da : dl;
  if (ref !== null) {
    if (ref < 0) stage = 'Expired / month-to-month';
    else if (ref <= 30) stage = 'Renewal D-30: sign';
    else if (ref <= 45) stage = 'Renewal D-45: negotiate';
    else if (ref <= 60) stage = 'Renewal D-60: proposal';
    else if (ref <= 90) stage = 'Renewal D-90: open case';
  }
  return { days_to_lockin_end: dl, days_to_agreement_end: da, renewal_stage: stage };
}
router.get('/scot', async (req, res) => {
  const today = db.today();
  const horizon = db.fmtDate(wh.addCalendarDays(new Date(), 7));
  const clients = (await repo.list('clients', { filters: { status__in: 'Active,On Notice' }, limit: 2000 })).rows;
  const enriched = [];
  for (const c of clients) {
    const r = await renewalStage(c, today);
    const overdue = c.next_call_due ? Math.round((db.parseDateTime(today) - db.parseDateTime(c.next_call_due)) / 86400000) : 0;
    enriched.push(Object.assign({}, c, r, { call_overdue_days: overdue > 0 ? overdue : 0, call_due: !!(c.next_call_due && c.next_call_due <= horizon) }));
  }
  const dueToday = enriched.filter((c) => c.next_call_due && c.next_call_due <= today).sort((a, b) => b.call_overdue_days - a.call_overdue_days);
  const dueWeek = enriched.filter((c) => c.next_call_due && c.next_call_due > today && c.next_call_due <= horizon);
  const renewals = enriched.filter((c) => c.renewal_stage).sort((a, b) => (a.days_to_agreement_end ?? a.days_to_lockin_end ?? 999) - (b.days_to_agreement_end ?? b.days_to_lockin_end ?? 999));
  const onNotice = enriched.filter((c) => c.status === 'On Notice');
  const mrr = enriched.reduce((s, c) => s + num(c.mrr_ex_gst), 0);
  res.json({ today, counts: { accounts: enriched.length, due_today: dueToday.length, due_week: dueWeek.length, renewals: renewals.length, on_notice: onNotice.length, mrr_ex_gst: Math.round(mrr) }, due_today: dueToday, due_week: dueWeek, renewals, on_notice: onNotice, all: enriched });
});

/* ---------- SCOT monthly grid (which days each account was called) ---------- */
router.get('/scot/grid', async (req, res) => {
  const m = req.query.month || monthKey(new Date());
  const [a, b] = monthRange(m);
  const clients = (await repo.list('clients', { filters: { status__in: 'Active,On Notice' }, limit: 2000 })).rows;
  const logs = await db.query("SELECT client_id, at, outcome FROM call_logs WHERE client_id IS NOT NULL AND type IN ('SCOT call','Client visit','Renewal discussion','Meeting') AND at >= ? AND at < ?", [a, b]);
  const map = {};
  for (const l of logs) { const d = l.at.slice(8, 10); (map[l.client_id] = map[l.client_id] || {})[d] = l.outcome || 'Y'; }
  const days = new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0).getDate();
  res.json({ month: m, days, rows: clients.map((c) => ({ id: c.id, company: c.company, centre: c.centre_id_label, owner: c.relationship_owner_label, frequency: c.call_frequency_days, next_call_due: c.next_call_due, calls: map[c.id] || {} })) });
});

/* ---------- Red flags ---------- */
router.get('/red-flags', async (req, res) => {
  await fms.computeFlags();
  const rows = await fms.redFlags({ level: req.query.min_level });
  const counts = { l0: 0, l1: 0, l2: 0, l3: 0 };
  rows.forEach((r) => { counts['l' + (r.flag_level || 0)]++; });
  res.json({ rows, counts });
});

/* ---------- Today / dashboard ---------- */
router.get('/dashboard', async (req, res) => {
  await fms.computeFlags();
  const today = db.today();
  const now = db.fmtDateTime(new Date());
  const endOfDay = today + ' 23:59:59';
  const m = monthKey(new Date());
  const [a, b] = monthRange(m);
  const flags = await fms.redFlags({});
  const counts = { l1: 0, l2: 0, l3: 0 };
  flags.forEach((f) => { if (f.flag_level) counts['l' + f.flag_level]++; });
  const mine = req.query.mine === '1';
  const ownerSql = mine ? ' AND s.owner_user_id = ?' : '';
  const ownerP = mine ? [req.user.id] : [];
  const dueTodayAll = await db.query(`SELECT s.*, l.enq_no, l.client_name, l.company AS lead_company, l.mobile AS lead_mobile, c.company AS client_company, u.name AS owner_name FROM fms_steps s LEFT JOIN leads l ON l.id = s.lead_id LEFT JOIN clients c ON c.id = s.client_id LEFT JOIN users u ON u.id = s.owner_user_id WHERE s.status = 'pending' AND s.planned_at <= ? AND (l.id IS NULL OR l.stage NOT IN ('Won','Lost','Disqualified','Dormant'))${ownerSql} ORDER BY s.flow, s.lead_id, s.client_id, s.seq`, [endOfDay, ...ownerP]);
  const dueTodayCur = fms.currentOnly(dueTodayAll).sort((a, b) => String(a.planned_at).localeCompare(String(b.planned_at))).slice(0, 200);
  const scotDue = await db.query(`SELECT c.id, c.company, c.next_call_due, c.call_frequency_days, u.name AS owner_name, ce.name AS centre FROM clients c LEFT JOIN users u ON u.id = c.relationship_owner LEFT JOIN centres ce ON ce.id = c.centre_id WHERE c.status IN ('Active','On Notice') AND c.next_call_due <= ?${mine ? ' AND c.relationship_owner = ?' : ''} ORDER BY c.next_call_due LIMIT 200`, [today, ...ownerP]);
  const pipeline = await db.query("SELECT stage, COUNT(*) AS n, SUM(COALESCE(expected_mrr,0)) AS mrr FROM leads WHERE stage NOT IN ('Won','Lost','Disqualified') GROUP BY stage", []);
  const meca = (await mecaMonths([m], null))[0];
  const ft = await funnelTargets();
  const t = targetsFromFunnel(ft);
  const dsrToday = await db.query('SELECT d.*, u.name AS user_name FROM dsr d JOIN users u ON u.id = d.user_id WHERE d.date = ?', [today]);
  const salesUsers = await db.query("SELECT id, name FROM users WHERE role IN ('sc_crm','sales_head') AND is_active = 1", []);
  const renewals = (await db.query("SELECT id, company, agreement_end, lockin_end, mrr_ex_gst, status FROM clients WHERE status IN ('Active','On Notice') AND ((agreement_end IS NOT NULL AND agreement_end <= ?) OR (lockin_end IS NOT NULL AND lockin_end <= ?)) ORDER BY agreement_end", [db.fmtDate(wh.addCalendarDays(new Date(), 90)), db.fmtDate(wh.addCalendarDays(new Date(), 90))]));
  const inv = await db.query('SELECT i.*, c.name AS centre, p.name AS product FROM inventory i JOIN centres c ON c.id = i.centre_id JOIN products p ON p.id = i.product_id', []);
  const invSummary = { total: 0, occupied: 0, available_mrr: 0 };
  inv.forEach((i) => { invSummary.total += num(i.total_units); invSummary.occupied += num(i.occupied_units); invSummary.available_mrr += Math.max(num(i.total_units) - num(i.occupied_units), 0) * num(i.list_rate); });
  const winback = await db.query("SELECT id, enq_no, client_name, company, recontact_at FROM leads WHERE stage='Lost' AND winback_status='Scheduled' AND recontact_at <= ? ORDER BY recontact_at LIMIT 50", [today]);
  const golden = await db.query("SELECT id, company, next_action, next_action_at, status FROM golden_clients WHERE next_action_at <= ? AND status NOT IN ('Won','Dropped') ORDER BY next_action_at LIMIT 50", [today]);
  const newLeadsToday = num(await db.scalar('SELECT COUNT(*) FROM leads WHERE enq_at >= ?', [today + ' 00:00:00']));
  res.json({ today, now, month: m, red_flags: counts, red_flag_rows: flags.filter((f) => f.flag_level > 0).slice(0, 100), due_today: dueTodayCur, scot_due: scotDue, pipeline, meca, targets: t, dsr_today: dsrToday, sales_users: salesUsers, renewals, inventory: invSummary, winback_due: winback, golden_due: golden, new_leads_today: newLeadsToday });
});

/* ---------- WhatsApp-ready daily digest ---------- */
router.get('/digest', async (req, res) => {
  await fms.computeFlags();
  const flags = (await fms.redFlags({})).filter((f) => f.flag_level > 0);
  const today = db.today();
  const scotDue = await db.query("SELECT c.company, c.next_call_due, u.name AS owner FROM clients c LEFT JOIN users u ON u.id = c.relationship_owner WHERE c.status IN ('Active','On Notice') AND c.next_call_due <= ? ORDER BY c.next_call_due LIMIT 100", [today]);
  const m = monthKey(new Date());
  const meca = (await mecaMonths([m], null))[0];
  const lines = [`*SSPACIA Sales Autopilot — ${today}*`, ''];
  lines.push(`*Red flags:* L1 ${flags.filter((f) => f.flag_level === 1).length} · L2 ${flags.filter((f) => f.flag_level === 2).length} · L3 ${flags.filter((f) => f.flag_level === 3).length}`);
  flags.slice(0, 15).forEach((f) => lines.push(`${'🔴'.repeat(Math.min(f.flag_level, 3))} ${f.enq_no || f.client_company || ''} ${f.client_name || ''} — ${f.name} (planned ${String(f.planned_at).slice(0, 16)}, ${f.delay_hours} h late) → ${f.owner_name || '?'}`));
  lines.push('', `*SCOT calls due:* ${scotDue.length}`);
  scotDue.slice(0, 15).forEach((c) => lines.push(`• ${c.company} (due ${c.next_call_due}) → ${c.owner || '?'}`));
  lines.push('', `*This month:* enquiries ${meca.enquiries} · meetings ${meca.meetings} (plan ${meca.plan.meetings}) · proposals ${meca.proposals} · won ${meca.won} (plan ${meca.plan.won}) · MRR won ₹${meca.mrr_won.toLocaleString('en-IN')}`);
  res.json({ text: lines.join('\n') });
});

/* ---------- Funnel targets (settings) ---------- */
router.get('/funnel', async (req, res) => { const ft = await funnelTargets(); res.json({ inputs: ft, targets: targetsFromFunnel(ft) }); });
router.post('/funnel', auth.requireRole(['sales_head']), async (req, res) => {
  const cur = await funnelTargets();
  const next = Object.assign({}, cur);
  for (const [k, v] of Object.entries(req.body || {})) if (k in cur) next[k] = Number(v);
  await repo.setSetting('funnel_targets', next);
  res.json({ inputs: next, targets: targetsFromFunnel(next) });
});

/* ---------- Weekly review data ---------- */
router.get('/weekly', async (req, res) => {
  const ws = req.query.week_start ? db.parseDateTime(req.query.week_start) : null;
  const today = new Date();
  const dow = (today.getDay() + 6) % 7;
  const start = ws || new Date(today.getFullYear(), today.getMonth(), today.getDate() - dow);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  const a = db.fmtDateTime(start), b = db.fmtDateTime(end);
  const totals = await db.one('SELECT SUM(calls_made) AS calls_made, SUM(calls_connected) AS calls_connected, SUM(new_leads) AS new_leads, SUM(tours) AS tours, SUM(proposals) AS proposals, SUM(follow_ups) AS follow_ups, SUM(scot_calls) AS scot_calls, SUM(closures) AS closures, SUM(mrr_won) AS mrr_won, COUNT(*) AS reports FROM dsr WHERE date >= ? AND date < ?', [a.slice(0, 10), b.slice(0, 10)]);
  const enquiries = num(await db.scalar('SELECT COUNT(*) FROM leads WHERE enq_at >= ? AND enq_at < ?', [a, b]));
  const meetings = num(await db.scalar("SELECT COUNT(DISTINCT lead_id) FROM fms_steps WHERE flow='NBD' AND code='TOUR' AND status='done' AND actual_at >= ? AND actual_at < ?", [a, b]));
  const proposals = num(await db.scalar('SELECT COUNT(*) FROM leads WHERE proposal_sent_at >= ? AND proposal_sent_at < ?', [a, b]));
  const won = await db.one("SELECT COUNT(*) AS n, SUM(won_mrr) AS mrr FROM leads WHERE stage='Won' AND won_at >= ? AND won_at < ?", [a, b]);
  const lost = await db.query("SELECT l.enq_no, l.client_name, l.company, r.reason, l.lost_notes FROM leads l LEFT JOIN lost_reasons r ON r.id = l.lost_reason_id WHERE l.stage='Lost' AND l.lost_at >= ? AND l.lost_at < ?", [a, b]);
  const sources = await db.query('SELECT s.name AS source, COUNT(*) AS n, SUM(CASE WHEN l.stage = \'Won\' THEN 1 ELSE 0 END) AS won FROM leads l JOIN lead_sources s ON s.id = l.source_id WHERE l.enq_at >= ? AND l.enq_at < ? GROUP BY s.name ORDER BY n DESC', [a, b]);
  const pipeline = await db.query("SELECT stage, COUNT(*) AS n, SUM(COALESCE(expected_mrr,0)) AS mrr FROM leads WHERE stage NOT IN ('Won','Lost','Disqualified') GROUP BY stage", []);
  await fms.computeFlags();
  const flags = (await fms.redFlags({})).filter((f) => f.flag_level > 0);
  const ft = await funnelTargets();
  const t = targetsFromFunnel(ft);
  const weekTarget = {}; for (const k of Object.keys(t.month)) weekTarget[k] = r2(t.month[k] * 12 / 52);
  const review = await db.one('SELECT * FROM weekly_reviews WHERE week_start = ?', [db.fmtDate(start)]);
  res.json({ week_start: db.fmtDate(start), week_end: db.fmtDate(new Date(end - 86400000)), dsr: totals, enquiries, meetings, proposals, won: num(won.n), mrr_won: num(won.mrr), lost, sources, pipeline, red_flags: flags.length, red_flag_rows: flags.slice(0, 50), targets: weekTarget, review });
});

module.exports = { router, funnelTargets, targetsFromFunnel, mecaMonths };
