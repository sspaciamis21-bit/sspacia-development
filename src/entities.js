'use strict';
/**
 * Entity registry — the single source of truth for tables, forms and list views.
 * Field types: string, text, int, decimal, money, pct, date, datetime, bool, select, ref, json, password
 * `ref` fields point at another entity (shown as a dropdown; the API returns `<name>_label`).
 */

const ROLES = ['admin', 'sales_head', 'sc_crm', 'cm', 'pc', 'mis', 'accounts', 'viewer'];
const ROLE_LABELS = {
  admin: 'Executive (Admin)', sales_head: 'Sales Head / Problem Solver', sc_crm: 'Sales Coordinator-cum-CRM',
  cm: 'Community Manager', pc: 'Process Coordinator', mis: 'MIS', accounts: 'Accounts', viewer: 'Viewer',
};
const ALL = ROLES;
const OPS = ['admin', 'sales_head', 'sc_crm', 'cm', 'pc', 'mis', 'accounts'];
const SALES = ['admin', 'sales_head', 'sc_crm', 'cm', 'pc'];
const ADMIN = ['admin'];
const ADMIN_MIS = ['admin', 'mis'];

const LEAD_STAGES = ['New', 'Qualified', 'Tour Done', 'Proposal Sent', 'Negotiation', 'Won', 'Lost', 'Dormant', 'Disqualified'];
const CLIENT_STATUS = ['Active', 'On Notice', 'Inactive', 'Terminated', 'Prospect'];
const GEO = ['Local', 'National', 'International'];
const BUSINESS_TYPES = ['BFSI / Finance', 'IT / Technology', 'Consulting / Professional services', 'Pharma / Healthcare', 'Manufacturing / Engineering', 'Logistics / Trading', 'E-commerce / Retail', 'Real estate / Infra', 'Recruitment / HR', 'Education / Training', 'Media / Marketing', 'Startup', 'Government / NGO', 'Other'];

const E = {};

/* ---------------- masters ---------------- */
E.centres = {
  label: 'Centre', plural: 'Centres', group: 'Masters', icon: 'building',
  roles: { read: ALL, write: ADMIN_MIS },
  fields: [
    { name: 'name', label: 'Centre', type: 'string', required: true, list: true },
    { name: 'code', label: 'Code', type: 'string', required: true, list: true, help: 'Short code, e.g. MER, AGC, PRH' },
    { name: 'address', label: 'Address', type: 'text' },
    { name: 'cm_user_id', label: 'Community Manager', type: 'ref', ref: 'users', list: true },
    { name: 'total_seats', label: 'Total seats', type: 'int', list: true },
    { name: 'opening_hours', label: 'Opening hours', type: 'string', default: 'Mon–Sat 10:00–19:00' },
    { name: 'is_active', label: 'Active', type: 'bool', default: 1, list: true },
  ],
  orderBy: 'name',
};

E.products = {
  label: 'Product', plural: 'Products (what we sell)', group: 'Masters', icon: 'box',
  roles: { read: ALL, write: ADMIN_MIS },
  fields: [
    { name: 'name', label: 'Product', type: 'string', required: true, list: true },
    { name: 'code', label: 'Code', type: 'string', required: true, list: true },
    { name: 'unit', label: 'Unit of sale', type: 'select', options: ['seat/month', 'cabin/month', 'desk/month', 'office/month', 'hour', 'day', 'slot/month', 'one-time'], default: 'seat/month', list: true },
    { name: 'variable_cost_pct', label: 'Variable cost %', type: 'pct', default: 0, list: true, help: 'Used by the G.P. Sheet' },
    { name: 'sort', label: 'Sort', type: 'int', default: 0 },
    { name: 'is_active', label: 'Active', type: 'bool', default: 1, list: true },
  ],
  orderBy: 'sort, name',
};

E.rate_card = {
  label: 'Rate', plural: 'Rate Card', group: 'Masters', icon: 'tag',
  roles: { read: ALL, write: ['admin', 'sales_head'] },
  fields: [
    { name: 'centre_id', label: 'Centre', type: 'ref', ref: 'centres', list: true, help: 'Blank = all centres' },
    { name: 'product_id', label: 'Product', type: 'ref', ref: 'products', required: true, list: true },
    { name: 'rate', label: 'List rate (₹/unit/month, ex-GST)', type: 'money', required: true, list: true },
    { name: 'floor_rate', label: 'Floor rate (₹, ex-GST)', type: 'money', list: true, help: 'Below this needs Praveen' },
    { name: 'deposit_months', label: 'Deposit (months)', type: 'decimal', default: 2, list: true },
    { name: 'lockin_months', label: 'Standard lock-in (months)', type: 'int', default: 11, list: true },
    { name: 'notes', label: 'Notes', type: 'text' },
  ],
  orderBy: 'centre_id, product_id',
};

