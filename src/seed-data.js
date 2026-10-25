'use strict';
/** Seed content: masters, FMS stage definitions, scripts, templates, lead-gen plan, playbooks. */

const CENTRES = [
  { name: 'Mercado', code: 'MER', address: 'Ahmedabad', opening_hours: 'Mon–Sat 10:00–19:00' },
  { name: 'Agarwal Complex', code: 'AGC', address: 'Ahmedabad', opening_hours: 'Mon–Sat 10:00–19:00' },
  { name: 'Premier House', code: 'PRH', address: 'Ahmedabad', opening_hours: 'Mon–Sat 10:00–19:00' },
];

const PRODUCTS = [
  { name: 'Dedicated Cabin', code: 'DC', unit: 'seat/month', variable_cost_pct: 25, sort: 1 },
  { name: 'Executive Cabin', code: 'EC', unit: 'seat/month', variable_cost_pct: 25, sort: 2 },
  { name: 'Private Cabin', code: 'PC', unit: 'cabin/month', variable_cost_pct: 25, sort: 3 },
  { name: 'Fixed Desk', code: 'FD', unit: 'desk/month', variable_cost_pct: 30, sort: 4 },
  { name: 'Flexi Desk', code: 'FX', unit: 'desk/month', variable_cost_pct: 30, sort: 5 },
  { name: 'Virtual Office', code: 'VO', unit: 'office/month', variable_cost_pct: 10, sort: 6 },
  { name: 'Meeting Room', code: 'MR', unit: 'hour', variable_cost_pct: 15, sort: 7 },
  { name: 'Board Room', code: 'BR', unit: 'hour', variable_cost_pct: 15, sort: 8 },
  { name: 'Car Parking', code: 'CP', unit: 'slot/month', variable_cost_pct: 5, sort: 9 },
  { name: 'Day Pass', code: 'DP', unit: 'day', variable_cost_pct: 30, sort: 10 },
  { name: 'Documentation Charges', code: 'DOC', unit: 'one-time', variable_cost_pct: 0, sort: 11 },
];

/** Derived from current SCOT rents (ex-GST, rounded). Confirm before quoting. */
const RATE_CARD = [
  { product: 'DC', rate: 8000, floor_rate: 7000, deposit_months: 2, lockin_months: 11, notes: 'Per seat. Existing cabins run ₹7,000–9,600/seat ex-GST' },
  { product: 'EC', rate: 10000, floor_rate: 8500, deposit_months: 2, lockin_months: 11, notes: 'Per seat; premium corner/glass cabins' },
  { product: 'PC', rate: 13000, floor_rate: 11000, deposit_months: 2, lockin_months: 11, notes: 'Per 1-seat private cabin' },
  { product: 'FD', rate: 8000, floor_rate: 6500, deposit_months: 1, lockin_months: 6, notes: 'Per fixed desk' },
  { product: 'FX', rate: 6000, floor_rate: 5000, deposit_months: 1, lockin_months: 3, notes: 'Per flexi desk' },
  { product: 'VO', rate: 2000, floor_rate: 1500, deposit_months: 0, lockin_months: 12, notes: 'Billed annually (₹24,000/yr list); GST registration address plan' },
  { product: 'MR', rate: 500, floor_rate: 400, deposit_months: 0, lockin_months: 0, notes: 'Per hour; included credits per plan' },
  { product: 'BR', rate: 1000, floor_rate: 800, deposit_months: 0, lockin_months: 0, notes: 'Per hour' },
  { product: 'CP', rate: 2000, floor_rate: 2000, deposit_months: 0, lockin_months: 0, notes: 'Per slot per month' },
  { product: 'DP', rate: 500, floor_rate: 400, deposit_months: 0, lockin_months: 0, notes: 'Per day' },
  { product: 'DOC', rate: 2500, floor_rate: 2500, deposit_months: 0, lockin_months: 0, notes: 'One-time documentation charge' },
];

const LEAD_SOURCES = [
  { name: 'Website form / pricing page', code: 'WEB', channel_type: 'Inbound' },
  { name: 'Live chat', code: 'CHAT', channel_type: 'Inbound' },
  { name: 'WhatsApp enquiry', code: 'WA', channel_type: 'Inbound' },
  { name: 'Phone call enquiry', code: 'CALL', channel_type: 'Inbound' },
  { name: 'Walk-in / signage', code: 'WALK', channel_type: 'Inbound' },
  { name: 'Google Business Profile / Maps / search', code: 'GBP', channel_type: 'Inbound' },
  { name: 'Coworking aggregators (myHQ, GoFloaters, Qdesq, Stylework, Coworker)', code: 'AGG', channel_type: 'Paid' },
  { name: 'Property portals (99acres, MagicBricks, NoBroker)', code: 'PORTAL', channel_type: 'Paid' },
  { name: 'Broker / property consultant', code: 'BROKER', channel_type: 'Partner' },
  { name: 'CA / CS / startup-ecosystem referral', code: 'CA', channel_type: 'Partner' },
  { name: 'Corporate outreach (CG Road / SG Highway)', code: 'CORP', channel_type: 'Outbound' },
  { name: 'Existing-client referral', code: 'REF', channel_type: 'Referral' },
  { name: 'Day-pass / meeting-room user', code: 'PASS', channel_type: 'Existing client' },
  { name: 'Event', code: 'EVENT', channel_type: 'Partner' },
  { name: 'Paid ads (Google Ads / Instagram)', code: 'ADS', channel_type: 'Paid' },
  { name: 'LinkedIn / golden-client outreach', code: 'LINKEDIN', channel_type: 'Outbound' },
  { name: 'Existing client expansion (SCOT call)', code: 'EXIST', channel_type: 'Existing client' },
  { name: 'Other', code: 'OTH', channel_type: 'Inbound' },
];

