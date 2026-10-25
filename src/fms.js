'use strict';
/**
 * FMS engine — Flow Management System (planned vs actual per step, red flags on delay).
 * NBD flow runs per enquiry (lead); CRM flow runs per won client (agreement → first payment).
 */
const db = require('./db');
const repo = require('./repo');
const wh = require('./workhours');

const STAGE_TO_LEAD_STAGE = { QUAL: 'Qualified', TOUR: 'Tour Done', PROP: 'Proposal Sent', NEG: 'Negotiation' };
const FLAG_ROLE = { 1: 'pc', 2: 'sales_head', 3: 'admin' };
const FLAG_LABEL = { 0: 'On time', 1: 'Red flag → Process Coordinator', 2: 'Escalated → Problem Solver', 3: 'Escalated → Praveen' };

async function workCfg() {
  return repo.getSetting('workhours', wh.DEFAULT);
}
async function flagCfg() {
  return repo.getSetting('redflag', { l1: 2, l2: 24, l3: 72 });
}

function addOffset(from, def, cfg) {
  const v = Number(def.offset_value || 0);
  if (def.offset_unit === 'working_days') return wh.addWorkingDays(from, v, cfg);
  if (def.offset_unit === 'calendar_days') return wh.alignForward(wh.addCalendarDays(from, v), cfg);
  return wh.addWorkingHours(from, v, cfg);
}

function anchorDate(def, ctx, prevPlannedOrActual) {
  const p = db.parseDateTime;
  switch (def.anchor) {
    case 'enquiry': return p(ctx.lead && ctx.lead.enq_at) || ctx.start;
    case 'proposal': return p(ctx.lead && ctx.lead.proposal_sent_at) || ctx.propPlanned || prevPlannedOrActual || ctx.start;
    case 'won': return p(ctx.lead && ctx.lead.won_at) || p(ctx.client && ctx.client.start_date) || ctx.start;
    case 'move_in': return p(ctx.client && ctx.client.start_date) || p(ctx.lead && ctx.lead.won_at) || ctx.start;
    default: return prevPlannedOrActual || ctx.start;
  }
}

/** Create (or re-create missing) steps for a flow. */
async function generateSteps(flow, ctx) {
  const cfg = await workCfg();
  const defs = (await repo.list('fms_stage_defs', { filters: { flow, is_active: 1 }, limit: 100 })).rows;
  const keyCol = flow === 'NBD' ? 'lead_id' : 'client_id';
  const keyVal = flow === 'NBD' ? ctx.lead.id : ctx.client.id;
  const existing = await db.query(`SELECT * FROM fms_steps WHERE flow = ? AND ${keyCol} = ? ORDER BY seq`, [flow, keyVal]);
  const byCode = new Map(existing.map((s) => [s.code, s]));
  let prev = null; // Date of the previous step (actual if done else planned)
  let owner = flow === 'NBD' ? (ctx.lead.assigned_to || null) : (ctx.client.relationship_owner || null);
  const created = [];
  for (const def of defs) {
    let step = byCode.get(def.code);
    const from = anchorDate(def, ctx, prev);
    const planned = addOffset(from, def, cfg);
    if (!step) {
      const id = await repo.insert('fms_steps', {
        flow, lead_id: flow === 'NBD' ? ctx.lead.id : (ctx.lead ? ctx.lead.id : null), client_id: flow === 'CRM' ? ctx.client.id : (ctx.client ? ctx.client.id : null),
        stage_def_id: def.id, seq: def.seq, code: def.code, name: def.name,
        owner_user_id: await ownerFor(def, ctx, owner), planned_at: db.fmtDateTime(planned), status: 'pending', flag_level: 0,
      });
      step = await db.one('SELECT * FROM fms_steps WHERE id = ?', [id]);
      created.push(step);
    } else if (step.status === 'pending') {
      await repo.update('fms_steps', step.id, { planned_at: db.fmtDateTime(planned), seq: def.seq, name: def.name });
      step.planned_at = db.fmtDateTime(planned);
    }
    if (def.code === 'PROP') ctx.propPlanned = db.parseDateTime(step.actual_at) || planned;
    prev = db.parseDateTime(step.actual_at) || db.parseDateTime(step.planned_at) || planned;
  }
  return created;
}