E.lead_sources = {
  label: 'Lead source', plural: 'Lead Sources', group: 'Masters', icon: 'signpost',
  roles: { read: ALL, write: ['admin', 'sales_head', 'mis'] },
  fields: [
    { name: 'name', label: 'Source', type: 'string', required: true, list: true },
    { name: 'code', label: 'Source code', type: 'string', required: true, list: true },
    { name: 'channel_type', label: 'Type', type: 'select', options: ['Inbound', 'Outbound', 'Referral', 'Paid', 'Partner', 'Existing client'], list: true },
    { name: 'is_active', label: 'Active', type: 'bool', default: 1, list: true },
  ],
  orderBy: 'name',
};

E.users = {
  label: 'User', plural: 'Users & Roles', group: 'Administration', icon: 'users',
  roles: { read: ALL, write: ADMIN },
  fields: [
    { name: 'name', label: 'Name', type: 'string', required: true, list: true },
    { name: 'email', label: 'E-mail (login)', type: 'string', required: true, list: true },
    { name: 'mobile', label: 'Mobile', type: 'string', list: true },
    { name: 'role', label: 'Role', type: 'select', options: ROLES, optionLabels: ROLE_LABELS, required: true, list: true },
    { name: 'centre_id', label: 'Centre (for CMs)', type: 'ref', ref: 'centres', list: true },
    { name: 'password', label: 'Set password', type: 'password', help: 'Leave blank to keep the current password' },
    { name: 'is_active', label: 'Active', type: 'bool', default: 1, list: true },
    { name: 'last_login_at', label: 'Last login', type: 'datetime', readonly: true, list: true },
  ],
  hiddenFields: ['password_hash'],
  extraColumns: [{ name: 'password_hash', type: 'string' }],
  orderBy: 'name',
};

/* ---------------- Science 1: Enquiry capture & Sales FMS ---------------- */
E.leads = {
  label: 'Enquiry', plural: 'Enquiry Capture / Lead Register', group: 'New Business (NBD)', icon: 'inbox',
  roles: { read: ALL, write: SALES },
  fields: [
    { name: 'enq_no', label: 'Enq. No.', type: 'string', readonly: true, list: true },
    { name: 'enq_at', label: 'Enquiry date & time', type: 'datetime', required: true, list: true, default: 'now' },
    { name: 'source_id', label: 'Enquiry source', type: 'ref', ref: 'lead_sources', required: true, list: true },
    { name: 'client_name', label: 'Client name', type: 'string', required: true, list: true },
    { name: 'company', label: 'Company name', type: 'string', list: true },
    { name: 'designation', label: 'Designation', type: 'string' },
    { name: 'mobile', label: 'Ph No.', type: 'string', required: true, list: true },
    { name: 'email', label: 'E-mail', type: 'string' },
    { name: 'nature_of_business', label: 'Nature of business', type: 'select', options: BUSINESS_TYPES },
    { name: 'geography', label: 'Company geography', type: 'select', options: GEO, default: 'Local' },
    { name: 'company_address', label: 'Company address', type: 'text' },
    { name: 'centre_id', label: 'Centre required', type: 'ref', ref: 'centres', list: true },
    { name: 'product_id', label: 'Requirement (product)', type: 'ref', ref: 'products', list: true },
    { name: 'seats', label: 'No. of seats', type: 'int', list: true },
    { name: 'budget_min', label: 'Budget from (₹/month)', type: 'money' },
    { name: 'budget_max', label: 'Budget to (₹/month)', type: 'money' },
    { name: 'other_requirement', label: 'Other requirement', type: 'text' },
    { name: 'reference', label: 'Reference / referred by', type: 'string' },
    { name: 'is_existing_client', label: 'New / existing client', type: 'select', options: ['New', 'Existing'], default: 'New' },
    { name: 'assigned_to', label: 'Lead assigned to', type: 'ref', ref: 'users', required: true, list: true },
    { name: 'stage', label: 'Stage', type: 'select', options: LEAD_STAGES, default: 'New', list: true },
    { name: 'qualification_status', label: 'Qualified?', type: 'select', options: ['Pending', 'Yes', 'No'], default: 'Pending' },
    { name: 'expected_mrr', label: 'Expected MRR (₹, ex-GST)', type: 'money', list: true },
    { name: 'tour_at', label: 'Tour / first meeting', type: 'datetime' },
    { name: 'proposal_sent_at', label: 'Proposal sent', type: 'datetime' },
    { name: 'next_action', label: 'Next action', type: 'string', list: true },
    { name: 'next_action_at', label: 'Next action due', type: 'datetime', list: true },
    { name: 'won_at', label: 'Won on', type: 'datetime' },
    { name: 'won_mrr', label: 'Won MRR (₹, ex-GST)', type: 'money' },
    { name: 'client_id', label: 'Client (after win)', type: 'ref', ref: 'clients' },
    { name: 'lost_at', label: 'Lost on', type: 'datetime' },
    { name: 'lost_reason_id', label: 'Lost reason', type: 'ref', ref: 'lost_reasons' },
    { name: 'lost_notes', label: 'Lost notes / competitor', type: 'text' },
    { name: 'recontact_at', label: 'Win-back re-contact date', type: 'date', help: 'Auto = lost date + 90 days' },
    { name: 'winback_status', label: 'Win-back status', type: 'select', options: ['', 'Scheduled', 'Re-contacted', 'Re-opened', 'Closed'] },
    { name: 'golden_client_id', label: 'Golden client', type: 'ref', ref: 'golden_clients' },
    { name: 'remarks', label: 'Remarks', type: 'text' },
    { name: 'created_by', label: 'Logged by', type: 'ref', ref: 'users', readonly: true },
  ],
  searchFields: ['enq_no', 'client_name', 'company', 'mobile', 'email'],
  createFields: ['enq_at', 'source_id', 'client_name', 'company', 'designation', 'mobile', 'email', 'nature_of_business', 'geography', 'centre_id', 'product_id', 'seats', 'budget_min', 'budget_max', 'other_requirement', 'reference', 'is_existing_client', 'assigned_to', 'expected_mrr', 'remarks'],
  orderBy: 'enq_at DESC',
};