/* Team roster — logins are placeholders (@sspacia.team); the Executive corrects e-mails and sets passwords under Users & Roles. */
const USERS = [
  { name: 'Praveen Agarwal', email: 'praveen@sspacia.team', role: 'admin', is_active: 1 },
  { name: 'Pinanki', email: 'pinanki@sspacia.team', role: 'sc_crm', is_active: 1 },
  { name: 'Nikhil', email: 'nikhil@sspacia.team', role: 'sc_crm', is_active: 1 },
  { name: 'Nency', email: 'nency@sspacia.team', role: 'pc', is_active: 1 },
  { name: 'Community Manager — Mercado', email: 'cm.mercado@sspacia.team', role: 'cm', is_active: 1, centre: 'MER' },
  { name: 'Community Manager — Agarwal Complex', email: 'cm.agarwal@sspacia.team', role: 'cm', is_active: 1, centre: 'AGC' },
  { name: 'Community Manager — Premier House', email: 'cm.premier@sspacia.team', role: 'cm', is_active: 1, centre: 'PRH' },
  { name: 'MIS Team', email: 'mis@sspacia.team', role: 'mis', is_active: 1 },
  { name: 'Sales Head (to be named)', email: 'saleshead@sspacia.team', role: 'sales_head', is_active: 0 },
  { name: 'Accounts Head (to be named)', email: 'accounts@sspacia.team', role: 'accounts', is_active: 0 },
];

/* WHEN values follow the team's Sales FMS sheet (working hours: 1 day = 9 h). */
const STAGES_NBD = [
  { seq: 1, code: 'QUAL', name: 'Qualification call', who_role: 'sc_crm', offset_value: 1, offset_unit: 'working_hours', anchor: 'enquiry', how: 'Call within the hour (target: 10 minutes). Confirm seats, centre, move-in date, budget, decision maker and current setup; fix the tour slot; send W02.', record: 'Lead Register → Qualified? / tour slot' },
  { seq: 2, code: 'TOUR', name: 'First meeting / centre tour', who_role: 'sc_crm', offset_value: 8, offset_unit: 'working_hours', anchor: 'previous_stage', how: 'Tour at the preferred centre with the CM; show two options (the asked size and one up); note objections; agree the proposal time; send W04 the same hour.', record: 'Lead Register → tour date; tour notes' },
  { seq: 3, code: 'PROP', name: 'Share proposal', who_role: 'sc_crm', offset_value: 1, offset_unit: 'working_hours', anchor: 'previous_stage', how: 'Price from the Quote Calculator (discount within authority); send PDF + W05 on WhatsApp and e-mail the same day as the tour.', record: 'Proposals' },
  { seq: 4, code: 'FU1', name: '1st follow-up call (1 hour after proposal)', who_role: 'sc_crm', offset_value: 1, offset_unit: 'working_hours', anchor: 'proposal', how: 'Confirm the proposal was received and understood; answer first questions; ask for the decision date.', record: 'Call log' },
  { seq: 5, code: 'FU2', name: '2nd follow-up (2 days)', who_role: 'sc_crm', offset_value: 18, offset_unit: 'working_hours', anchor: 'proposal', how: 'Handle objections from the objection sheet; offer a second visit or a trial day; W07.', record: 'Call log' },
  { seq: 6, code: 'FU3', name: '3rd follow-up (7 days)', who_role: 'sc_crm', offset_value: 63, offset_unit: 'working_hours', anchor: 'proposal', how: 'Value-add touch: client testimonial, community event, available-inventory update; W08.', record: 'Call log' },
  { seq: 7, code: 'FU4', name: '4th follow-up (15 days)', who_role: 'sc_crm', offset_value: 135, offset_unit: 'working_hours', anchor: 'proposal', how: 'Decision push with a time-bound offer approved by the Sales Head; W09.', record: 'Call log' },
  { seq: 8, code: 'FU5', name: '5th follow-up (30 days)', who_role: 'sc_crm', offset_value: 270, offset_unit: 'working_hours', anchor: 'proposal', how: 'Last check: keep the door open; agree a re-contact date; W10.', record: 'Call log' },
  { seq: 9, code: 'CLOSE', name: 'Closure decision: Won / Lost / Dormant', who_role: 'sc_crm', offset_value: 9, offset_unit: 'working_hours', anchor: 'previous_stage', how: 'Mark the enquiry Won (client + CRM FMS start automatically), Lost (reason + win-back date) or Dormant.', record: 'Lead Register → stage' },
];

