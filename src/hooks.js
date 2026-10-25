'use strict';
/** Business rules that fire around generic CRUD. */
const db = require('./db');
const repo = require('./repo');
const fms = require('./fms');
const wh = require('./workhours');
const auth = require('./auth');

const beforeCreate = {};
const afterCreate = {};
const beforeUpdate = {};
const afterUpdate = {};
const beforeDelete = {};

/* ---------- enquiries ---------- */
async function nextEnqNo() {
  const d = new Date();
  const prefix = `ENQ-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}-`;
  const last = await db.one('SELECT enq_no FROM leads WHERE enq_no LIKE ? ORDER BY enq_no DESC LIMIT 1', [prefix + '%']);
  const n = last ? parseInt(last.enq_no.slice(prefix.length), 10) + 1 : 1;
  return prefix + String(n).padStart(3, '0');
}

beforeCreate.leads = async (data, req) => {
  data.enq_no = data.enq_no || await nextEnqNo();
  data.enq_at = data.enq_at || db.fmtDateTime(new Date());
  data.created_by = req.user ? req.user.id : null;
  if (!data.assigned_to) {
    const sc = await db.one("SELECT id FROM users WHERE role = 'sc_crm' AND is_active = 1 ORDER BY id LIMIT 1", []);
    data.assigned_to = sc ? sc.id : (req.user ? req.user.id : null);
  }
  data.stage = data.stage || 'New';
  await applyLeadStageRules(null, data);
};
afterCreate.leads = async (id) => {
  const lead = await db.one('SELECT * FROM leads WHERE id = ?', [id]);
  await fms.generateSteps('NBD', { lead, start: db.parseDateTime(lead.enq_at) || new Date() });
  await fms.syncLeadNextAction(id);
  await afterStageChange(null, lead);
};
beforeUpdate.leads = async (before, data) => { await applyLeadStageRules(before, data); };
afterUpdate.leads = async (before, data) => {
  const lead = await db.one('SELECT * FROM leads WHERE id = ?', [before.id]);
  if (data.assigned_to && data.assigned_to !== before.assigned_to) {
    await db.exec("UPDATE fms_steps SET owner_user_id = ? WHERE flow = 'NBD' AND lead_id = ? AND status = 'pending'", [data.assigned_to, lead.id]);
  }
  if (data.enq_at && data.enq_at !== before.enq_at) await fms.rechain('NBD', lead.id);
  await afterStageChange(before, lead);
};

async function applyLeadStageRules(before, data) {
  const now = db.fmtDateTime(new Date());
  if (data.stage === 'Won') {
    data.won_at = data.won_at || (before && before.won_at) || now;
    if (!data.won_mrr && before && before.expected_mrr) data.won_mrr = before.expected_mrr;
  }
  if (data.stage === 'Lost') {
    data.lost_at = data.lost_at || (before && before.lost_at) || now;
    if (!data.recontact_at && !(before && before.recontact_at)) data.recontact_at = db.fmtDate(wh.addCalendarDays(db.parseDateTime(data.lost_at), 90));
    if (!data.winback_status && !(before && before.winback_status)) data.winback_status = 'Scheduled';
  }
}