E.fms_stage_defs = {
  label: 'FMS stage', plural: 'FMS Stage Definitions', group: 'Settings', icon: 'list-ordered',
  roles: { read: ALL, write: ['admin', 'sales_head', 'pc', 'mis'] },
  fields: [
    { name: 'flow', label: 'Flow', type: 'select', options: ['NBD', 'CRM'], required: true, list: true, help: 'NBD = new business (enquiry → closure); CRM = after the win (agreement → first payment)' },
    { name: 'seq', label: 'Seq', type: 'int', required: true, list: true },
    { name: 'code', label: 'Code', type: 'string', required: true, list: true },
    { name: 'name', label: 'WHAT has to be done', type: 'string', required: true, list: true },
    { name: 'who_role', label: 'WHO will do it (role)', type: 'select', options: ROLES, optionLabels: ROLE_LABELS, list: true },
    { name: 'how', label: 'HOW will it be done', type: 'text' },
    { name: 'offset_value', label: 'WHEN: offset', type: 'decimal', required: true, list: true },
    { name: 'offset_unit', label: 'Offset unit', type: 'select', options: ['working_hours', 'working_days', 'calendar_days'], default: 'working_hours', list: true },
    { name: 'anchor', label: 'Counted from', type: 'select', options: ['previous_stage', 'enquiry', 'proposal', 'won', 'move_in'], default: 'previous_stage', list: true },
    { name: 'record', label: 'Record in', type: 'string' },
    { name: 'is_active', label: 'Active', type: 'bool', default: 1, list: true },
  ],
  orderBy: 'flow, seq',
};

E.fms_steps = {
  label: 'FMS step', plural: 'FMS Steps', group: 'New Business (NBD)', icon: 'flag', hidden: true,
  roles: { read: ALL, write: SALES },
  fields: [
    { name: 'flow', label: 'Flow', type: 'string', required: true },
    { name: 'lead_id', label: 'Enquiry', type: 'ref', ref: 'leads' },
    { name: 'client_id', label: 'Client', type: 'ref', ref: 'clients' },
    { name: 'stage_def_id', label: 'Stage', type: 'ref', ref: 'fms_stage_defs' },
    { name: 'seq', label: 'Seq', type: 'int' },
    { name: 'code', label: 'Code', type: 'string' },
    { name: 'name', label: 'Step', type: 'string' },
    { name: 'owner_user_id', label: 'Owner', type: 'ref', ref: 'users' },
    { name: 'planned_at', label: 'Planned', type: 'datetime' },
    { name: 'actual_at', label: 'Actual', type: 'datetime' },
    { name: 'status', label: 'Status', type: 'select', options: ['pending', 'done', 'skipped', 'na'], default: 'pending' },
    { name: 'outcome', label: 'Outcome', type: 'string' },
    { name: 'notes', label: 'Notes', type: 'text' },
    { name: 'flag_level', label: 'Red-flag level', type: 'int', default: 0 },
    { name: 'escalated_at', label: 'Escalated at', type: 'datetime' },
  ],
  orderBy: 'planned_at',
};