const STAGES_CRM = [
  { seq: 1, code: 'AGR_SENT', name: 'Welcome mail + agreement draft sent', who_role: 'sc_crm', offset_value: 9, offset_unit: 'working_hours', anchor: 'won', how: 'Send W11; share the agreement draft, deposit invoice and KYC list (W12).', record: 'CRM FMS' },
  { seq: 2, code: 'AGR_SIGN', name: 'Agreement signed & deposit received', who_role: 'sc_crm', offset_value: 3, offset_unit: 'working_days', anchor: 'previous_stage', how: 'Collect signed agreement and deposit; accounts confirm receipt.', record: 'CRM FMS; Accounts' },
  { seq: 3, code: 'KYC', name: 'KYC & GST collected, client master created on sspacia.com', who_role: 'cm', offset_value: 1, offset_unit: 'working_days', anchor: 'previous_stage', how: 'PAN/GST/ID proofs; create Client Master and seats on the platform; add SCOT record here.', record: 'Platform Client Master' },
  { seq: 4, code: 'MOVEIN', name: 'Move-in: seats, access cards, Wi-Fi, nameplate, welcome kit', who_role: 'cm', offset_value: 0, offset_unit: 'working_hours', anchor: 'move_in', how: 'Move-in checklist (W13) completed before 10:00 on move-in day; photo of the ready cabin to the client.', record: 'Move-in checklist' },
  { seq: 5, code: 'INV1', name: 'First invoice raised', who_role: 'accounts', offset_value: 2, offset_unit: 'working_days', anchor: 'move_in', how: 'Pro-rata first invoice from the platform; send on e-mail + WhatsApp.', record: 'Platform invoices' },
  { seq: 6, code: 'WELCOME7', name: 'Day-7 check-in call', who_role: 'cm', offset_value: 7, offset_unit: 'calendar_days', anchor: 'move_in', how: 'How is everything? Fix any issue within SLA; W14.', record: 'Call log' },
  { seq: 7, code: 'PAY1', name: 'First payment received', who_role: 'accounts', offset_value: 7, offset_unit: 'calendar_days', anchor: 'previous_stage', how: 'Dunning D-3 … D+45 if unpaid; W21.', record: 'Platform payments' },
  { seq: 8, code: 'REV30', name: 'Day-30 review, NPS & referral ask → SCOT cycle starts', who_role: 'sc_crm', offset_value: 30, offset_unit: 'calendar_days', anchor: 'move_in', how: 'NPS (0–10), referral ask (W15, W20), set SCOT call frequency and relationship owner.', record: 'Client → NPS, referral potential' },
];

const LOST_REASONS = [
  { reason: 'Price', standard_response: 'Compare inclusions line by line; offer a longer lock-in for a better rate or a flexi/fixed-desk option; never go below the floor rate.', sort: 1 },
  { reason: 'Location / parking', standard_response: 'Offer the other two centres with travel times; offer a parking slot.', sort: 2 },
  { reason: 'Lock-in or deposit', standard_response: 'Flexi desks with a shorter lock-in; deposit in two instalments with Praveen\'s approval.', sort: 3 },
  { reason: 'Timing (not now)', standard_response: 'Nurture with a monthly touch; book the re-contact date; keep on the events list.', sort: 4 },
  { reason: 'Competitor', standard_response: 'Line-by-line comparison; service standards; client references from the same industry; record competitor and price.', sort: 5 },
  { reason: 'Size not available', standard_response: 'Vacancy list with dates; nearest size now and move later; waitlist alert.', sort: 6 },
  { reason: 'No response', standard_response: 'Cadence completed? If not, finish all five follow-ups before marking Lost; then win-back at 90 days.', sort: 7 },
  { reason: 'No need', standard_response: 'Thank, keep the door open (W23) and ask for a referral.', sort: 8 },
  { reason: 'Other', standard_response: 'Describe in notes; review in the EM / weekly review.', sort: 9 },
];

const GOLDEN_SEGMENTS = [
  { name: 'BFSI branch offices (AMC, PMS, broking, insurance, NBFC)', why: 'Already 40%+ of SSPACIA MRR (360 ONE, Abakkus, Angel One, YES Securities, Shriram AMC, Helios, Edelweiss, Mizuho, Canara HSBC, Jainam). They need compliant, presentable 3–15 seat cabins fast, pay on time and sign 11-month+ terms.', typical_need: 'Dedicated cabin 3–15 seats, parking, board room', target_count: 30, sourcing: 'SEBI-registered AMC/PMS/RIA lists, IRDAI insurer branch lists, NBFC lists; LinkedIn "branch manager Ahmedabad"; GIFT City tenant lists; existing BFSI clients for referrals' },
  { name: 'IT / SaaS and GCC satellite teams', why: 'Teams of 5–20 opening Ahmedabad delivery/sales pods; recurring expansion.', typical_need: 'Dedicated cabin 5–20 seats, fixed desks', target_count: 20, sourcing: 'Nasscom member list, GESIA, LinkedIn job posts "Ahmedabad" by non-Ahmedabad companies, Naukri hiring signals' },
  { name: 'Pharma / healthcare regional sales offices', why: 'Gujarat is a pharma hub; MRs and regional managers need a professional base with meeting rooms.', typical_need: 'Executive cabin 1–4 seats, meeting-room credits', target_count: 10, sourcing: 'IDMA / Pharmexcil member lists, pharma companies with Gujarat territories' },
  { name: 'Logistics, trading and import-export firms', why: 'Need GST-registered address plus small ops team near clients (existing: Pacific Air Logistics, Karnavati Sales, Harvin, Begwani Agri).', typical_need: 'Virtual office → private cabin', target_count: 10, sourcing: 'GCCI member list, IEC holder lists, customs-broker associations' },
  { name: 'Consulting, CA, legal and advisory firms', why: 'High referral potential; need meeting rooms and address; many are 1–3 seat users who upgrade.', typical_need: 'Private cabin, VO, meeting rooms', target_count: 10, sourcing: 'ICAI Ahmedabad branch, Bar associations, LinkedIn' },
  { name: 'Recruitment / RPO / staffing', why: 'Existing clients (Talent Bridge RPO, Staffinity, Expedite Talent Search, Sky Right Placement enquiry) show fit; interview-room usage.', typical_need: 'Dedicated cabin 3–8 seats + interview rooms', target_count: 8, sourcing: 'ISF member list, LinkedIn recruiters Ahmedabad' },
  { name: 'Startups and funded D2C brands', why: 'Fast decisions, flexi-to-cabin upgrades, community value (existing: 8Perfumes enquiry, Dawntech, Sydorg).', typical_need: 'Flexi/fixed desks → cabin', target_count: 7, sourcing: 'iCreate, CIIE, GUSEC, Startup Gujarat lists, Inc42 funding news' },
  { name: 'Corporate regional offices (Mumbai/Delhi HQ)', why: 'Highest MRR per account (Angel One 46 seats, YES Securities 13, Jainam 13); 11-month to 3-year terms.', typical_need: 'Dedicated cabin 10–50 seats, parking', target_count: 5, sourcing: 'Companies announcing Gujarat expansion (news), real-estate IPCs (CBRE, JLL, Knight Frank, Anarock), broker network' },
];