async function afterStageChange(before, lead) {
  const prevStage = before ? before.stage : null;
  if (lead.stage === 'Won' && prevStage !== 'Won') {
    // mark every pending NBD step as done/skipped and close
    await db.exec("UPDATE fms_steps SET status = 'na', flag_level = 0 WHERE flow = 'NBD' AND lead_id = ? AND status = 'pending'", [lead.id]);
    await db.exec("UPDATE fms_steps SET status = 'done', actual_at = ?, outcome = 'Closed - won' WHERE flow = 'NBD' AND lead_id = ? AND code = 'CLOSE'", [lead.won_at || db.fmtDateTime(new Date()), lead.id]);
    let clientId = lead.client_id;
    if (!clientId) {
      const rent = lead.won_mrr || lead.expected_mrr || null;
      clientId = await repo.insert('clients', {
        company: lead.company || lead.client_name, centre_id: lead.centre_id, product_id: lead.product_id, seats: lead.seats,
        mrr_ex_gst: rent, monthly_rent: rent ? Math.round(rent * 1.18) : null, start_date: db.fmtDate(lead.won_at || new Date()),
        status: 'Active', industry: lead.nature_of_business, relationship_owner: lead.assigned_to, call_frequency_days: 30,
        next_call_due: db.fmtDate(wh.addCalendarDays(new Date(), 7)), source: lead.reference ? 'Referral' : 'NBD', won_lead_id: lead.id,
        address: lead.company_address, notes: `Won from ${lead.enq_no}`,
      });
      await repo.insert('client_contacts', { client_id: clientId, name: lead.client_name, designation: lead.designation, mobile: lead.mobile, email: lead.email, is_primary: 1 });
      await repo.update('leads', lead.id, { client_id: clientId });
    }
    const client = await db.one('SELECT * FROM clients WHERE id = ?', [clientId]);
    await fms.generateSteps('CRM', { client, lead, start: db.parseDateTime(lead.won_at) || new Date() });
    await repo.update('leads', lead.id, { next_action: 'CRM FMS: onboarding', next_action_at: null });
  }
  if (['Lost', 'Disqualified', 'Dormant'].includes(lead.stage) && prevStage !== lead.stage) {
    await db.exec("UPDATE fms_steps SET status = 'na', flag_level = 0 WHERE flow = 'NBD' AND lead_id = ? AND status = 'pending'", [lead.id]);
    await repo.update('leads', lead.id, { next_action: lead.stage === 'Lost' ? 'Win-back re-contact' : null, next_action_at: lead.stage === 'Lost' && lead.recontact_at ? lead.recontact_at + ' 11:00:00' : null });
  }
  if (!['Won', 'Lost', 'Disqualified', 'Dormant'].includes(lead.stage) && ['Lost', 'Disqualified', 'Dormant'].includes(prevStage)) {
    // re-opened: regenerate pending steps from now
    await db.exec("DELETE FROM fms_steps WHERE flow = 'NBD' AND lead_id = ? AND status = 'na'", [lead.id]);
    await fms.rechain('NBD', lead.id);
  }
}

/* ---------- clients ---------- */
function clientDerived(data, before) {
  const rent = data.monthly_rent !== undefined ? data.monthly_rent : (before ? before.monthly_rent : null);
  const ex = data.mrr_ex_gst !== undefined ? data.mrr_ex_gst : (before ? before.mrr_ex_gst : null);
  if ((ex === null || ex === undefined || ex === '') && rent) data.mrr_ex_gst = Math.round(rent / 1.18);
  const freq = data.call_frequency_days !== undefined ? data.call_frequency_days : (before ? before.call_frequency_days : 30);
  const last = data.last_call_at !== undefined ? data.last_call_at : (before ? before.last_call_at : null);
  if (data.next_call_due === undefined || data.next_call_due === null) {
    if (last) data.next_call_due = db.fmtDate(wh.addCalendarDays(db.parseDateTime(last), freq || 30));
    else if (!before || !before.next_call_due) data.next_call_due = db.today();
  }
  if (data.status === 'On Notice' && !data.notice_date && !(before && before.notice_date)) data.notice_date = db.today();
}
beforeCreate.clients = async (data) => { clientDerived(data, null); };
beforeUpdate.clients = async (before, data) => { clientDerived(data, before); };
afterUpdate.clients = async (before, data) => {
  if (data.start_date && data.start_date !== before.start_date) await fms.rechain('CRM', before.id);
};

/* ---------- SCOT call logs ---------- */
afterCreate.call_logs = async (id, data) => {
  if (data.client_id && ['SCOT call', 'Client visit', 'Renewal discussion', 'Meeting'].includes(data.type) && data.outcome !== 'Not reached') {
    const c = await db.one('SELECT * FROM clients WHERE id = ?', [data.client_id]);
    if (c) {
      const at = db.parseDateTime(data.at) || new Date();
      const freq = c.call_frequency_days || 30;
      await repo.update('clients', c.id, { last_call_at: db.fmtDateTime(at), next_call_due: db.fmtDate(wh.addCalendarDays(at, freq)) });
    }
  }
  if (data.lead_id && data.next_action) {
    await repo.update('leads', data.lead_id, { next_action: data.next_action, next_action_at: data.next_action_at || null });
  }
};

/* ---------- golden clients ---------- */
function icp(data, before) {
  const g = (k) => Number(data[k] !== undefined ? data[k] : (before ? before[k] : 0)) || 0;
  data.icp_score = g('icp_industry') + g('icp_size') + g('icp_location') + g('icp_timing') + g('icp_budget');
}
beforeCreate.golden_clients = async (data) => { icp(data, null); };
beforeUpdate.golden_clients = async (before, data) => { icp(data, before); };