/* ---------------- Science 2: SCOT & client database ---------------- */
E.clients = {
  label: 'Client', plural: 'Client Database & SCOT', group: 'Existing Clients (CRR)', icon: 'briefcase',
  roles: { read: ALL, write: OPS },
  fields: [
    { name: 'company', label: 'Company name', type: 'string', required: true, list: true },
    { name: 'centre_id', label: 'Centre', type: 'ref', ref: 'centres', list: true },
    { name: 'product_id', label: 'Primary product', type: 'ref', ref: 'products', list: true },
    { name: 'product_text', label: 'Cabin / seats (as per agreement)', type: 'string' },
    { name: 'seats', label: 'Seats', type: 'int', list: true },
    { name: 'monthly_rent', label: 'Monthly rent (₹, incl. GST)', type: 'money', list: true },
    { name: 'mrr_ex_gst', label: 'MRR (₹, ex-GST)', type: 'money', list: true, help: 'Auto = rent / 1.18 when blank' },
    { name: 'start_date', label: 'Client since', type: 'date' },
    { name: 'agreement_end', label: 'Agreement end', type: 'date', list: true },
    { name: 'lockin_end', label: 'Lock-in end', type: 'date', list: true },
    { name: 'due_day', label: 'Payment due day', type: 'int' },
    { name: 'status', label: 'Status', type: 'select', options: CLIENT_STATUS, default: 'Active', list: true },
    { name: 'industry', label: 'Industry', type: 'select', options: BUSINESS_TYPES },
    { name: 'gst_no', label: 'GST No.', type: 'string' },
    { name: 'address', label: 'Billing address', type: 'text' },
    { name: 'relationship_owner', label: 'Relationship owner (SCOT caller)', type: 'ref', ref: 'users', list: true },
    { name: 'call_frequency_days', label: 'SCOT call frequency (days)', type: 'int', default: 30, list: true },
    { name: 'last_call_at', label: 'Last SCOT call', type: 'datetime', list: true },
    { name: 'next_call_due', label: 'Next call due', type: 'date', list: true },
    { name: 'potential_seats', label: 'Wallet: total seats client could need', type: 'int' },
    { name: 'products_bought', label: 'Products bought from us', type: 'string', help: 'Comma-separated' },
    { name: 'products_possible', label: 'Products we can still sell', type: 'string', help: 'Comma-separated: meeting rooms, parking, VO, more seats…' },
    { name: 'wallet_scope_mrr', label: 'Scope to sell (₹ MRR)', type: 'money' },
    { name: 'referral_potential', label: 'Referral potential', type: 'select', options: ['', 'High', 'Medium', 'Low'] },
    { name: 'nps', label: 'Last NPS (0–10)', type: 'int' },
    { name: 'source', label: 'Acquired via', type: 'select', options: ['Legacy', 'NBD', 'Referral', 'Broker'], default: 'Legacy' },
    { name: 'won_lead_id', label: 'Won from enquiry', type: 'ref', ref: 'leads' },
    { name: 'notice_date', label: 'Notice given on', type: 'date' },
    { name: 'exit_date', label: 'Exit date', type: 'date' },
    { name: 'exit_reason', label: 'Exit reason', type: 'string' },
    { name: 'notes', label: 'Notes', type: 'text' },
  ],
  searchFields: ['company', 'product_text', 'gst_no'],
  createFields: ['company', 'centre_id', 'product_id', 'product_text', 'seats', 'monthly_rent', 'mrr_ex_gst', 'start_date', 'agreement_end', 'lockin_end', 'due_day', 'status', 'industry', 'gst_no', 'address', 'relationship_owner', 'call_frequency_days', 'source', 'notes'],
  orderBy: 'company',
};

E.client_contacts = {
  label: 'Contact person', plural: 'Client Contacts', group: 'Existing Clients (CRR)', icon: 'contact', hidden: true,
  roles: { read: ALL, write: OPS },
  fields: [
    { name: 'client_id', label: 'Client', type: 'ref', ref: 'clients', required: true },
    { name: 'name', label: 'Name', type: 'string', required: true, list: true },
    { name: 'designation', label: 'Designation', type: 'string', list: true },
    { name: 'mobile', label: 'Mobile', type: 'string', list: true },
    { name: 'email', label: 'E-mail', type: 'string', list: true },
    { name: 'is_primary', label: 'Primary', type: 'bool', default: 0, list: true },
  ],
  orderBy: 'is_primary DESC, name',
};

E.call_logs = {
  label: 'Activity', plural: 'Call & Activity Log', group: 'Existing Clients (CRR)', icon: 'phone',
  roles: { read: ALL, write: OPS },
  fields: [
    { name: 'at', label: 'Date & time', type: 'datetime', required: true, default: 'now', list: true },
    { name: 'type', label: 'Type', type: 'select', options: ['SCOT call', 'Follow-up call', 'Qualification call', 'Tour', 'Client visit', 'Meeting', 'WhatsApp', 'E-mail', 'Renewal discussion', 'Complaint', 'Referral ask', 'Other'], required: true, list: true },
    { name: 'client_id', label: 'Client', type: 'ref', ref: 'clients', list: true },
    { name: 'lead_id', label: 'Enquiry', type: 'ref', ref: 'leads', list: true },
    { name: 'user_id', label: 'By', type: 'ref', ref: 'users', list: true },
    { name: 'outcome', label: 'Outcome', type: 'select', options: ['Connected', 'Not reached', 'Call back later', 'Satisfied', 'Issue raised', 'Upsell opportunity', 'Referral received', 'Renewal positive', 'Renewal at risk', 'Proposal discussed', 'Negotiation', 'Closed - won', 'Closed - lost'], list: true },
    { name: 'notes', label: 'Notes', type: 'text', list: true },
    { name: 'next_action', label: 'Next action', type: 'string' },
    { name: 'next_action_at', label: 'Next action due', type: 'datetime' },
    { name: 'duration_min', label: 'Duration (min)', type: 'int' },
    { name: 'amount', label: 'Sale value (₹) if booked', type: 'money', list: true },
    { name: 'client_name', label: 'Client / company (if not in masters)', type: 'string' },
  ],
  searchFields: ['notes', 'client_name'],
  orderBy: 'at DESC',
};