const LEAD_GEN_CHANNELS = [
  { name: 'Website forms, pricing page, quote form', source_code: 'WEB', channel_type: 'Inbound', weekly_activity: 'Respond to every form in 10 minutes; pricing visible on the site; tour form posts straight into this Lead Register (API key in Settings)', owner_role: 'sc_crm', script_tool: 'W01 acknowledgement · first-call script · intake API', expected_leads_month: 15, cost_month: 0, status: 'Live', sort: 1 },
  { name: 'Live chat and WhatsApp menu', source_code: 'WA', channel_type: 'Inbound', weekly_activity: 'Chat answered in 10 minutes in working hours; auto-reply menu after hours', owner_role: 'sc_crm', script_tool: 'WhatsApp quick replies (W01–W05)', expected_leads_month: 8, cost_month: 0, status: 'Live', sort: 2 },
  { name: 'Google Business Profile, Maps, reviews', source_code: 'GBP', channel_type: 'Inbound', weekly_activity: '1 post per centre per week; reply to every review in 24 h; review ask after NPS ≥ 8', owner_role: 'cm', script_tool: 'Review request template', expected_leads_month: 12, cost_month: 0, status: 'Planned', sort: 3 },
  { name: 'Coworking aggregators: myHQ, GoFloaters, Qdesq, Stylework, Coworker', source_code: 'AGG', channel_type: 'Paid', weekly_activity: 'Listings live; availability and photos refreshed every Tuesday from Inventory to Sell', owner_role: 'sc_crm', script_tool: 'Listing checklist', expected_leads_month: 8, cost_month: 3000, status: 'Planned', sort: 4 },
  { name: 'Property portals: 99acres, MagicBricks, NoBroker', source_code: 'PORTAL', channel_type: 'Paid', weekly_activity: '3 listings per centre refreshed weekly', owner_role: 'sc_crm', script_tool: 'Listing checklist', expected_leads_month: 6, cost_month: 4000, status: 'Planned', sort: 5 },
  { name: 'Brokers and property consultants', source_code: 'BROKER', channel_type: 'Partner', weekly_activity: '10 contacts a week; commission slab agreed (1 month rent on 11-month deals); monthly WhatsApp inventory update to brokers', owner_role: 'sc_crm', script_tool: 'Broker script · commission sheet · Inventory to Sell', expected_leads_month: 6, cost_month: 0, status: 'Planned', sort: 6 },
  { name: 'CA, CS and startup-ecosystem referrals (virtual office, new companies)', source_code: 'CA', channel_type: 'Partner', weekly_activity: '5 firms a week; referral fee or reciprocal referral', owner_role: 'sc_crm', script_tool: 'CA script', expected_leads_month: 5, cost_month: 0, status: 'Planned', sort: 7 },
  { name: 'Corporate outreach: CG Road and SG Highway corridors (Golden Client List)', source_code: 'CORP', channel_type: 'Outbound', weekly_activity: '25 golden targets added and 10 called a week; LinkedIn connect + call + visit; ICP score updated', owner_role: 'sc_crm', script_tool: 'Golden Client List · corporate script', expected_leads_month: 6, cost_month: 0, status: 'Planned', sort: 8 },
  { name: 'Existing-client referrals', source_code: 'REF', channel_type: 'Referral', weekly_activity: '10 referral asks a week on SCOT calls; one month of meeting-room credits (or 1 month fee credit) for a converted referral', owner_role: 'sc_crm', script_tool: 'W15 / W20 referral templates', expected_leads_month: 4, cost_month: 0, status: 'Planned', sort: 9 },
  { name: 'Day-pass and meeting-room users', source_code: 'PASS', channel_type: 'Existing client', weekly_activity: 'Membership offer after the third pass; desk offer to regular room users', owner_role: 'cm', script_tool: 'Upsell script', expected_leads_month: 4, cost_month: 0, status: 'Planned', sort: 10 },
  { name: 'Walk-ins and signage', source_code: 'WALK', channel_type: 'Inbound', weekly_activity: 'Walk-in register at reception; same-day tour; an enquiry row for every walk-in', owner_role: 'cm', script_tool: 'Walk-in form · 10-5-3 greeting', expected_leads_month: 5, cost_month: 2000, status: 'Live', sort: 11 },
  { name: 'Events at Premier House (40-seat event room)', source_code: 'EVENT', channel_type: 'Partner', weekly_activity: 'One community or professional event a month; attendee list becomes enquiries', owner_role: 'sc_crm', script_tool: 'Event checklist', expected_leads_month: 5, cost_month: 8000, status: 'Planned', sort: 12 },
  { name: 'Paid: Google Ads and Instagram lead forms', source_code: 'ADS', channel_type: 'Paid', weekly_activity: 'Budget set by Praveen; search campaigns "office space on rent Ahmedabad", "coworking Ahmedabad", "virtual office Ahmedabad"; leads land here with UTM source', owner_role: 'mis', script_tool: 'UTM codes · landing pages', expected_leads_month: 25, cost_month: 25000, status: 'Planned', sort: 13 },
  { name: 'LinkedIn outreach (Praveen + sales)', source_code: 'LINKEDIN', channel_type: 'Outbound', weekly_activity: '25 connection requests + 10 messages per day to decision makers in the golden segments; 2 posts a week', owner_role: 'sales_head', script_tool: 'LinkedIn script · Sales Navigator', expected_leads_month: 6, cost_month: 8000, status: 'Planned', sort: 14 },
];