async function ownerFor(def, ctx, fallback) {
  if (def.who_role) {
    if (ctx.lead && ctx.lead.assigned_to && ['sc_crm', 'sales_head'].includes(def.who_role)) return ctx.lead.assigned_to;
    if (def.who_role === 'cm') {
      const centreId = (ctx.lead && ctx.lead.centre_id) || (ctx.client && ctx.client.centre_id);
      if (centreId) {
        const c = await db.one('SELECT cm_user_id FROM centres WHERE id = ?', [centreId]);
        if (c && c.cm_user_id) return c.cm_user_id;
      }
    }
    const u = await db.one('SELECT id FROM users WHERE role = ? AND is_active = 1 ORDER BY id LIMIT 1', [def.who_role]);
    if (u) return u.id;
  }
  return fallback;
}

/** Re-chain planned dates after a change (actual recorded, offsets edited, ...). */
async function rechain(flow, keyId) {
  if (flow === 'NBD') {
    const lead = await db.one('SELECT * FROM leads WHERE id = ?', [keyId]);
    if (!lead) return;
    await generateSteps('NBD', { lead, start: db.parseDateTime(lead.enq_at) || new Date() });
    await syncLeadNextAction(lead.id);
  } else {
    const client = await db.one('SELECT * FROM clients WHERE id = ?', [keyId]);
    if (!client) return;
    const lead = client.won_lead_id ? await db.one('SELECT * FROM leads WHERE id = ?', [client.won_lead_id]) : null;
    await generateSteps('CRM', { client, lead, start: db.parseDateTime(client.start_date) || db.parseDateTime(lead && lead.won_at) || new Date() });
  }
}

async function syncLeadNextAction(leadId) {
  const next = await db.one("SELECT * FROM fms_steps WHERE flow = 'NBD' AND lead_id = ? AND status = 'pending' ORDER BY seq LIMIT 1", [leadId]);
  if (next) await repo.update('leads', leadId, { next_action: next.name, next_action_at: next.planned_at });
  else await repo.update('leads', leadId, { next_action: null, next_action_at: null });
}

/** Record the actual completion of a step. */
async function markDone(stepId, { actual_at, outcome, notes, user_id, status = 'done' }) {
  const step = await db.one('SELECT * FROM fms_steps WHERE id = ?', [stepId]);
  if (!step) throw new Error('Step not found');
  const actual = db.fmtDateTime(actual_at || new Date());
  await repo.update('fms_steps', stepId, { actual_at: status === 'done' ? actual : null, status, outcome: outcome || null, notes: notes || null, flag_level: 0 });
  // the flow has moved on: earlier steps still pending are no longer due
  const keyCol = step.flow === 'NBD' ? 'lead_id' : 'client_id';
  const keyVal = step.flow === 'NBD' ? step.lead_id : step.client_id;
  if (keyVal) await db.exec(`UPDATE fms_steps SET status = 'na', outcome = 'Skipped (later step completed)', flag_level = 0 WHERE flow = ? AND ${keyCol} = ? AND seq < ? AND status = 'pending'`, [step.flow, keyVal, step.seq]);
  if (step.flow === 'NBD' && step.lead_id) {
    const lead = await db.one('SELECT * FROM leads WHERE id = ?', [step.lead_id]);
    const patch = {};
    if (status === 'done') {
      if (step.code === 'QUAL') { if (outcome === 'Not qualified') patch.qualification_status = 'No'; else patch.qualification_status = 'Yes'; }
      if (step.code === 'TOUR') patch.tour_at = actual;
      if (step.code === 'PROP') patch.proposal_sent_at = actual;
      const ls = STAGE_TO_LEAD_STAGE[step.code];
      if (ls && !['Won', 'Lost', 'Disqualified'].includes(lead.stage) && (outcome !== 'Not qualified')) patch.stage = ls;
      if (step.code === 'QUAL' && outcome === 'Not qualified') patch.stage = 'Disqualified';
    }
    if (Object.keys(patch).length) await repo.update('leads', step.lead_id, patch);
    await rechain('NBD', step.lead_id);
    await repo.insert('call_logs', { at: actual, type: stepTypeToActivity(step.code), lead_id: step.lead_id, client_id: lead.client_id || null, user_id: user_id || step.owner_user_id || null, outcome: outcome || null, notes: `[FMS ${step.code}] ${step.name}${notes ? ' — ' + notes : ''}` });
  } else if (step.flow === 'CRM' && step.client_id) {
    await rechain('CRM', step.client_id);
    await repo.insert('call_logs', { at: actual, type: 'Other', client_id: step.client_id, lead_id: step.lead_id || null, user_id: user_id || step.owner_user_id || null, outcome: outcome || null, notes: `[CRM FMS ${step.code}] ${step.name}${notes ? ' — ' + notes : ''}` });
  }
  return db.one('SELECT * FROM fms_steps WHERE id = ?', [stepId]);
}