/* ---------------- Science 3: Golden clients & lead generation ---------------- */
E.golden_segments = {
  label: 'Target segment', plural: 'Golden Client Segments (ICP)', group: 'Lead Generation', icon: 'target',
  roles: { read: ALL, write: ['admin', 'sales_head', 'sc_crm'] },
  fields: [
    { name: 'name', label: 'Segment', type: 'string', required: true, list: true },
    { name: 'why', label: 'Why golden for SSPACIA', type: 'text', list: true },
    { name: 'typical_need', label: 'Typical need', type: 'string', list: true },
    { name: 'target_count', label: 'Target companies to list', type: 'int', list: true },
    { name: 'sourcing', label: 'Where to find them', type: 'text' },
    { name: 'owner_user_id', label: 'Owner', type: 'ref', ref: 'users', list: true },
    { name: 'is_active', label: 'Active', type: 'bool', default: 1 },
  ],
  orderBy: 'name',
};

E.golden_clients = {
  label: 'Golden client', plural: 'Golden Client List (Golden 100)', group: 'Lead Generation', icon: 'star',
  roles: { read: ALL, write: ['admin', 'sales_head', 'sc_crm', 'cm'] },
  fields: [
    { name: 'company', label: 'Company', type: 'string', required: true, list: true },
    { name: 'segment_id', label: 'Segment', type: 'ref', ref: 'golden_segments', list: true },
    { name: 'industry', label: 'Industry', type: 'select', options: BUSINESS_TYPES },
    { name: 'website', label: 'Website / LinkedIn', type: 'string' },
    { name: 'hq_city', label: 'HQ city', type: 'string' },
    { name: 'ahmedabad_presence', label: 'Ahmedabad presence', type: 'select', options: ['Unknown', 'None yet', 'Small team', 'Office exists', 'Expanding'], default: 'Unknown' },
    { name: 'est_seats', label: 'Est. seats needed', type: 'int', list: true },
    { name: 'est_mrr', label: 'Est. MRR (₹)', type: 'money', list: true },
    { name: 'decision_maker', label: 'Decision maker', type: 'string', list: true },
    { name: 'designation', label: 'Designation', type: 'string' },
    { name: 'mobile', label: 'Mobile', type: 'string' },
    { name: 'email', label: 'E-mail', type: 'string' },
    { name: 'source', label: 'How found', type: 'string' },
    { name: 'icp_industry', label: 'ICP: industry fit (0–3)', type: 'int', default: 0 },
    { name: 'icp_size', label: 'ICP: team size fit (0–3)', type: 'int', default: 0 },
    { name: 'icp_location', label: 'ICP: location fit (0–3)', type: 'int', default: 0 },
    { name: 'icp_timing', label: 'ICP: timing / trigger (0–3)', type: 'int', default: 0 },
    { name: 'icp_budget', label: 'ICP: budget fit (0–3)', type: 'int', default: 0 },
    { name: 'icp_score', label: 'ICP score (/15)', type: 'int', readonly: true, list: true },
    { name: 'status', label: 'Status', type: 'select', options: ['To research', 'To contact', 'Contacted', 'Meeting fixed', 'Proposal', 'Won', 'Dropped', 'Nurture'], default: 'To research', list: true },
    { name: 'owner_user_id', label: 'Owner', type: 'ref', ref: 'users', list: true },
    { name: 'next_action', label: 'Next action', type: 'string' },
    { name: 'next_action_at', label: 'Next action due', type: 'date', list: true },
    { name: 'lead_id', label: 'Enquiry (once opened)', type: 'ref', ref: 'leads' },
    { name: 'notes', label: 'Notes', type: 'text' },
  ],
  searchFields: ['company', 'decision_maker', 'industry'],
  orderBy: 'icp_score DESC, company',
};