const SCRIPTS = [
  { block: 'First call', step: 'Open (within 10 minutes of the enquiry)', text: '“Good morning {name}, this is {user} from SSPACIA coworking — you just enquired about workspace at {centre}. Is this a good time for two minutes?” Smile; stand up; have the Lead Register open.', record_in: 'Lead Register', sort: 1 },
  { block: 'First call', step: 'Reason for enquiry', text: '“What made you look for space right now?” Listen for the trigger (new team, lease ending, new branch, GST address). Note it — it is the urgency lever for follow-ups.', record_in: 'Lead Register → Other requirement', sort: 2 },
  { block: 'Qualification', step: 'Seats & product', text: '“How many people will sit, and do you prefer a private cabin or desks?” Map to Dedicated / Executive / Private cabin, Fixed / Flexi desk, Virtual office.', record_in: 'Lead Register → seats, product', sort: 1 },
  { block: 'Qualification', step: 'Centre & timing', text: '“Which area works best — Mercado, Agarwal Complex or Premier House? When do you want to move in?”', record_in: 'Lead Register → centre, next action', sort: 2 },
  { block: 'Qualification', step: 'Budget', text: '“Do you have a monthly budget in mind so I show you the right options?” If below floor rate, offer desks instead of cabins.', record_in: 'Lead Register → budget', sort: 3 },
  { block: 'Qualification', step: 'Decision maker', text: '“Who else will be part of the decision? It helps to have them on the tour.”', record_in: 'Lead Register → designation', sort: 4 },
  { block: 'Qualification', step: 'Fix the tour', text: '“I have 11:30 tomorrow or 4:00 today at {centre} — which suits you?” Always offer two slots; confirm with W02; the CM is informed.', record_in: 'FMS → Tour planned', sort: 5 },
  { block: 'Tour', step: 'Before', text: 'Cabins clean, lights on, AC on, nameplate mock-up with the client’s company name on the proposed cabin, water/tea ready, CM briefed on the enquiry.', record_in: 'Tour checklist', sort: 1 },
  { block: 'Tour', step: 'During', text: 'Reception → the proposed cabin first → one size up → meeting room → pantry → parking. Ask “Can you see your team here?” at the cabin. Note every objection.', record_in: 'Tour notes', sort: 2 },
  { block: 'Tour', step: 'Close for the proposal', text: '“I’ll send the proposal within the hour with these two options. If the numbers work, when would you like to start?” Send W04 before they reach their car.', record_in: 'FMS → Proposal planned', sort: 3 },
  { block: 'Proposal & closing', step: 'Proposal content', text: 'Two options (asked size + one up), monthly ex-GST and incl-GST, deposit, lock-in, inclusions, meeting-room credits, parking, validity 7 days, next step line.', record_in: 'Proposals', sort: 1 },
  { block: 'Proposal & closing', step: 'Trial close', text: '“Shall I block this cabin for you till Friday?” Silence after the question.', record_in: 'Call log', sort: 2 },
  { block: 'Proposal & closing', step: 'Close', text: 'Confirm option, start date, invoicing name/GST, deposit mode; mark Won → CRM FMS starts; send W11.', record_in: 'Lead Register → Won', sort: 3 },
  { block: 'Objections', step: '“Too expensive”', text: '“Compared to what? A conventional office of this size costs rent + deposit of 6 months + fit-out + utilities + housekeeping + reception. Here it is one number and you can start Monday.” Then offer a smaller option, never a below-floor price.', record_in: 'Call log', sort: 1 },
  { block: 'Objections', step: '“Competitor is cheaper”', text: '“Which plan did they quote? Let’s compare what is included.” Highlight parking, meeting-room credits, power backup, 3 centres, BFSI-grade clients. Record competitor + price.', record_in: 'Lead Register → remarks', sort: 2 },
  { block: 'Objections', step: '“Lock-in is too long”', text: '“The lock-in protects the price. We can do a shorter lock-in with a smaller discount — which matters more to you?” (Sales Head approval).', record_in: 'Proposals', sort: 3 },
  { block: 'Objections', step: '“Will think about it”', text: '“Of course. What would you like to think through — I may be able to answer it now?” Then: “When shall I call you — Thursday 11 or Friday 4?”', record_in: 'FMS → next follow-up', sort: 4 },
  { block: 'Objections', step: '“Location is far”', text: 'Offer the other two centres with the travel time; mention client parking.', record_in: 'Lead Register → centre', sort: 5 },
  { block: 'Follow-up', step: 'FU1 (1 hour)', text: '“Did the proposal reach you? Anything unclear?”', record_in: 'Call log', sort: 1 },
  { block: 'Follow-up', step: 'FU2 (2 days)', text: 'Lead with a benefit: “The cabin you liked is still free; I can hold it till Friday.”', record_in: 'Call log', sort: 2 },
  { block: 'Follow-up', step: 'FU3 (7 days)', text: 'Value add: client testimonial / event invite / inventory update.', record_in: 'Call log', sort: 3 },
  { block: 'Follow-up', step: 'FU4 (15 days)', text: 'Time-bound offer approved by the Sales Head (e.g., documentation charges waived till date).', record_in: 'Proposals', sort: 4 },
  { block: 'Follow-up', step: 'FU5 (30 days)', text: 'Keep the door open; agree a re-contact month; mark Dormant with the date.', record_in: 'Lead Register', sort: 5 },
  { block: 'SCOT call', step: 'Monthly relationship call (5 minutes)', text: '1) “How is the team doing at {centre}?” 2) Any issue? → ticket within SLA. 3) “Any new hires or teams coming? We can add seats.” 4) Meeting-room / parking needs. 5) Referral: “Who else do you know who needs an office?” 6) Thank; log outcome; next call auto-schedules.', record_in: 'SCOT call screen', sort: 1 },
  { block: 'Renewal', step: 'D-90 renewal case', text: 'Open the renewal case: occupancy, payment history, issues, escalation %; propose renewal with the next-year rate 60 days before lock-in end; sign by D-30.', record_in: 'Client → agreement/lock-in dates; W17/W18', sort: 1 },
  { block: 'Referral ask', step: 'After a happy moment', text: '“Thank you — would you introduce me to one business owner who could use a space like this? We give one month fee credit when they sign.” Send W20.', record_in: 'Lead Register (source REF)', sort: 1 },
  { block: 'Win-back', step: '90 days after lost', text: '“We spoke in {date}; a cabin of your size just opened at {centre}. Would a 30-minute visit this week make sense?”', record_in: 'Lead Register → win-back', sort: 1 },
];