function stepTypeToActivity(code) {
  if (code === 'QUAL') return 'Qualification call';
  if (code === 'TOUR') return 'Tour';
  if (code === 'PROP') return 'Proposal discussed' === code ? 'Other' : 'WhatsApp';
  if (/^FU/.test(code)) return 'Follow-up call';
  return 'Other';
}

/** Key of the flow instance a step belongs to. */
function instanceKey(s) { return `${s.flow}:${s.flow === 'NBD' ? s.lead_id : s.client_id}`; }

/** Only the earliest pending step of each flow instance is "current" — later steps wait for it. */
function currentOnly(steps) {
  const seen = new Set();
  const out = [];
  for (const s of steps) {
    const k = instanceKey(s);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

/** Compute red-flag levels on the current pending step of every open flow (idempotent). Returns summary. */
async function computeFlags() {
  const cfg = await workCfg();
  const thr = await flagCfg();
  const now = new Date();
  const steps = await db.query("SELECT s.id, s.planned_at, s.flag_level, s.flow, s.lead_id, s.client_id, s.seq FROM fms_steps s LEFT JOIN leads l ON l.id = s.lead_id WHERE s.status = 'pending' AND s.planned_at IS NOT NULL AND (s.flow <> 'NBD' OR l.stage IS NULL OR l.stage NOT IN ('Won','Lost','Disqualified','Dormant')) ORDER BY s.flow, s.lead_id, s.client_id, s.seq", []);
  const current = new Set(currentOnly(steps).map((s) => s.id));
  const summary = { checked: steps.length, l1: 0, l2: 0, l3: 0, changed: 0 };
  for (const s of steps) {
    let level = 0;
    if (current.has(s.id)) {
      const planned = db.parseDateTime(s.planned_at);
      const delay = planned ? wh.workingHoursBetween(planned, now, cfg) : 0;
      if (delay >= thr.l3) level = 3; else if (delay >= thr.l2) level = 2; else if (delay >= thr.l1) level = 1;
    }
    if (level) summary['l' + level]++;
    if (level !== Number(s.flag_level || 0)) {
      await repo.update('fms_steps', s.id, { flag_level: level, escalated_at: level ? db.fmtDateTime(now) : null });
      summary.changed++;
    }
  }
  return summary;
}

/** Pending steps with delay in working hours, enriched with lead/client details. */
async function redFlags({ userId, role, level } = {}) {
  const cfg = await workCfg();
  const now = new Date();
  const rows = await db.query(`SELECT s.*, l.enq_no, l.client_name, l.company AS lead_company, l.mobile AS lead_mobile, l.stage AS lead_stage, l.assigned_to,
      c.company AS client_company, u.name AS owner_name, u.role AS owner_role
      FROM fms_steps s LEFT JOIN leads l ON l.id = s.lead_id LEFT JOIN clients c ON c.id = s.client_id LEFT JOIN users u ON u.id = s.owner_user_id
      WHERE s.status = 'pending' AND (s.flow <> 'NBD' OR l.id IS NULL OR l.stage NOT IN ('Won','Lost','Disqualified','Dormant'))
      ORDER BY s.planned_at`, []);
  const out = [];
  for (const r of currentOnly(rows.slice().sort((a, b) => (instanceKey(a) < instanceKey(b) ? -1 : instanceKey(a) > instanceKey(b) ? 1 : a.seq - b.seq)))) {
    const planned = db.parseDateTime(r.planned_at);
    r.delay_hours = planned ? Math.round(wh.workingHoursBetween(planned, now, cfg) * 10) / 10 : 0;
    r.flag_label = FLAG_LABEL[r.flag_level || 0];
    r.escalate_to_role = FLAG_ROLE[r.flag_level] || null;
    if (level !== undefined && Number(r.flag_level || 0) < Number(level)) continue;
    out.push(r);
  }
  out.sort((a, b) => (b.flag_level || 0) - (a.flag_level || 0) || String(a.planned_at).localeCompare(String(b.planned_at)));
  return out;
}

module.exports = { generateSteps, rechain, markDone, computeFlags, redFlags, syncLeadNextAction, currentOnly, instanceKey, FLAG_ROLE, FLAG_LABEL, workCfg, flagCfg };