E.lead_gen_channels = {
  label: 'Channel', plural: 'Lead Generation Plan (13 channels)', group: 'Lead Generation', icon: 'megaphone',
  roles: { read: ALL, write: ['admin', 'sales_head', 'sc_crm'] },
  fields: [
    { name: 'name', label: 'Channel', type: 'string', required: true, list: true },
    { name: 'source_code', label: 'Source code', type: 'string', required: true, list: true },
    { name: 'channel_type', label: 'Type', type: 'select', options: ['Inbound', 'Outbound', 'Referral', 'Paid', 'Partner', 'Existing client'], list: true },
    { name: 'weekly_activity', label: 'Weekly activity & quota', type: 'text', list: true },
    { name: 'owner_user_id', label: 'Owner', type: 'ref', ref: 'users', list: true },
    { name: 'script_tool', label: 'Script / tool', type: 'string' },
    { name: 'expected_leads_month', label: 'Expected leads / month', type: 'int', list: true },
    { name: 'cost_month', label: 'Cost / month (₹)', type: 'money', list: true },
    { name: 'status', label: 'Status', type: 'select', options: ['Planned', 'Live', 'Paused', 'Dropped'], default: 'Planned', list: true },
    { name: 'notes', label: 'Notes', type: 'text' },
    { name: 'sort', label: 'Sort', type: 'int', default: 0 },
  ],
  orderBy: 'sort, name',
};

E.marketing_campaigns = {
  label: 'Campaign', plural: 'Marketing Calendar', group: 'Lead Generation', icon: 'calendar',
  roles: { read: ALL, write: ['admin', 'sales_head', 'sc_crm'] },
  fields: [
    { name: 'name', label: 'Campaign', type: 'string', required: true, list: true },
    { name: 'channel_id', label: 'Channel', type: 'ref', ref: 'lead_gen_channels', list: true },
    { name: 'month', label: 'Month (YYYY-MM)', type: 'string', required: true, list: true },
    { name: 'start_date', label: 'Start', type: 'date', list: true },
    { name: 'end_date', label: 'End', type: 'date', list: true },
    { name: 'objective', label: 'Objective', type: 'string' },
    { name: 'offer', label: 'Offer / hook', type: 'text' },
    { name: 'budget', label: 'Budget (₹)', type: 'money', list: true },
    { name: 'owner_user_id', label: 'Owner', type: 'ref', ref: 'users' },
    { name: 'leads_target', label: 'Leads target', type: 'int', list: true },
    { name: 'leads_actual', label: 'Leads actual', type: 'int', list: true },
    { name: 'status', label: 'Status', type: 'select', options: ['Planned', 'Running', 'Done', 'Cancelled'], default: 'Planned', list: true },
    { name: 'notes', label: 'Learnings', type: 'text' },
  ],
  orderBy: 'month DESC, start_date',
};

E.kb_articles = {
  label: 'Playbook page', plural: 'Marketing Strategy & Playbooks', group: 'Lead Generation', icon: 'book',
  roles: { read: ALL, write: ['admin', 'sales_head', 'mis'] },
  fields: [
    { name: 'category', label: 'Category', type: 'select', options: ['Marketing strategy', 'Positioning & offers', 'Referral & broker programme', 'Sales process', 'ASMP science', 'Standing rules'], required: true, list: true },
    { name: 'title', label: 'Title', type: 'string', required: true, list: true },
    { name: 'body', label: 'Content', type: 'text' },
    { name: 'sort', label: 'Sort', type: 'int', default: 0 },
  ],
  orderBy: 'category, sort, title',
};

E.scripts = {
  label: 'Script', plural: 'Scripts & Objection Handling', group: 'Sales Toolkit', icon: 'message-square',
  roles: { read: ALL, write: ['admin', 'sales_head', 'sc_crm'] },
  fields: [
    { name: 'block', label: 'Block', type: 'select', options: ['First call', 'Qualification', 'Tour', 'Proposal & closing', 'Objections', 'Follow-up', 'SCOT call', 'Renewal', 'Referral ask', 'Win-back'], required: true, list: true },
    { name: 'step', label: 'Step / item', type: 'string', required: true, list: true },
    { name: 'text', label: 'What to say or do', type: 'text', list: true },
    { name: 'record_in', label: 'Record in', type: 'string', list: true },
    { name: 'sort', label: 'Sort', type: 'int', default: 0 },
  ],
  orderBy: 'block, sort',
};

E.msg_templates = {
  label: 'Template', plural: 'WhatsApp & E-mail Templates', group: 'Sales Toolkit', icon: 'mail',
  roles: { read: ALL, write: ['admin', 'sales_head', 'sc_crm'] },
  fields: [
    { name: 'code', label: 'Code', type: 'string', required: true, list: true },
    { name: 'name', label: 'Name', type: 'string', required: true, list: true },
    { name: 'channel', label: 'Channel', type: 'select', options: ['WhatsApp', 'E-mail', 'SMS'], default: 'WhatsApp', list: true },
    { name: 'stage', label: 'Stage', type: 'string', list: true },
    { name: 'body', label: 'Message', type: 'text', help: 'Placeholders: {name}, {company}, {centre}, {seats}, {rate}, {date}, {time}, {link}, {user}' },
    { name: 'sort', label: 'Sort', type: 'int', default: 0 },
  ],
  orderBy: 'sort, code',
};

E.lost_reasons = {
  label: 'Lost reason', plural: 'Lost Reasons', group: 'Settings', icon: 'x-circle',
  roles: { read: ALL, write: ['admin', 'sales_head'] },
  fields: [
    { name: 'reason', label: 'Reason', type: 'string', required: true, list: true },
    { name: 'standard_response', label: 'Standard response next time', type: 'text', list: true },
    { name: 'sort', label: 'Sort', type: 'int', default: 0 },
  ],
  orderBy: 'sort, reason',
};