const TEMPLATES = [
  { code: 'W01', name: 'Enquiry acknowledgement (≤1 min)', channel: 'WhatsApp', stage: 'Enquiry', body: 'Hello {name}, thank you for enquiring with SSPACIA coworking. I am {user}; I will call you within the next few minutes to understand your requirement and fix a visit. — SSPACIA, {centre}' },
  { code: 'W02', name: 'Tour confirmation', channel: 'WhatsApp', stage: 'Tour', body: 'Hi {name}, your visit to SSPACIA {centre} is confirmed for {date} at {time}. Location: {link}. Our Community Manager will receive you. Please share the names of anyone joining so we keep visitor passes ready. — {user}' },
  { code: 'W03', name: 'Tour reminder (1 hour before)', channel: 'WhatsApp', stage: 'Tour', body: 'Hi {name}, looking forward to seeing you at SSPACIA {centre} at {time}. Parking is available at the building. — {user}' },
  { code: 'W04', name: 'Thank you after the tour', channel: 'WhatsApp', stage: 'Tour', body: 'Thank you for visiting SSPACIA {centre}, {name}. As discussed, I am sending the proposal for {seats} seats within the hour. Any question in the meantime, just reply here. — {user}' },
  { code: 'W05', name: 'Proposal cover', channel: 'WhatsApp', stage: 'Proposal', body: 'Hi {name}, please find the SSPACIA proposal for {company} at {centre} — {seats} seats at ₹{rate}/month (ex-GST), deposit and inclusions as listed. Valid for 7 days; the cabin can be blocked on confirmation. Shall I reserve it for you? — {user}' },
  { code: 'W06', name: 'Follow-up 1 (1 hour)', channel: 'WhatsApp', stage: 'FU1', body: 'Hi {name}, did the proposal reach you properly? Happy to walk you through it on a quick call. — {user}' },
  { code: 'W07', name: 'Follow-up 2 (2 days)', channel: 'WhatsApp', stage: 'FU2', body: 'Hi {name}, the cabin you liked at {centre} is still available. I can hold it till Friday for {company} — would that help? — {user}' },
  { code: 'W08', name: 'Follow-up 3 (7 days) — value add', channel: 'WhatsApp', stage: 'FU3', body: 'Hi {name}, sharing what one of our clients said about working from SSPACIA {centre}: “…”. We also have a community session on {date} — you are welcome to join. — {user}' },
  { code: 'W09', name: 'Follow-up 4 (15 days) — offer', channel: 'WhatsApp', stage: 'FU4', body: 'Hi {name}, to help you decide this month we can waive the documentation charges if the agreement is signed by {date}. Shall we finalise? — {user}' },
  { code: 'W10', name: 'Follow-up 5 (30 days) — door open', channel: 'WhatsApp', stage: 'FU5', body: 'Hi {name}, I understand the timing may not be right now. I will keep you posted on availability at {centre}; when would be a good month to reconnect? — {user}' },
  { code: 'W11', name: 'Welcome on confirmation', channel: 'WhatsApp', stage: 'Won', body: 'Welcome to SSPACIA, {name}! We are glad to have {company} at {centre}. Next steps: agreement draft today, deposit, KYC, and your move-in on {date}. Your Community Manager will be in touch. — {user}' },
  { code: 'W12', name: 'Agreement & deposit', channel: 'E-mail', stage: 'CRM', body: 'Dear {name},\n\nPlease find attached the agreement draft for {company} at SSPACIA {centre} and the deposit invoice. Kindly share: PAN, GST certificate, ID proof of the signatory and the list of team members for access cards.\n\nWarm regards,\n{user}\nSSPACIA' },
  { code: 'W13', name: 'Move-in day', channel: 'WhatsApp', stage: 'CRM', body: 'Good morning {name}, your cabin at SSPACIA {centre} is ready: access cards, Wi-Fi details and nameplate are in place. Reception: {link}. See you at 10:00! — {user}' },
  { code: 'W14', name: 'Day-7 check-in', channel: 'WhatsApp', stage: 'CRM', body: 'Hi {name}, it has been a week — how is the team settling in at {centre}? Anything we can improve? — {user}' },
  { code: 'W15', name: 'Day-30 NPS & referral', channel: 'WhatsApp', stage: 'CRM', body: 'Hi {name}, one month with SSPACIA! On a scale of 0–10, how likely are you to recommend us? And if you know a business owner who needs an office, we give one month’s fee credit for every referral that signs. — {user}' },
  { code: 'W16', name: 'SCOT monthly check-in', channel: 'WhatsApp', stage: 'SCOT', body: 'Hi {name}, {user} from SSPACIA. Quick check-in: everything fine at {centre}? Any new team members or meeting-room needs this month? Call me anytime. — {user}' },
  { code: 'W17', name: 'Renewal D-90', channel: 'E-mail', stage: 'Renewal', body: 'Dear {name},\n\nYour agreement for {company} at SSPACIA {centre} completes its term on {date}. We would like to propose the renewal terms and discuss any change in seats. May we meet next week?\n\nRegards,\n{user}' },
  { code: 'W18', name: 'Renewal D-30', channel: 'WhatsApp', stage: 'Renewal', body: 'Hi {name}, the renewal agreement for {company} is ready for signature; the current cabin stays reserved for you till {date}. Shall I send it for e-sign? — {user}' },
  { code: 'W19', name: 'Win-back (90 days)', channel: 'WhatsApp', stage: 'Win-back', body: 'Hi {name}, we spoke a few months ago about space for {company}. A cabin of your size has just opened at {centre}. Would a 30-minute visit this week make sense? — {user}' },
  { code: 'W20', name: 'Referral programme', channel: 'WhatsApp', stage: 'Referral', body: 'Hi {name}, SSPACIA referral programme: introduce a business that signs for 6 months or more and we credit one month of your fee. Just share their name and number with me. — {user}' },
  { code: 'W21', name: 'Payment reminder D-3', channel: 'WhatsApp', stage: 'Collections', body: 'Hi {name}, a gentle reminder: the invoice for {company} is due on {date}. Pay via the link: {link}. Please ignore if already paid. — SSPACIA Accounts' },
  { code: 'W22', name: 'Festival greeting', channel: 'WhatsApp', stage: 'Relationship', body: 'Warm wishes to you and the team at {company} from all of us at SSPACIA {centre}! — {user}' },
  { code: 'W23', name: 'Lost — door open', channel: 'WhatsApp', stage: 'Lost', body: 'Thank you for considering SSPACIA, {name}. We will keep you updated on availability at {centre}; the door is always open. — {user}' },
];