/* ---------- proposals ---------- */
async function priceProposal(data, before) {
  const g = (k, d) => (data[k] !== undefined && data[k] !== null ? Number(data[k]) : (before && before[k] !== null && before[k] !== undefined ? Number(before[k]) : d));
  const seats = g('seats', 1), rate = g('rate', 0), disc = g('discount_pct', 0), gst = g('gst_pct', 18), dep = g('deposit_months', 2);
  const monthly = Math.round(seats * rate * (1 - disc / 100));
  data.amount_ex_gst = monthly;
  data.gst_amount = Math.round(monthly * gst / 100);
  data.amount_incl_gst = monthly + data.gst_amount;
  data.deposit_amount = Math.round(monthly * dep);
  data.first_payment = data.deposit_amount + data.amount_incl_gst;
  const lv = await repo.getSetting('discount_levels', { cm: 5, sales_head: 10 });
  data.approval_level = disc <= 0 ? 'None needed' : disc <= lv.cm ? 'Community Manager (≤' + lv.cm + '%)' : disc <= lv.sales_head ? 'Sales Head (≤' + lv.sales_head + '%)' : 'Praveen (>' + lv.sales_head + '%)';
}
beforeCreate.proposals = async (data, req) => { await priceProposal(data, null); data.created_by = req.user ? req.user.id : null; if (data.status === 'Sent' && !data.sent_at) data.sent_at = db.fmtDateTime(new Date()); };
beforeUpdate.proposals = async (before, data) => { await priceProposal(data, before); if (data.status === 'Sent' && !before.sent_at && !data.sent_at) data.sent_at = db.fmtDateTime(new Date()); };
async function proposalSync(id) {
  const p = await db.one('SELECT * FROM proposals WHERE id = ?', [id]);
  if (!p || !p.lead_id) return;
  const lead = await db.one('SELECT * FROM leads WHERE id = ?', [p.lead_id]);
  const patch = {};
  if (!lead.expected_mrr || Number(lead.expected_mrr) === 0) patch.expected_mrr = p.amount_ex_gst;
  if (p.status === 'Sent' && !lead.proposal_sent_at) {
    patch.proposal_sent_at = p.sent_at || db.fmtDateTime(new Date());
    const step = await db.one("SELECT id FROM fms_steps WHERE flow = 'NBD' AND lead_id = ? AND code = 'PROP' AND status = 'pending'", [lead.id]);
    if (step) await fms.markDone(step.id, { actual_at: patch.proposal_sent_at, outcome: 'Proposal shared', notes: `Proposal #${p.id}` });
    if (!['Won', 'Lost'].includes(lead.stage)) patch.stage = 'Proposal Sent';
  }
  if (p.status === 'Accepted' && lead.stage !== 'Won') patch.stage = 'Negotiation';
  if (Object.keys(patch).length) await repo.update('leads', lead.id, patch);
}
afterCreate.proposals = async (id) => { await proposalSync(id); };
afterUpdate.proposals = async (before) => { await proposalSync(before.id); };

/* ---------- users ---------- */
beforeCreate.users = async (data, req) => {
  data.email = String(data.email || '').trim().toLowerCase();
  if (req.body && req.body.password) data.password_hash = auth.hashPassword(req.body.password);
};
beforeUpdate.users = async (before, data, req) => {
  if (data.email) data.email = String(data.email).trim().toLowerCase();
  if (req.body && req.body.password) data.password_hash = auth.hashPassword(req.body.password);
  if (before.id === req.user.id && data.role && data.role !== 'admin' && req.user.role === 'admin') delete data.role; // never demote yourself
  if (before.id === req.user.id && data.is_active === 0) delete data.is_active;
};
beforeDelete.users = async (id, req) => { if (Number(id) === req.user.id) throw new Error('You cannot delete your own account'); };

/* ---------- DSR ---------- */
beforeCreate.dsr = async (data, req) => { data.user_id = data.user_id || req.user.id; data.submitted_at = db.fmtDateTime(new Date()); };
beforeUpdate.dsr = async (before, data) => { data.submitted_at = db.fmtDateTime(new Date()); };

/* ---------- stage definitions: re-chain planned dates of every open lead when offsets change ---------- */
afterUpdate.fms_stage_defs = async (before) => {
  const flow = before.flow;
  if (flow === 'NBD') {
    const open = await db.query("SELECT id FROM leads WHERE stage NOT IN ('Won','Lost','Disqualified','Dormant')", []);
    for (const l of open) await fms.rechain('NBD', l.id);
  }
};
afterCreate.fms_stage_defs = afterUpdate.fms_stage_defs;

module.exports = { beforeCreate, afterCreate, beforeUpdate, afterUpdate, beforeDelete, nextEnqNo };