/* ---------------- Proposals, DSR, reviews, inventory, plans ---------------- */
E.proposals = {
  label: 'Proposal', plural: 'Proposals & Quotes', group: 'New Business (NBD)', icon: 'file-text',
  roles: { read: ALL, write: SALES },
  fields: [
    { name: 'lead_id', label: 'Enquiry', type: 'ref', ref: 'leads', required: true, list: true },
    { name: 'centre_id', label: 'Centre', type: 'ref', ref: 'centres', required: true, list: true },
    { name: 'product_id', label: 'Product', type: 'ref', ref: 'products', required: true, list: true },
    { name: 'seats', label: 'Seats / units', type: 'int', required: true, default: 1, list: true },
    { name: 'rate', label: 'Rate (₹/unit/month, ex-GST)', type: 'money', required: true, list: true },
    { name: 'discount_pct', label: 'Discount %', type: 'pct', default: 0, list: true },
    { name: 'approval_level', label: 'Discount approval', type: 'string', readonly: true, list: true },
    { name: 'lockin_months', label: 'Lock-in (months)', type: 'int', default: 11 },
    { name: 'deposit_months', label: 'Deposit (months)', type: 'decimal', default: 2 },
    { name: 'gst_pct', label: 'GST %', type: 'pct', default: 18 },
    { name: 'amount_ex_gst', label: 'Monthly (ex-GST)', type: 'money', readonly: true, list: true },
    { name: 'gst_amount', label: 'GST', type: 'money', readonly: true },
    { name: 'amount_incl_gst', label: 'Monthly (incl. GST)', type: 'money', readonly: true, list: true },
    { name: 'deposit_amount', label: 'Deposit', type: 'money', readonly: true },
    { name: 'first_payment', label: 'First payment (deposit + month 1)', type: 'money', readonly: true },
    { name: 'status', label: 'Status', type: 'select', options: ['Draft', 'Sent', 'Negotiating', 'Accepted', 'Rejected', 'Expired'], default: 'Draft', list: true },
    { name: 'sent_at', label: 'Sent on', type: 'datetime' },
    { name: 'valid_till', label: 'Valid till', type: 'date' },
    { name: 'inclusions', label: 'Inclusions', type: 'text', default: 'Furnished workspace, high-speed internet, power backup, housekeeping, tea/coffee, meeting-room credits as per plan, reception & mail handling' },
    { name: 'notes', label: 'Notes / special terms', type: 'text' },
    { name: 'created_by', label: 'Created by', type: 'ref', ref: 'users', readonly: true },
  ],
  orderBy: 'created_at DESC',
};

E.dsr = {
  label: 'Daily Sales Report', plural: 'Daily Sales Reports (DSR)', group: 'Reviews & MIS', icon: 'clipboard',
  roles: { read: ALL, write: SALES },
  fields: [
    { name: 'date', label: 'Date', type: 'date', required: true, default: 'today', list: true },
    { name: 'user_id', label: 'Salesperson', type: 'ref', ref: 'users', required: true, list: true },
    { name: 'calls_made', label: 'Calls made', type: 'int', default: 0, list: true },
    { name: 'calls_connected', label: 'Connected', type: 'int', default: 0, list: true },
    { name: 'new_leads', label: 'New enquiries', type: 'int', default: 0, list: true },
    { name: 'qualification_calls', label: 'Qualification calls', type: 'int', default: 0, list: true },
    { name: 'tours', label: 'Tours / meetings', type: 'int', default: 0, list: true },
    { name: 'proposals', label: 'Proposals sent', type: 'int', default: 0, list: true },
    { name: 'follow_ups', label: 'Follow-ups done', type: 'int', default: 0, list: true },
    { name: 'scot_calls', label: 'SCOT calls', type: 'int', default: 0, list: true },
    { name: 'golden_contacts', label: 'Golden-client contacts', type: 'int', default: 0 },
    { name: 'closures', label: 'Closures', type: 'int', default: 0, list: true },
    { name: 'mrr_won', label: 'MRR won (₹)', type: 'money', default: 0, list: true },
    { name: 'red_flags_cleared', label: 'Red flags cleared', type: 'int', default: 0 },
    { name: 'notes', label: 'Notes / blockers', type: 'text' },
    { name: 'submitted_at', label: 'Submitted at', type: 'datetime', readonly: true, list: true },
  ],
  orderBy: 'date DESC, user_id',
};