const KB = [
  { category: 'ASMP science', title: '0. How the Sales Autopilot runs (daily rhythm)', sort: 0, body:
`Daily (SC-CRM / CMs)
• 10:00 Dashboard → clear red flags first, then today's FMS steps, then SCOT calls due, then 5 golden-client contacts.
• Every enquiry logged within 15 minutes (website leads arrive automatically); W01 goes out within 1 minute; qualification call within the hour (target 10 min).
• Proposal the same day as the tour. Follow-ups at +1 h, +2 d, +7 d, +15 d, +30 d — the system plans them; you mark them done with an outcome.
• 17:30 DSR submitted; the WhatsApp digest (Dashboard → Copy digest) goes to Praveen and the PC.

Weekly (Monday 10:30, inside the EM)
• Weekly Review page: red flags → numbers vs target → pipeline by stage → sources → lost reasons → next week's plan. Save decisions with owner and date.

Monthly
• MeCA, NBD vs CRR, Leaking Bucket, G.P. Sheet reviewed with Praveen; funnel ratios updated from real data; Plan the Year actuals entered by Accounts.

Red flags (standing rule)
• Planned +2 working hours → Process Coordinator; +24 h → Problem Solver (Sales Head); +72 h → Praveen. The engine recomputes every 10 minutes.` },
  { category: 'ASMP science', title: '1. Enquiry Capture & Leaking Bucket', sort: 1, body: `Every enquiry (call, WhatsApp, walk-in, website, portal, referral) gets an Enq. No. and a salesperson accountable within 15 minutes. The Leaking Bucket page shows, month by month, what leaked: enquiries whose first call was late or never happened (with their value), enquiries that went dormant, lost deals without a proposal, and clients who left. The annualised leak is the money the bucket loses; plug the biggest hole first.` },
  { category: 'ASMP science', title: '2. Sales FMS (NBD) — planned vs actual', sort: 2, body: `The NBD flow is WHAT–WHO–HOW–WHEN per stage, exactly as in the team's Sales FMS sheet: Qualification call → Tour → Proposal → five follow-ups → Closure. Planned times are computed in working hours (Mon–Sat 10:00–19:00; holidays in Settings). Marking a step done moves the enquiry stage and re-plans the next steps from the actual time. Nothing waits in a spreadsheet; delays become red flags automatically.` },
  { category: 'ASMP science', title: '3. SCOT — scheduled calling of existing clients (CRR)', sort: 3, body: `Every active account has a relationship owner, a call frequency (default 30 days) and a next-call date. The SCOT board lists calls due today and this week, renewals (D-90 open case, D-60 proposal, D-45 negotiate, D-30 sign) and accounts on notice. Logging a call re-schedules the next one and can open an upsell enquiry in one click. The monthly grid shows which day each account was called — the same picture as the SCOT sheet, without the manual ticks.` },
  { category: 'ASMP science', title: '4. CRM FMS — after the win', sort: 4, body: `When an enquiry is marked Won, a client record is created and the CRM FMS starts: welcome mail & agreement → signed & deposit → KYC & platform client master → move-in checklist → first invoice → Day-7 call → first payment → Day-30 review with NPS and referral ask. Then the account enters the SCOT cycle. The Community Manager owns move-in and the Day-7 call; Accounts own invoice and payment.` },
  { category: 'ASMP science', title: '5. MeCA — Meetings × Conversion × Average sale', sort: 5, body: `Revenue added = Meetings × Conversion ratio × Average sale. The MeCA page computes it monthly for the company and weekly per salesperson (Sales Rep MeCA), against the plan from Funnel Targets. Improve each lever a little — more meetings (lead generation), better conversion (tour and proposal quality), higher average sale (one size up, parking, meeting-room packs) — and the result compounds.` },
  { category: 'ASMP science', title: '6. NBD vs CRR analysis', sort: 6, body: `Revenue is split between existing clients (CRR) and new clients (NBD) each month, plan vs actual, with the % of total. Healthy coworking: CRR ≥ 85% of MRR with churn under 2% a month; NBD fills the gap identified in the Gap Analysis.` },
  { category: 'ASMP science', title: '7. Wallet share & cross-sell', sort: 7, body: `For every account: how many seats the client could need in Ahmedabad (potential), how many are with us (wallet share), which products they buy and which we can still sell (parking, meeting rooms, virtual office for sister companies, more seats). The scope-to-sell in ₹ is the cheapest revenue in the business — it needs no lead generation, only the SCOT call.` },
  { category: 'ASMP science', title: '8. Gap Analysis, Plan the Year, G.P. Sheet, Compounding 4X', sort: 8, body: `Gap Analysis: decide the net profit one year out → add next year's fixed cost → required gross profit → required revenue at today's GP% → clients needed at today's average MRR (plus churn replacement). Plan the Year spreads the revenue and profit by month; Accounts enter actuals. The G.P. Sheet ranks products by gross profit so selling effort goes where margin is. Compounding 4X shows how 5% a month on leads and conversion plus 3% on average sale multiplies profit in a year.` },
  { category: 'ASMP science', title: '9. Golden Client List (Golden 100)', sort: 9, body: `A golden client is the client who fits perfectly: right segment, right size, right location, a timing trigger and the budget. Score each target 0–3 on the five criteria (ICP score out of 15); work the top 100 first with the daily quota of 5 contacts. The segments page defines where to find them; the existing client base is the best evidence of who fits.` },
  { category: 'Marketing strategy', title: 'SSPACIA marketing strategy 2026-27', sort: 1, body:
`Positioning: “Ahmedabad's professional workspace for finance and corporate teams — three centres, BFSI-grade cabins, ready in 48 hours, one monthly number.” Proof: 360 ONE, Angel One, YES Securities, Shriram AMC, Helios, Edelweiss, Mizuho, Canara HSBC Life already work from SSPACIA.

Target segments (see Golden Client Segments): 1) BFSI branch offices, 2) IT/SaaS satellite teams, 3) pharma regional offices, 4) logistics/trading, 5) consulting/CA/legal, 6) recruitment/RPO, 7) startups, 8) corporate regional offices.

Channel mix (Lead Generation Plan, 14 channels):
• Inbound base (free): website with pricing + slot-based tour form, Google Business Profile for all three centres, walk-in signage.
• Paid: Google Ads search (₹25k/month, the biggest lever for "office space Ahmedabad"), portals, JustDial/IndiaMART, Meta retargeting.
• Outbound: LinkedIn + golden-client calling (5 contacts/day), broker/IPC programme, corporate tie-ups.
• Relationship: referral programme (1 month fee credit), SCOT-driven expansion, monthly community event per centre.

Monthly rhythm: week 1 content & campaigns live, week 2 broker visits, week 3 community event, week 4 review cost per lead and conversion by source (Weekly Review → sources).

KPIs: enquiries by source, cost per enquiry, enquiry→tour %, tour→win %, MRR added, occupancy by centre, referral share of wins (target 25%).

Budget guide: ₹60–70k/month total until occupancy ≥ 90%, then shift to brand and referral.` },
  { category: 'Positioning & offers', title: 'Offers that protect the rate card', sort: 1, body: `Never discount below the floor rate. Use value instead: documentation charges waived (FU4), meeting-room credit pack, free parking for 3 months on 11-month cabins, flexi-to-cabin upgrade with deposit carried over, 13th month free on a 24-month agreement (Praveen approval). Discount authority: CM ≤5%, Sales Head ≤10%, above that Praveen.` },
  { category: 'Referral & broker programme', title: 'Referral and broker programme', sort: 1, body: `Client referral: one month's fee credit for every referred client who signs 6 months or more; ask on Day-30, on every SCOT call and in the monthly mailer (W20). Broker / IPC: commission = one month's rent on 11-month deals, paid after the first payment; share the Inventory to Sell sheet every Monday; register every broker lead with source BRK so commission is traceable.` },
  { category: 'Standing rules', title: 'Standing rules (from the Execution Playbook)', sort: 1, body: `Red flags: planned +2 h → PC; +24 h → Problem Solver; +72 h → Praveen. Sales: first call in 10 minutes; proposal same day as tour; discount CM 5% / Sales Head 10% / Praveen above; SCOT monthly call per account; renewal case at lock-in −90 days. Billing: invoices by the 3rd, cash posted by 11:00, bills logged in 24 h; dunning D−3 … D+45. Ticket SLA: P1 30 min/4 h; P2 2 h/24 h; P3 24 h/72 h.` },
];

/* Live enquiries are imported through Settings → Data import (kept out of the repository). */
const LIVE_LEADS = [];

module.exports = { CENTRES, PRODUCTS, RATE_CARD, LEAD_SOURCES, USERS, STAGES_NBD, STAGES_CRM, LOST_REASONS, GOLDEN_SEGMENTS, LEAD_GEN_CHANNELS, SCRIPTS, TEMPLATES, KB, LIVE_LEADS };