E.weekly_reviews = {
  label: 'Weekly review', plural: 'Weekly Sales Review', group: 'Reviews & MIS', icon: 'calendar-check',
  roles: { read: ALL, write: ['admin', 'sales_head', 'pc', 'sc_crm'] },
  fields: [
    { name: 'week_start', label: 'Week starting (Monday)', type: 'date', required: true, list: true },
    { name: 'red_flags_notes', label: '1. Red flags — causes & fixes', type: 'text' },
    { name: 'numbers_notes', label: '2. Numbers vs target', type: 'text' },
    { name: 'pipeline_notes', label: '3. Pipeline by stage', type: 'text' },
    { name: 'sources_notes', label: '4. Lead sources — what converts', type: 'text' },
    { name: 'lost_notes', label: '5. Lost reasons', type: 'text' },
    { name: 'scot_notes', label: '6. SCOT / renewals / churn risk', type: 'text' },
    { name: 'next_week_plan', label: '7. Next week plan', type: 'text' },
    { name: 'decisions', label: 'Decisions (owner · date)', type: 'text', list: true },
    { name: 'reviewed_by', label: 'Reviewed by', type: 'ref', ref: 'users', list: true },
  ],
  orderBy: 'week_start DESC',
};

E.inventory = {
  label: 'Inventory line', plural: 'Inventory to Sell', group: 'Masters', icon: 'grid',
  roles: { read: ALL, write: ['admin', 'sales_head', 'cm', 'mis'] },
  fields: [
    { name: 'centre_id', label: 'Centre', type: 'ref', ref: 'centres', required: true, list: true },
    { name: 'product_id', label: 'Product', type: 'ref', ref: 'products', required: true, list: true },
    { name: 'total_units', label: 'Total units', type: 'int', required: true, default: 0, list: true },
    { name: 'occupied_units', label: 'Occupied', type: 'int', default: 0, list: true },
    { name: 'list_rate', label: 'List rate (₹/unit/month ex-GST)', type: 'money', list: true },
    { name: 'notes', label: 'Notes', type: 'text' },
  ],
  orderBy: 'centre_id, product_id',
};

E.plan_year = {
  label: 'Plan line', plural: 'Plan the Year (monthly)', group: 'Growth Sciences', icon: 'trending-up',
  roles: { read: ALL, write: ['admin', 'sales_head', 'accounts'] },
  fields: [
    { name: 'month', label: 'Month (YYYY-MM)', type: 'string', required: true, list: true },
    { name: 'revenue_plan', label: 'Revenue plan (₹)', type: 'money', list: true },
    { name: 'profit_plan', label: 'Net profit plan (₹)', type: 'money', list: true },
    { name: 'nbd_rev_plan', label: 'NBD revenue plan (₹)', type: 'money', list: true },
    { name: 'crr_rev_plan', label: 'CRR revenue plan (₹)', type: 'money', list: true },
    { name: 'meetings_plan', label: 'Meetings plan', type: 'int', list: true },
    { name: 'clients_plan', label: 'New clients plan', type: 'int', list: true },
    { name: 'revenue_actual', label: 'Revenue actual (₹, from accounts)', type: 'money', list: true },
    { name: 'profit_actual', label: 'Net profit actual (₹)', type: 'money', list: true },
    { name: 'variable_cost_actual', label: 'Variable cost actual (₹)', type: 'money' },
    { name: 'fixed_cost_actual', label: 'Fixed cost actual (₹)', type: 'money' },
    { name: 'notes', label: 'Notes', type: 'text' },
  ],
  orderBy: 'month',
};

E.activity_log = {
  label: 'Audit entry', plural: 'Audit Log', group: 'Administration', icon: 'history',
  roles: { read: ADMIN_MIS, write: [] },
  fields: [
    { name: 'user_id', label: 'User', type: 'ref', ref: 'users', list: true },
    { name: 'action', label: 'Action', type: 'string', list: true },
    { name: 'module', label: 'Module', type: 'string', list: true },
    { name: 'record_id', label: 'Record', type: 'int', list: true },
    { name: 'summary', label: 'Summary', type: 'text', list: true },
    { name: 'data', label: 'Data', type: 'json' },
  ],
  orderBy: 'id DESC',
};

/* ---------------- system tables (no UI) ---------------- */
E.sessions = {
  label: 'Session', plural: 'Sessions', hidden: true, roles: { read: [], write: [] },
  fields: [
    { name: 'token', label: 'Token', type: 'string', required: true },
    { name: 'user_id', label: 'User', type: 'ref', ref: 'users', required: true },
    { name: 'expires_at', label: 'Expires', type: 'datetime', required: true },
    { name: 'user_agent', label: 'UA', type: 'string' },
  ],
};

E.settings = {
  label: 'Setting', plural: 'Settings', hidden: true, roles: { read: [], write: [] },
  fields: [
    { name: 'skey', label: 'Key', type: 'string', required: true },
    { name: 'svalue', label: 'Value', type: 'json' },
  ],
};

for (const [name, def] of Object.entries(E)) {
  def.name = name;
  def.table = name;
  def.fields.forEach((f) => { if (f.list === undefined) f.list = false; });
}

module.exports = { E, ROLES, ROLE_LABELS, LEAD_STAGES, CLIENT_STATUS, BUSINESS_TYPES };
