/* SSPACIA Sales Autopilot — operational pages */
'use strict';
(() => {
  const { api, esc, money, num, fdate, fdt, fmonth, pill, flagPill, stagePill, statusPill, wa, toast, modal, drawer, openForm, readForm, options, $, $$, state } = App;
  const P = App.state.pages;

  const STEP_OUTCOMES = {
    QUAL: ['Qualified', 'Not qualified', 'Not reached', 'Call back later'],
    TOUR: ['Tour done', 'Rescheduled', 'No show', 'Virtual office — no tour needed'],
    PROP: ['Proposal shared'],
    CLOSE: ['Closed - won', 'Closed - lost', 'Dormant'],
    DEFAULT: ['Connected', 'Not reached', 'Call back later', 'Negotiation', 'Proposal discussed', 'Closed - won', 'Closed - lost'],
  };
  function outcomesFor(code) { if (STEP_OUTCOMES[code]) return STEP_OUTCOMES[code]; return STEP_OUTCOMES.DEFAULT; }

  /* ---------- shared: mark a step done ---------- */
  function doneStep(step, after) {
    const outs = outcomesFor(step.code);
    modal({
      title: `${step.name}`,
      body: `<p class="muted small">Planned ${fdt(step.planned_at)} · ${step.enq_no ? esc(step.enq_no) + ' ' + esc(step.client_name || '') : esc(step.client_company || '')}</p>
        <form id="done-f"><div class="field"><label>Actual date &amp; time</label><input name="actual_at" type="datetime-local" value="${App.nowLocal()}" required></div>
        <div class="field"><label>Outcome</label><select name="outcome">${outs.map((o) => `<option>${esc(o)}</option>`).join('')}</select></div>
        <div class="field"><label>Notes</label><textarea name="notes" placeholder="What was said, next step agreed…"></textarea></div></form>`,
      footer: `<button class="btn" data-close>Cancel</button><button class="btn" data-skip title="Not applicable for this enquiry">Mark N/A</button><button class="btn primary" data-ok>Save as done</button>`,
      onMount: (root, close) => {
        const save = async (status) => {
          const d = readForm($('#done-f', root));
          await api(`/api/fms/step/${step.id}/done`, { method: 'POST', body: Object.assign(d, { status }) });
          toast(status === 'done' ? 'Step recorded' : 'Step marked N/A'); close(); App.refreshBadge(); if (after) after();
        };
        $('[data-ok]', root).addEventListener('click', () => save('done'));
        $('[data-skip]', root).addEventListener('click', () => save('na'));
      },
    });
  }

  function stepRow(s, { showWho = true } = {}) {
    const fl = Number(s.flag_level || 0);
    const late = s.status === 'pending' && s.delay_hours > 0;
    return `<li><span class="n ${s.status === 'done' ? 'done' : fl ? 'flag-' + fl : ''}">${s.status === 'done' ? '✓' : s.seq}</span>
      <div><div><strong>${esc(s.name)}</strong> ${s.status === 'na' ? pill('N/A') : ''} ${showWho && s.owner_name ? `<span class="muted small">· ${esc(s.owner_name)}</span>` : ''}</div>
      <div class="small muted">Planned ${fdt(s.planned_at)}${s.actual_at ? ` · Actual ${fdt(s.actual_at)}` : ''}${s.outcome ? ` · ${esc(s.outcome)}` : ''}${s.notes ? ` · ${esc(s.notes)}` : ''}${late ? ` · <span style="color:var(--red)">${num(s.delay_hours, 1)} h late</span>` : ''}</div></div>
      <div>${s.status === 'pending' ? `${flagPill(fl)} <button class="btn xs primary" data-done="${s.id}">Done</button>` : s.status === 'done' ? `<button class="btn xs" data-reopen="${s.id}">Reopen</button>` : ''}</div></li>`;
  }
  function bindSteps(container, steps, after) {
    $$('[data-done]', container).forEach((b) => b.addEventListener('click', () => doneStep(steps.find((s) => String(s.id) === b.dataset.done), after)));
    $$('[data-reopen]', container).forEach((b) => b.addEventListener('click', async () => { await api(`/api/fms/step/${b.dataset.reopen}/reopen`, { method: 'POST', body: {} }); toast('Reopened'); after(); }));
  }

  /* ---------- Dashboard ---------- */
  P.dashboard = async (el) => {
    const mine = state.route.endsWith('/mine');
    const d = await api(`/api/analytics/dashboard${mine ? '?mine=1' : ''}`);
    const m = d.meca, t = d.targets.month;
    const vs = (a, p) => `<div class="t">${num(a)} / plan ${num(p)}</div>`;
    const pipe = d.pipeline.reduce((s, p) => s + Number(p.mrr || 0), 0);
    el.innerHTML = `
      <div class="page-head"><div><h1>Dashboard — ${fdate(d.today)}</h1><div class="lead">Work the day in this order: red flags → today's FMS steps → SCOT calls due → golden-client contacts → DSR at 17:30.</div></div>
        <div class="actions"><a class="btn ${mine ? '' : 'primary'}" href="#/dashboard">Whole team</a><a class="btn ${mine ? 'primary' : ''}" href="#/dashboard/mine">My work</a><a class="btn" href="#/digest">WhatsApp digest</a><button class="btn primary" data-newlead>+ New enquiry</button></div></div>
      <div class="kpis">
        <div class="kpi red"><div class="v">${d.red_flags.l1 + d.red_flags.l2 + d.red_flags.l3}</div><div class="l">Red flags open</div><div class="t">L1 ${d.red_flags.l1} · L2 ${d.red_flags.l2} · L3 ${d.red_flags.l3}</div></div>
        <div class="kpi amber"><div class="v">${d.due_today.length}</div><div class="l">FMS steps due today</div><div class="t">incl. overdue</div></div>
        <div class="kpi teal"><div class="v">${d.scot_due.length}</div><div class="l">SCOT calls due</div><div class="t">${d.renewals.length} renewals ≤ 90 d</div></div>
        <div class="kpi"><div class="v">${m.enquiries}</div><div class="l">Enquiries this month</div>${vs(m.enquiries, t.enquiries)}</div>
        <div class="kpi"><div class="v">${m.meetings}</div><div class="l">Meetings / tours</div>${vs(m.meetings, t.meetings)}</div>
        <div class="kpi"><div class="v">${m.proposals}</div><div class="l">Proposals</div>${vs(m.proposals, t.proposals)}</div>
        <div class="kpi green"><div class="v">${m.won}</div><div class="l">Closures</div>${vs(m.won, t.closures)}</div>
        <div class="kpi green"><div class="v">${money(m.mrr_won)}</div><div class="l">MRR / sales won</div><div class="t">plan ${money(t.mrr)}</div></div>
        <div class="kpi"><div class="v">${money(pipe)}</div><div class="l">Open pipeline MRR</div><div class="t">${d.pipeline.map((p) => `${esc(p.stage)} ${p.n}`).join(' · ') || 'empty'}</div></div>
        <div class="kpi"><div class="v">${d.new_leads_today}</div><div class="l">New enquiries today</div><div class="t">target ${num(d.targets.perDay.enquiries, 1)}/day</div></div>
      </div>
      <div class="grid cols-2">
        <div class="card"><h2>🚩 Red flags (${d.red_flag_rows.length})</h2>${d.red_flag_rows.length ? `<ul class="step-list">${d.red_flag_rows.map((s) => `<li><span class="n flag-${s.flag_level}">${s.flag_level}</span><div><div><a href="${s.lead_id ? '#/lead/' + s.lead_id : '#/client/' + s.client_id}"><strong>${esc(s.enq_no || '')} ${esc(s.client_name || s.client_company || '')}</strong></a> — ${esc(s.name)}</div><div class="small muted">planned ${fdt(s.planned_at)} · ${num(s.delay_hours, 1)} h late · ${esc(s.owner_name || '')}</div></div><div>${flagPill(s.flag_level)} <button class="btn xs primary" data-done="${s.id}">Done</button></div></li>`).join('')}</ul>` : '<div class="empty">No red flags. 🎉</div>'}</div>
        <div class="card"><h2>📋 FMS steps due today (${d.due_today.length})</h2>${d.due_today.length ? `<ul class="step-list">${d.due_today.map((s) => `<li><span class="n ${s.flag_level ? 'flag-' + s.flag_level : ''}">${s.flow === 'CRM' ? 'C' : s.seq}</span><div><div><a href="${s.lead_id ? '#/lead/' + s.lead_id : '#/client/' + s.client_id}"><strong>${esc(s.enq_no || '')} ${esc(s.client_name || s.client_company || '')}</strong></a> — ${esc(s.name)}</div><div class="small muted">${fdt(s.planned_at)} · ${esc(s.owner_name || '')}${s.lead_mobile ? ` · <a href="${wa(s.lead_mobile)}" target="_blank">WhatsApp</a>` : ''}</div></div><div><button class="btn xs primary" data-done="${s.id}">Done</button></div></li>`).join('')}</ul>` : '<div class="empty">Nothing due. Go generate leads.</div>'}</div>
        <div class="card"><h2>📞 SCOT calls due (${d.scot_due.length})</h2>${d.scot_due.length ? `<div class="tbl-wrap"><table class="tbl compact"><tr><th>Account</th><th>Centre</th><th>Due</th><th>Owner</th><th></th></tr>${d.scot_due.map((c) => `<tr><td><a href="#/client/${c.id}">${esc(c.company)}</a></td><td>${esc(c.centre || '')}</td><td>${fdate(c.next_call_due)}</td><td>${esc(c.owner_name || '')}</td><td><button class="btn xs primary" data-scot="${c.id}">Log call</button></td></tr>`).join('')}</table></div>` : '<div class="empty">All SCOT calls are on schedule.</div>'}</div>
        <div class="card"><h2>🔁 Renewals, win-backs, golden follow-ups</h2>
          ${d.renewals.length ? `<h3>Renewal cases (≤ 90 days)</h3><div class="tbl-wrap"><table class="tbl compact"><tr><th>Account</th><th>Agreement end</th><th>Lock-in end</th><th class="num">MRR</th></tr>${d.renewals.slice(0, 12).map((c) => `<tr><td><a href="#/client/${c.id}">${esc(c.company)}</a> ${c.status === 'On Notice' ? pill('On notice', 'red') : ''}</td><td>${fdate(c.agreement_end)}</td><td>${fdate(c.lockin_end)}</td><td class="num">${money(c.mrr_ex_gst)}</td></tr>`).join('')}</table></div>` : ''}
          ${d.winback_due.length ? `<h3 style="margin-top:10px">Win-back calls due</h3>${d.winback_due.map((l) => `<div><a href="#/lead/${l.id}">${esc(l.enq_no)} ${esc(l.client_name)}</a> <span class="muted small">${esc(l.company || '')} · ${fdate(l.recontact_at)}</span></div>`).join('')}` : ''}
          ${d.golden_due.length ? `<h3 style="margin-top:10px">Golden clients due</h3>${d.golden_due.map((g) => `<div><a href="#/e/golden_clients">${esc(g.company)}</a> <span class="muted small">${esc(g.next_action || '')} · ${fdate(g.next_action_at)}</span></div>`).join('')}` : ''}
          ${!d.renewals.length && !d.winback_due.length && !d.golden_due.length ? '<div class="empty">Nothing pending.</div>' : ''}
        </div>
        <div class="card"><h2>📝 DSR today</h2>${d.sales_users.map((u) => { const r = d.dsr_today.find((x) => x.user_id === u.id); return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--line)"><span>${esc(u.name)}</span><span>${r ? pill('Submitted ' + fdt(r.submitted_at).slice(-5), 'green') + ` <span class="muted small">calls ${r.calls_made} · tours ${r.tours} · proposals ${r.proposals} · closures ${r.closures}</span>` : pill('Pending', 'amber')}</span></div>`; }).join('') || '<div class="empty">No sales users yet.</div>'}<div style="margin-top:8px"><a class="btn sm" href="#/dsr">Fill my DSR</a></div></div>
        <div class="card"><h2>🏢 Inventory</h2><div class="kv"><dt>Units tracked</dt><dd>${num(d.inventory.total)} (occupied ${num(d.inventory.occupied)})</dd><dt>Available MRR</dt><dd>${money(d.inventory.available_mrr)}</dd></div><div style="margin-top:8px"><a class="btn sm" href="#/e/inventory">Update inventory</a></div></div>
      </div>`;
    const after = () => P.dashboard(el);
    bindSteps(el, [...d.red_flag_rows, ...d.due_today], after);
    $$('[data-scot]', el).forEach((b) => b.addEventListener('click', () => logScotCall({ id: Number(b.dataset.scot) }, after)));
    $('[data-newlead]', el).addEventListener('click', () => openForm('leads', null, { only: state.meta.leads.createFields, onSaved: (row) => { if (row) location.hash = '#/lead/' + row.id; } }));
  };

  /* ---------- Red flags ---------- */
  P.redflags = async (el) => {
    const r = await api('/api/analytics/red-flags');
    const rows = r.rows.filter((x) => x.flag_level > 0);
    el.innerHTML = `<div class="page-head"><div><h1>Red Flag Register</h1><div class="lead">Every pending FMS step is checked every 10 minutes. +2 working hours late → L1 Process Coordinator chases; +24 h → L2 Problem Solver (Sales Head); +72 h → L3 Praveen. Clear a flag by recording the actual.</div></div><div class="actions"><span class="pill amber">L1 ${r.counts.l1}</span><span class="pill red">L2 ${r.counts.l2}</span><span class="pill dark">L3 ${r.counts.l3}</span></div></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Level</th><th>Flow</th><th>Enquiry / client</th><th>Step</th><th>Owner</th><th>Planned</th><th class="num">Hours late</th><th>Escalate to</th><th></th></tr></thead><tbody>
      ${rows.length ? rows.map((s) => `<tr class="flag-${s.flag_level}"><td>${flagPill(s.flag_level)}</td><td>${esc(s.flow)}</td><td><a href="${s.lead_id ? '#/lead/' + s.lead_id : '#/client/' + s.client_id}">${esc(s.enq_no || '')} ${esc(s.client_name || s.client_company || '')}</a><div class="small muted">${esc(s.lead_company || '')} ${s.lead_stage ? stagePill(s.lead_stage) : ''}</div></td><td>${esc(s.name)}</td><td>${esc(s.owner_name || '—')}</td><td>${fdt(s.planned_at)}</td><td class="num">${num(s.delay_hours, 1)}</td><td>${esc(s.escalate_to_role ? App.state.meta.users.fields.find((f) => f.name === 'role').optionLabels[s.escalate_to_role] : '')}</td><td><button class="btn xs primary" data-done="${s.id}">Done</button></td></tr>`).join('') : '<tr><td colspan="9" class="empty">No red flags open.</td></tr>'}</tbody></table></div>
      <div class="card" style="margin-top:14px"><h3>On-time pending steps (${r.rows.length - rows.length})</h3><div class="small muted">Steps whose planned time has not passed yet are not listed; see each enquiry for the full plan.</div></div>`;
    bindSteps(el, rows, () => P.redflags(el));
  };

  /* ---------- Lead detail ---------- */
  P.lead = async (el, [id]) => {
    const d = await api(`/api/fms/lead/${id}`);
    const l = d.lead;
    const templates = await api('/api/e/msg_templates?limit=100');
    el.innerHTML = `
      <div class="card"><div class="detail-head"><div><a href="#/e/leads" class="small">← Lead Register</a><h1>${esc(l.enq_no)} · ${esc(l.client_name)} ${stagePill(l.stage)}</h1>
        <div class="meta"><span>${esc(l.company || '')}</span><span>${esc(l.designation || '')}</span><span>📞 ${esc(l.mobile)} <a href="${wa(l.mobile)}" target="_blank">WhatsApp</a></span><span>${esc(l.email || '')}</span><span>Source: ${esc(l.source_id_label || '')}</span><span>Assigned: ${esc(l.assigned_to_label || '')}</span></div>
        <div class="meta"><span>Enquiry ${fdt(l.enq_at)}</span><span>Centre: ${esc(l.centre_id_label || '—')}</span><span>Product: ${esc(l.product_id_label || '—')} ${l.seats ? '· ' + l.seats + ' seats' : ''}</span><span>Budget: ${l.budget_min || l.budget_max ? money(l.budget_min) + ' – ' + money(l.budget_max) : '—'}</span><span>Expected MRR: ${money(l.expected_mrr)}</span></div>
        ${l.other_requirement ? `<div class="small" style="margin-top:6px">Requirement: ${esc(l.other_requirement)}</div>` : ''}${l.remarks ? `<div class="small muted" style="margin-top:4px">${esc(l.remarks)}</div>` : ''}
        ${l.next_action ? `<div style="margin-top:8px">${pill('Next: ' + l.next_action + (l.next_action_at ? ' · ' + fdt(l.next_action_at) : ''), 'teal')}</div>` : ''}</div>
        <div class="actions"><button class="btn" data-edit>Edit</button><button class="btn" data-log>Log activity</button><a class="btn" href="#/quote/${l.id}">Quote / proposal</a>${!['Won', 'Lost'].includes(l.stage) ? '<button class="btn primary" data-won>Mark Won</button><button class="btn danger" data-lost>Mark Lost</button>' : ''}${l.client_id ? `<a class="btn" href="#/client/${l.client_id}">Open client</a>` : ''}</div></div></div>
      <div class="grid cols-2">
        <div class="card"><h2>NBD Sales FMS — planned vs actual</h2><ul class="step-list">${d.steps.map((s) => stepRow(s)).join('')}</ul></div>
        <div>
          <div class="card"><h2>WhatsApp templates</h2><div class="toolbar"><select id="tpl">${templates.rows.map((t) => `<option value="${esc(t.code)}">${esc(t.code)} · ${esc(t.name)}</option>`).join('')}</select><button class="btn sm" id="tpl-go">Preview</button></div><div id="tpl-out"></div></div>
          <div class="card"><h2>Proposals (${d.proposals.length})</h2>${d.proposals.length ? `<div class="tbl-wrap"><table class="tbl compact"><tr><th>#</th><th>Centre · product</th><th class="num">Seats</th><th class="num">Monthly ex-GST</th><th class="num">Incl. GST</th><th>Status</th></tr>${d.proposals.map((p) => `<tr><td>${p.id}</td><td>${esc(p.centre_id_label)} · ${esc(p.product_id_label)}</td><td class="num">${p.seats}</td><td class="num">${money(p.amount_ex_gst)}</td><td class="num">${money(p.amount_incl_gst)}</td><td>${statusPill(p.status)} <button class="btn xs" data-prop="${p.id}">Edit</button></td></tr>`).join('')}</table></div>` : '<div class="muted small">No proposal yet — use Quote / proposal.</div>'}</div>
          <div class="card"><h2>Activity log</h2>${d.logs.length ? d.logs.map((g) => `<div style="padding:6px 0;border-bottom:1px solid var(--line)"><div class="small"><strong>${esc(g.type)}</strong> · ${fdt(g.at)} · ${esc(g.user_name || '')} ${g.outcome ? pill(g.outcome) : ''}</div><div class="small muted">${esc(g.notes || '')}${g.next_action ? ` · Next: ${esc(g.next_action)} ${g.next_action_at ? fdt(g.next_action_at) : ''}` : ''}</div></div>`).join('') : '<div class="muted small">No activity logged yet.</div>'}</div>
        </div></div>`;
    const reload = () => P.lead(el, [id]);
    bindSteps(el, d.steps, reload);
    $('[data-edit]', el).addEventListener('click', () => openForm('leads', l, { onSaved: reload }));
    $('[data-log]', el).addEventListener('click', () => openForm('call_logs', null, { onSaved: reload, presets: { lead_id: l.id, type: 'Follow-up call', user_id: state.user.id } }));
    $$('[data-prop]', el).forEach((b) => b.addEventListener('click', () => openForm('proposals', d.proposals.find((p) => String(p.id) === b.dataset.prop), { onSaved: reload })));
    const won = $('[data-won]', el);
    if (won) won.addEventListener('click', () => modal({ title: 'Mark as Won', body: `<form id="wf"><div class="field"><label>Won MRR (₹, ex-GST)</label><input name="won_mrr" type="number" value="${l.expected_mrr || ''}" required></div><div class="field"><label>Won on</label><input name="won_at" type="datetime-local" value="${App.nowLocal()}"></div><p class="small muted">A client record and the CRM FMS (agreement → deposit → KYC → move-in → first invoice → Day-7 → payment → Day-30) start automatically.</p></form>`, footer: '<button class="btn" data-close>Cancel</button><button class="btn primary" data-ok>Confirm win</button>', onMount: (root, close) => { $('[data-ok]', root).addEventListener('click', async () => { const f = readForm($('#wf', root)); await api(`/api/e/leads/${l.id}`, { method: 'PUT', body: Object.assign(f, { stage: 'Won' }) }); toast('Won! Client created.'); close(); reload(); }); } }));
    const lost = $('[data-lost]', el);
    if (lost) lost.addEventListener('click', async () => { const reasons = await options('lost_reasons'); modal({ title: 'Mark as Lost', body: `<form id="lf"><div class="field"><label>Lost reason</label><select name="lost_reason_id" required><option value="">—</option>${reasons.map((r) => `<option value="${r.id}">${esc(r.label)}</option>`).join('')}</select></div><div class="field"><label>Notes / competitor / price</label><textarea name="lost_notes"></textarea></div><p class="small muted">A win-back re-contact is scheduled 90 days from today.</p></form>`, footer: '<button class="btn" data-close>Cancel</button><button class="btn danger" data-ok>Mark lost</button>', onMount: (root, close) => { $('[data-ok]', root).addEventListener('click', async () => { const f = $('#lf', root); if (!f.reportValidity()) return; await api(`/api/e/leads/${l.id}`, { method: 'PUT', body: Object.assign(readForm(f), { stage: 'Lost' }) }); close(); reload(); }); } }); });
    $('#tpl-go', el).addEventListener('click', async () => { const r = await api(`/api/templates/render?code=${encodeURIComponent($('#tpl', el).value)}&lead_id=${l.id}`); $('#tpl-out', el).innerHTML = `<pre class="wa">${esc(r.text)}</pre><div class="actions"><button class="btn sm" id="tpl-copy">Copy</button><a class="btn sm primary" target="_blank" href="${wa(l.mobile, r.text)}">Open in WhatsApp</a></div>`; $('#tpl-copy', el).addEventListener('click', () => { navigator.clipboard.writeText(r.text); toast('Copied'); }); });
  };

  /* ---------- Client detail (SCOT card) ---------- */
  function logScotCall(client, after) {
    modal({ title: 'Log SCOT call', body: `<form id="sf"><div class="form-grid">
      <div class="field"><label>Type</label><select name="type"><option>SCOT call</option><option>Client visit</option><option>Renewal discussion</option><option>Meeting</option><option>WhatsApp</option><option>Complaint</option><option>Referral ask</option></select></div>
      <div class="field"><label>Outcome</label><select name="outcome"><option>Connected</option><option>Not reached</option><option>Call back later</option><option>Satisfied</option><option>Issue raised</option><option>Upsell opportunity</option><option>Referral received</option><option>Renewal positive</option><option>Renewal at risk</option></select></div>
      <div class="field span2"><label>Notes (team news, needs, issues)</label><textarea name="notes" required></textarea></div>
      <div class="field"><label>NPS (0–10)</label><input name="nps" type="number" min="0" max="10"></div>
      <div class="field"><label>Referral potential</label><select name="referral_potential"><option value="">—</option><option>High</option><option>Medium</option><option>Low</option></select></div>
      <div class="field"><label>Next action</label><input name="next_action"></div><div class="field"><label>Next action due</label><input name="next_action_at" type="datetime-local"></div>
      <div class="field inline span2"><input type="checkbox" name="upsell_lead" id="upsell"><label for="upsell">Open an upsell / expansion enquiry from this call</label></div></div></form>`,
      footer: '<button class="btn" data-close>Cancel</button><button class="btn primary" data-ok>Save call</button>',
      onMount: (root, close) => { $('[data-ok]', root).addEventListener('click', async () => { const f = $('#sf', root); if (!f.reportValidity()) return; const d = readForm(f); d.upsell_lead = $('#upsell', root).checked; await api(`/api/clients/${client.id}/call`, { method: 'POST', body: d }); toast('Call logged — next call scheduled'); close(); App.refreshBadge(); if (after) after(); }); } });
  }
  P.client = async (el, [id]) => {
    const d = await api(`/api/fms/client/${id}`);
    const c = d.client;
    const templates = await api('/api/e/msg_templates?limit=100');
    const primary = d.contacts.find((x) => x.is_primary) || d.contacts[0];
    el.innerHTML = `
      <div class="card"><div class="detail-head"><div><a href="#/scot" class="small">← SCOT</a><h1>${esc(c.company)} ${statusPill(c.status)}</h1>
        <div class="meta"><span>${esc(c.centre_id_label || '—')}</span><span>${esc(c.product_text || c.product_id_label || '')}</span><span>${c.seats ? c.seats + ' seats' : ''}</span><span>Rent ${money(c.monthly_rent)} incl. GST · MRR ${money(c.mrr_ex_gst)} ex-GST</span><span>Due day ${c.due_day || '—'}</span></div>
        <div class="meta"><span>Client since ${fdate(c.start_date)}</span><span>Agreement end ${fdate(c.agreement_end)}</span><span>Lock-in end ${fdate(c.lockin_end)}</span><span>Owner ${esc(c.relationship_owner_label || '—')}</span><span>Call every ${c.call_frequency_days || 30} d · next ${fdate(c.next_call_due)} · last ${fdt(c.last_call_at)}</span>${c.nps !== null && c.nps !== undefined ? `<span>NPS ${c.nps}</span>` : ''}</div>
        ${primary ? `<div class="meta"><span>👤 ${esc(primary.name)} ${primary.designation ? '· ' + esc(primary.designation) : ''}</span><span>📞 ${esc(primary.mobile || '')} ${primary.mobile ? `<a href="${wa(primary.mobile)}" target="_blank">WhatsApp</a>` : ''}</span><span>${esc(primary.email || '')}</span></div>` : ''}
        ${c.notes ? `<div class="small muted" style="margin-top:6px">${esc(c.notes)}</div>` : ''}</div>
        <div class="actions"><button class="btn primary" data-call>Log SCOT call</button><button class="btn" data-edit>Edit</button><button class="btn" data-contact>+ Contact</button><button class="btn" data-activity>Log activity</button>${!d.steps.length ? '<button class="btn" data-gen>Start CRM FMS</button>' : ''}</div></div></div>
      <div class="grid cols-2">
        <div>
          <div class="card"><h2>Contacts</h2>${d.contacts.length ? `<div class="tbl-wrap"><table class="tbl compact"><tr><th>Name</th><th>Designation</th><th>Mobile</th><th>E-mail</th><th></th></tr>${d.contacts.map((p) => `<tr><td>${esc(p.name)} ${p.is_primary ? pill('primary', 'teal') : ''}</td><td>${esc(p.designation || '')}</td><td>${esc(p.mobile || '')} ${p.mobile ? `<a href="${wa(p.mobile)}" target="_blank">WA</a>` : ''}</td><td>${esc(p.email || '')}</td><td><button class="btn xs" data-cedit="${p.id}">Edit</button></td></tr>`).join('')}</table></div>` : '<div class="muted small">No contact yet.</div>'}</div>
          <div class="card"><h2>Wallet share &amp; cross-sell</h2><div class="kv"><dt>Seats with us</dt><dd>${c.seats || '—'}</dd><dt>Seats client could need</dt><dd>${c.potential_seats || '—'}${c.potential_seats && c.seats ? ` (wallet share ${Math.round(c.seats / c.potential_seats * 100)}%)` : ''}</dd><dt>Products bought</dt><dd>${esc(c.products_bought || '—')}</dd><dt>Products we can sell</dt><dd>${esc(c.products_possible || '—')}</dd><dt>Scope to sell (MRR)</dt><dd>${money(c.wallet_scope_mrr)}</dd><dt>Referral potential</dt><dd>${esc(c.referral_potential || '—')}</dd></div><div style="margin-top:8px"><button class="btn sm" data-wallet>Update wallet share</button></div></div>
          ${d.steps.length ? `<div class="card"><h2>CRM FMS — onboarding</h2><ul class="step-list">${d.steps.map((s) => stepRow(s)).join('')}</ul></div>` : ''}
        </div>
        <div>
          <div class="card"><h2>WhatsApp templates</h2><div class="toolbar"><select id="tpl">${templates.rows.map((t) => `<option value="${esc(t.code)}">${esc(t.code)} · ${esc(t.name)}</option>`).join('')}</select><button class="btn sm" id="tpl-go">Preview</button></div><div id="tpl-out"></div></div>
          <div class="card"><h2>Activity log</h2>${d.logs.length ? d.logs.map((g) => `<div style="padding:6px 0;border-bottom:1px solid var(--line)"><div class="small"><strong>${esc(g.type)}</strong> · ${fdt(g.at)} · ${esc(g.user_name || '')} ${g.outcome ? pill(g.outcome) : ''} ${g.amount ? pill(money(g.amount), 'green') : ''}</div><div class="small muted">${esc(g.notes || '')}${g.next_action ? ` · Next: ${esc(g.next_action)} ${g.next_action_at ? fdt(g.next_action_at) : ''}` : ''}</div></div>`).join('') : '<div class="muted small">No activity yet — make the first SCOT call.</div>'}</div>
        </div></div>`;
    const reload = () => P.client(el, [id]);
    bindSteps(el, d.steps, reload);
    $('[data-call]', el).addEventListener('click', () => logScotCall(c, reload));
    $('[data-edit]', el).addEventListener('click', () => openForm('clients', c, { onSaved: reload }));
    $('[data-wallet]', el).addEventListener('click', () => openForm('clients', c, { onSaved: reload, title: 'Wallet share & cross-sell', only: ['potential_seats', 'products_bought', 'products_possible', 'wallet_scope_mrr', 'referral_potential', 'nps'] }));
    $('[data-contact]', el).addEventListener('click', () => openForm('client_contacts', null, { onSaved: reload, presets: { client_id: c.id } }));
    $('[data-activity]', el).addEventListener('click', () => openForm('call_logs', null, { onSaved: reload, presets: { client_id: c.id, type: 'SCOT call', user_id: state.user.id } }));
    $$('[data-cedit]', el).forEach((b) => b.addEventListener('click', () => openForm('client_contacts', d.contacts.find((p) => String(p.id) === b.dataset.cedit), { onSaved: reload })));
    const gen = $('[data-gen]', el);
    if (gen) gen.addEventListener('click', async () => { await api(`/api/fms/client/${c.id}/generate`, { method: 'POST', body: {} }); toast('CRM FMS created'); reload(); });
    $('#tpl-go', el).addEventListener('click', async () => { const r = await api(`/api/templates/render?code=${encodeURIComponent($('#tpl', el).value)}&client_id=${c.id}`); $('#tpl-out', el).innerHTML = `<pre class="wa">${esc(r.text)}</pre><div class="actions"><button class="btn sm" id="tpl-copy">Copy</button>${primary && primary.mobile ? `<a class="btn sm primary" target="_blank" href="${wa(primary.mobile, r.text)}">Open in WhatsApp</a>` : ''}</div>`; $('#tpl-copy', el).addEventListener('click', () => { navigator.clipboard.writeText(r.text); toast('Copied'); }); });
  };

  /* ---------- FMS boards ---------- */
  async function board(el, flow) {
    const all = state.route.endsWith('/all');
    const d = await api(`/api/fms/board?flow=${flow}${all ? '&all=1' : ''}`);
    const link = flow === 'NBD' ? (r) => `#/lead/${r.id}` : (r) => `#/client/${r.id}`;
    el.innerHTML = `<div class="page-head"><div><h1>${flow === 'NBD' ? 'NBD – Sales FMS' : 'CRM FMS — after the win'}</h1><div class="lead">${flow === 'NBD' ? 'WHAT / WHO / WHEN per stage, planned vs actual, exactly like the Sales FMS sheet — but the plan is computed in working hours and delays raise red flags on their own. Click a cell to record the actual.' : 'Agreement → deposit → KYC → move-in → first invoice → Day-7 call → first payment → Day-30 review. Owners: SC-CRM, CM, Accounts.'}</div></div>
      <div class="actions">${flow === 'NBD' ? `<a class="btn ${all ? '' : 'primary'}" href="#/fms">Open enquiries</a><a class="btn ${all ? 'primary' : ''}" href="#/fms/all">Include closed</a>` : ''}<a class="btn" href="#/e/fms_stage_defs">Stage definitions</a></div></div>
      <div class="tbl-wrap"><table class="tbl compact fms-grid"><thead><tr><th>${flow === 'NBD' ? 'Enquiry' : 'Client'}</th><th>${flow === 'NBD' ? 'Stage' : 'Since'}</th>${d.defs.map((s) => `<th title="${esc(s.how || '')}">${esc(s.name)}<div class="muted" style="font-weight:400">${esc(App.state.meta.users.fields.find((f) => f.name === 'role').optionLabels[s.who_role] || s.who_role || '')} · +${s.offset_value} ${s.offset_unit === 'working_hours' ? 'wh' : s.offset_unit === 'working_days' ? 'wd' : 'd'}</div></th>`).join('')}</tr></thead>
      <tbody>${d.rows.length ? d.rows.map((r) => `<tr><td><a href="${link(r)}"><strong>${esc(r.enq_no || r.company)}</strong></a><div class="small">${esc(r.client_name || '')} ${esc(r.company && r.enq_no ? '· ' + r.company : '')}</div><div class="small muted">${esc(r.assigned_name || '')} · ${esc(r.centre || '')}</div></td><td>${flow === 'NBD' ? stagePill(r.stage) : fdate(r.start_date)}</td>${d.defs.map((s) => { const st = r.steps[s.code]; if (!st) return '<td class="cell na">—</td>'; const cls = st.status === 'done' ? 'done' : st.status === 'na' ? 'na' : st.flag_level ? 'flag-' + st.flag_level : 'pending'; return `<td class="cell ${cls}" ${st.status === 'pending' ? `data-step="${st.id}" style="cursor:pointer" title="Click to record actual"` : ''}><div><span class="muted">Pln</span> ${fdt(st.planned_at)}</div><div><span class="muted">Act</span> ${st.status === 'done' ? fdt(st.actual_at) : st.status === 'na' ? 'N/A' : '<em>pending</em>'}</div>${st.outcome ? `<div class="muted">${esc(st.outcome)}</div>` : ''}</td>`; }).join('')}</tr>`).join('') : `<tr><td colspan="${d.defs.length + 2}" class="empty">No ${flow === 'NBD' ? 'open enquiries' : 'onboarding flows'}.</td></tr>`}</tbody></table></div>`;
    const steps = [];
    d.rows.forEach((r) => Object.values(r.steps).forEach((s) => steps.push(Object.assign({ enq_no: r.enq_no, client_name: r.client_name, client_company: r.company }, s))));
    $$('[data-step]', el).forEach((td) => td.addEventListener('click', () => doneStep(steps.find((s) => String(s.id) === td.dataset.step), () => board(el, flow))));
  }
  P.fms = (el) => board(el, 'NBD');
  P.crm = (el) => board(el, 'CRM');

  /* ---------- Follow-ups due ---------- */
  P.followups = async (el) => {
    const r = await api('/api/analytics/red-flags');
    const d = await api('/api/analytics/dashboard');
    const rows = d.due_today.filter((s) => s.flow === 'NBD');
    el.innerHTML = `<div class="page-head"><div><h1>Follow-ups & calls due today</h1><div class="lead">The current step of every open enquiry that is due by end of day (1 h · 2 d · 7 d · 15 d · 30 d after the proposal, plus qualification calls and tours). Record each one when done.</div></div></div>
      <div class="card"><ul class="step-list">${rows.length ? rows.map((s) => `<li><span class="n ${s.flag_level ? 'flag-' + s.flag_level : ''}">${s.seq}</span><div><div><a href="#/lead/${s.lead_id}"><strong>${esc(s.enq_no)} ${esc(s.client_name)}</strong></a> ${esc(s.lead_company ? '· ' + s.lead_company : '')} — ${esc(s.name)}</div><div class="small muted">${fdt(s.planned_at)} · ${esc(s.owner_name || '')} · 📞 ${esc(s.lead_mobile || '')} <a href="${wa(s.lead_mobile)}" target="_blank">WhatsApp</a></div></div><div>${flagPill(s.flag_level)} <button class="btn xs primary" data-done="${s.id}">Done</button></div></li>`).join('') : '<li class="empty">Nothing due today.</li>'}</ul></div>`;
    bindSteps(el, rows, () => P.followups(el));
  };

  /* ---------- Quote calculator ---------- */
  P.quote = async (el, [leadId]) => {
    const centres = await options('centres'); const products = await options('products'); const leads = await options('leads');
    const lead = leadId ? await api(`/api/e/leads/${leadId}`) : null;
    el.innerHTML = `<div class="page-head"><div><h1>Quote Calculator</h1><div class="lead">Prices from the Rate Card (ex-GST). GST 18%, deposit per product, approval level from the discount authority (CM ≤5% · Sales Head ≤10% · Praveen above). Save as a proposal to attach it to the enquiry.</div></div><div class="actions"><a class="btn" href="#/e/rate_card">Rate card</a></div></div>
      <div class="grid cols-2"><div class="card"><form id="qf" class="form-grid">
        <div class="field span2"><label>Enquiry</label><select name="lead_id">${leads.filter((l) => !['Won', 'Lost'].includes(l.stage) || (lead && l.id === lead.id)).map((l) => `<option value="${l.id}"${lead && l.id === lead.id ? ' selected' : ''}>${esc(l.enq_no)} · ${esc(l.label)} ${l.company ? '· ' + esc(l.company) : ''}</option>`).join('')}</select></div>
        <div class="field"><label>Centre</label><select name="centre_id">${centres.map((c) => `<option value="${c.id}"${lead && lead.centre_id === c.id ? ' selected' : ''}>${esc(c.label)}</option>`).join('')}</select></div>
        <div class="field"><label>Product</label><select name="product_id">${products.map((p) => `<option value="${p.id}"${lead && lead.product_id === p.id ? ' selected' : ''}>${esc(p.label)}</option>`).join('')}</select></div>
        <div class="field"><label>Seats / units</label><input name="seats" type="number" min="1" value="${lead && lead.seats ? lead.seats : 1}"></div>
        <div class="field"><label>Rate override (₹/unit, ex-GST)</label><input name="rate" type="number" placeholder="blank = rate card"></div>
        <div class="field"><label>Discount %</label><input name="discount_pct" type="number" step="0.5" value="0"></div>
        <div class="field"><label>Lock-in (months)</label><input name="lockin_months" type="number" placeholder="rate card default"></div>
        <div class="field"><label>Deposit (months)</label><input name="deposit_months" type="number" step="0.5" placeholder="rate card default"></div>
        </form><div class="actions"><button class="btn primary" id="q-calc">Calculate</button><button class="btn" id="q-save">Save as proposal</button></div></div>
        <div class="card" id="q-out"><div class="muted">Fill the inputs and calculate.</div></div></div>`;
    let last = null;
    const calc = async () => {
      const f = readForm($('#qf', el));
      const q = new URLSearchParams(f);
      const r = await api(`/api/calc/quote?${q}`); last = Object.assign({}, f, r);
      $('#q-out', el).innerHTML = `<h2>Quote</h2>${r.below_floor ? '<div class="warn">Below the floor rate — needs Praveen\'s approval.</div>' : ''}<dl class="kv">
        <dt>List rate</dt><dd>${money(r.rate_card ? r.rate_card.rate : r.rate)} / unit / month${r.rate_card && r.rate_card.floor_rate ? ` (floor ${money(r.rate_card.floor_rate)})` : ''}</dd>
        <dt>Rate used × units</dt><dd>${money(r.rate)} × ${r.seats} ${r.discount_pct ? `− ${r.discount_pct}%` : ''}</dd>
        <dt>Monthly (ex-GST)</dt><dd><strong>${money(r.monthly_ex_gst)}</strong></dd><dt>GST 18%</dt><dd>${money(r.gst)}</dd><dt>Monthly (incl. GST)</dt><dd><strong>${money(r.monthly_incl_gst)}</strong></dd>
        <dt>Deposit (${r.deposit_months} months)</dt><dd>${money(r.deposit)}</dd><dt>First payment</dt><dd><strong>${money(r.first_payment)}</strong> (deposit + month 1 incl. GST)</dd>
        <dt>Lock-in</dt><dd>${r.lockin_months} months · contract value ${money(r.contract_value_ex_gst)} ex-GST</dd><dt>Discount approval</dt><dd>${pill(r.approval, r.approval.startsWith('None') ? 'green' : r.approval.startsWith('Community') ? 'teal' : r.approval.startsWith('Sales') ? 'amber' : 'red')}</dd></dl>`;
    };
    $('#q-calc', el).addEventListener('click', calc);
    $('#q-save', el).addEventListener('click', async () => { if (!last) await calc(); const f = last; const body = { lead_id: f.lead_id, centre_id: f.centre_id, product_id: f.product_id, seats: f.seats, rate: f.rate, discount_pct: f.discount_pct || 0, lockin_months: f.lockin_months, deposit_months: f.deposit_months, gst_pct: 18, status: 'Draft' }; const r = await api('/api/e/proposals', { method: 'POST', body }); toast('Proposal saved as draft'); openForm('proposals', r.data, { onSaved: () => { location.hash = '#/lead/' + f.lead_id; } }); });
    if (lead) calc();
  };

  /* ---------- Lost & win-back ---------- */
  P.lost = async (el) => {
    const r = await api('/api/e/leads?stage=Lost&limit=200');
    const lb = await api('/api/analytics/leaking-bucket');
    el.innerHTML = `<div class="page-head"><div><h1>Lost & Win-back</h1><div class="lead">Every lost enquiry carries a reason and a re-contact date (lost + 90 days). Work the win-back list monthly; the reason counts feed the weekly review.</div></div></div>
      <div class="grid cols-2"><div class="card"><h2>Lost reasons (all time)</h2>${lb.lost_reasons.length ? `<table class="tbl compact"><tr><th>Reason</th><th class="num">Count</th></tr>${lb.lost_reasons.map((x) => `<tr><td>${esc(x.reason)}</td><td class="num">${x.n}</td></tr>`).join('')}</table>` : '<div class="muted small">No lost enquiries yet.</div>'}<div style="margin-top:8px"><a class="btn sm" href="#/e/lost_reasons">Standard responses</a></div></div>
      <div class="card"><h2>Win-back list (${r.total})</h2><div class="tbl-wrap"><table class="tbl compact"><tr><th>Enquiry</th><th>Lost on</th><th>Reason</th><th>Re-contact</th><th>Status</th></tr>${r.rows.map((l) => `<tr><td><a href="#/lead/${l.id}">${esc(l.enq_no)} ${esc(l.client_name)}</a><div class="small muted">${esc(l.company || '')}</div></td><td>${fdate(l.lost_at)}</td><td>${esc(l.lost_reason_id_label || '')}</td><td>${fdate(l.recontact_at)}</td><td>${esc(l.winback_status || '')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">None</td></tr>'}</table></div></div></div>`;
  };

  /* ---------- SCOT board ---------- */
  P.scot = async (el, [tab = 'today']) => {
    const d = await api('/api/analytics/scot');
    const tabs = [['today', `Due today (${d.counts.due_today})`], ['week', `This week (${d.counts.due_week})`], ['renewals', `Renewals (${d.counts.renewals})`], ['notice', `On notice (${d.counts.on_notice})`], ['all', `All accounts (${d.counts.accounts})`]];
    const rows = tab === 'today' ? d.due_today : tab === 'week' ? d.due_week : tab === 'renewals' ? d.renewals : tab === 'notice' ? d.on_notice : d.all;
    el.innerHTML = `<div class="page-head"><div><h1>SCOT — existing-client calling</h1><div class="lead">One relationship call per account per cycle (default 30 days). Log the call; the next one schedules itself. Renewal cases open 90 days before agreement/lock-in end. MRR under management: <strong>${money(d.counts.mrr_ex_gst)}</strong> ex-GST across ${d.counts.accounts} accounts.</div></div><div class="actions"><a class="btn" href="#/scot-grid">Monthly grid</a><a class="btn" href="#/e/clients">Client database</a></div></div>
      <div class="tabs">${tabs.map(([k, l]) => `<a href="#/scot/${k}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Account</th><th>Centre</th><th>Product · seats</th><th class="num">MRR ex-GST</th><th>Owner</th><th>Next call</th><th>Agreement end</th><th>Lock-in end</th><th>Renewal</th><th></th></tr></thead><tbody>
      ${rows.length ? rows.map((c) => `<tr class="${c.call_overdue_days > 14 ? 'flag-2' : c.call_overdue_days > 0 ? 'flag-1' : ''}"><td><a href="#/client/${c.id}">${esc(c.company)}</a> ${c.status === 'On Notice' ? pill('On notice', 'red') : ''}</td><td>${esc(c.centre_id_label || '')}</td><td>${esc(c.product_id_label || '')}${c.seats ? ' · ' + c.seats : ''}</td><td class="num">${money(c.mrr_ex_gst)}</td><td>${esc(c.relationship_owner_label || '')}</td><td>${fdate(c.next_call_due)}${c.call_overdue_days > 0 ? ` <span class="pill red">${c.call_overdue_days} d late</span>` : ''}</td><td>${fdate(c.agreement_end)}${c.days_to_agreement_end !== null && c.days_to_agreement_end < 0 ? ' ' + pill('expired', 'amber') : ''}</td><td>${fdate(c.lockin_end)}</td><td>${c.renewal_stage ? pill(c.renewal_stage, c.renewal_stage.startsWith('Expired') ? 'amber' : 'blue') : ''}</td><td><button class="btn xs primary" data-scot="${c.id}">Log call</button></td></tr>`).join('') : '<tr><td colspan="10" class="empty">Nothing in this list.</td></tr>'}</tbody></table></div>`;
    $$('[data-scot]', el).forEach((b) => b.addEventListener('click', () => logScotCall({ id: Number(b.dataset.scot) }, () => P.scot(el, [tab]))));
  };
  P['scot-grid'] = async (el, [month]) => {
    const d = await api(`/api/analytics/scot/grid${month ? '?month=' + month : ''}`);
    const [y, mo] = d.month.split('-').map(Number);
    const prev = `${mo === 1 ? y - 1 : y}-${String(mo === 1 ? 12 : mo - 1).padStart(2, '0')}`; const next = `${mo === 12 ? y + 1 : y}-${String(mo === 12 ? 1 : mo + 1).padStart(2, '0')}`;
    const days = Array.from({ length: d.days }, (_, i) => i + 1);
    el.innerHTML = `<div class="page-head"><div><h1>SCOT monthly grid — ${fmonth(d.month)}</h1><div class="lead">Which day each account was called (same picture as the SCOT sheet, filled automatically from logged calls).</div></div><div class="actions"><a class="btn" href="#/scot-grid/${prev}">← ${fmonth(prev)}</a><a class="btn" href="#/scot-grid/${next}">${fmonth(next)} →</a></div></div>
      <div class="tbl-wrap"><table class="tbl compact scot-grid"><thead><tr><th>Account</th><th>Owner</th><th>Freq</th><th>Next</th>${days.map((x) => `<th class="day">${x}</th>`).join('')}</tr></thead><tbody>${d.rows.map((r) => `<tr><td><a href="#/client/${r.id}">${esc(r.company)}</a><div class="small muted">${esc(r.centre || '')}</div></td><td class="small">${esc(r.owner || '')}</td><td class="small">${r.frequency}</td><td class="small">${fdate(r.next_call_due)}</td>${days.map((x) => { const k = String(x).padStart(2, '0'); const v = r.calls[k]; return `<td class="day ${v ? 'y' : ''}" title="${esc(v || '')}">${v ? 'Y' : ''}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>`;
  };

  /* ---------- Wallet share ---------- */
  P.wallet = async (el) => {
    const r = await api('/api/e/clients?status__in=Active,On Notice&limit=500');
    const rows = r.rows;
    const tot = { seats: 0, potential: 0, mrr: 0, scope: 0 };
    rows.forEach((c) => { tot.seats += Number(c.seats || 0); tot.potential += Number(c.potential_seats || 0); tot.mrr += Number(c.mrr_ex_gst || 0); tot.scope += Number(c.wallet_scope_mrr || 0); });
    el.innerHTML = `<div class="page-head"><div><h1>Wallet Share & Cross-sell</h1><div class="lead">Per account: total seats the client could need in Ahmedabad vs. seats with us (wallet share), products bought vs. products we can still sell, and the scope to sell in ₹ — the cheapest revenue in the business. Fill the yellow inputs from the SCOT call.</div></div></div>
      <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Account</th><th class="num">Seats with us</th><th class="num">Seats client could need</th><th class="num">Wallet share</th><th class="num">MRR with us</th><th>Products bought</th><th>Products we can sell</th><th class="num">Scope (₹ MRR)</th><th>Referral</th><th></th></tr></thead><tbody>
      ${rows.map((c) => `<tr><td><a href="#/client/${c.id}">${esc(c.company)}</a></td><td class="num">${c.seats || '—'}</td><td class="num">${c.potential_seats || '—'}</td><td class="num">${c.potential_seats && c.seats ? Math.round(c.seats / c.potential_seats * 100) + '%' : '—'}</td><td class="num">${money(c.mrr_ex_gst)}</td><td class="small">${esc(c.products_bought || '')}</td><td class="small">${esc(c.products_possible || '')}</td><td class="num">${money(c.wallet_scope_mrr)}</td><td>${esc(c.referral_potential || '')}</td><td><button class="btn xs" data-w="${c.id}">Update</button></td></tr>`).join('')}</tbody>
      <tfoot><tr><td>TOTAL (${rows.length})</td><td class="num">${num(tot.seats)}</td><td class="num">${num(tot.potential)}</td><td class="num">${tot.potential ? Math.round(tot.seats / tot.potential * 100) + '%' : '—'}</td><td class="num">${money(tot.mrr)}</td><td></td><td></td><td class="num">${money(tot.scope)}</td><td></td><td></td></tr></tfoot></table></div>`;
    $$('[data-w]', el).forEach((b) => b.addEventListener('click', () => openForm('clients', rows.find((c) => String(c.id) === b.dataset.w), { onSaved: () => P.wallet(el), title: 'Wallet share & cross-sell', only: ['potential_seats', 'products_bought', 'products_possible', 'wallet_scope_mrr', 'referral_potential'] })));
  };

  /* ---------- Playbooks & templates ---------- */
  P.playbooks = async (el, [id]) => {
    const r = await api('/api/e/kb_articles?limit=200');
    const cur = id ? r.rows.find((a) => String(a.id) === id) : r.rows[0];
    const cats = [...new Set(r.rows.map((a) => a.category))];
    el.innerHTML = `<div class="page-head"><div><h1>Marketing Strategy & Playbooks</h1><div class="lead">The ASMP sciences as implemented here, the marketing strategy, offers, referral programme and standing rules. Editable by the Executive and Sales Head.</div></div><div class="actions">${state.meta.kb_articles.canWrite ? '<button class="btn primary" data-new>+ New page</button>' : ''}</div></div>
      <div class="grid" style="grid-template-columns: 300px 1fr"><div class="card tight">${cats.map((c) => `<h3 style="margin:8px 4px 4px">${esc(c)}</h3>${r.rows.filter((a) => a.category === c).map((a) => `<div><a href="#/playbooks/${a.id}" class="${cur && cur.id === a.id ? 'pill teal' : ''}" style="display:block;padding:4px 6px">${esc(a.title)}</a></div>`).join('')}`).join('')}</div>
      <div class="card">${cur ? `<div class="detail-head"><h2>${esc(cur.title)}</h2>${state.meta.kb_articles.canWrite ? `<button class="btn sm" data-edit>Edit</button>` : ''}</div><div class="article">${esc(cur.body || '')}</div>` : '<div class="muted">No pages yet.</div>'}</div></div>`;
    const nb = $('[data-new]', el); if (nb) nb.addEventListener('click', () => openForm('kb_articles', null, { onSaved: () => P.playbooks(el, [id]) }));
    const eb = $('[data-edit]', el); if (eb) eb.addEventListener('click', () => openForm('kb_articles', cur, { onSaved: () => P.playbooks(el, [id]) }));
  };
  P.templates = async (el) => {
    const r = await api('/api/e/msg_templates?limit=200');
    el.innerHTML = `<div class="page-head"><div><h1>WhatsApp & E-mail Templates (${r.total})</h1><div class="lead">Placeholders {name} {company} {centre} {seats} {rate} {date} {time} {link} {user} fill automatically from the enquiry or client page.</div></div><div class="actions">${state.meta.msg_templates.canWrite ? '<button class="btn primary" data-new>+ New template</button>' : ''}</div></div>
      <div class="grid cols-2">${r.rows.map((t) => `<div class="card"><div class="detail-head"><div><strong>${esc(t.code)} · ${esc(t.name)}</strong> ${pill(t.channel, 'teal')} ${t.stage ? pill(t.stage) : ''}</div><div class="actions"><button class="btn xs" data-copy="${t.id}">Copy</button>${state.meta.msg_templates.canWrite ? `<button class="btn xs" data-edit="${t.id}">Edit</button>` : ''}</div></div><pre class="wa" style="margin-top:8px">${esc(t.body || '')}</pre></div>`).join('')}</div>`;
    $$('[data-copy]', el).forEach((b) => b.addEventListener('click', () => { navigator.clipboard.writeText(r.rows.find((t) => String(t.id) === b.dataset.copy).body); toast('Copied'); }));
    $$('[data-edit]', el).forEach((b) => b.addEventListener('click', () => openForm('msg_templates', r.rows.find((t) => String(t.id) === b.dataset.edit), { onSaved: () => P.templates(el) })));
    const nb = $('[data-new]', el); if (nb) nb.addEventListener('click', () => openForm('msg_templates', null, { onSaved: () => P.templates(el) }));
  };

  /* ---------- DSR ---------- */
  P.dsr = async (el) => {
    const today = App.todayStr();
    const mine = await api(`/api/e/dsr?date=${today}&user_id=${state.user.id}`);
    const all = await api('/api/e/dsr?limit=60');
    const t = (await api('/api/analytics/funnel')).targets.perDay;
    const row = mine.rows[0];
    el.innerHTML = `<div class="page-head"><div><h1>Daily Sales Report — ${fdate(today)}</h1><div class="lead">Filled at 17:30 by every salesperson, then the WhatsApp digest goes to Praveen and the PC. Daily targets come from Funnel Targets: enquiries ${num(t.enquiries, 1)} · tours ${num(t.meetings, 1)} · proposals ${num(t.proposals, 1)} · follow-ups ${num(t.follow_ups, 1)} · SCOT calls ${num(t.scot_calls, 1)} · closures ${num(t.closures, 2)}.</div></div><div class="actions"><button class="btn primary" data-fill>${row ? 'Update my DSR' : 'Fill my DSR'}</button></div></div>
      <div class="tbl-wrap"><table class="tbl compact"><thead><tr><th>Date</th><th>Salesperson</th><th class="num">Calls</th><th class="num">Connected</th><th class="num">New enq.</th><th class="num">Qual. calls</th><th class="num">Tours</th><th class="num">Proposals</th><th class="num">Follow-ups</th><th class="num">SCOT</th><th class="num">Closures</th><th class="num">MRR won</th><th>Submitted</th></tr></thead><tbody>${all.rows.map((r) => `<tr><td>${fdate(r.date)}</td><td>${esc(r.user_id_label)}</td><td class="num">${r.calls_made}</td><td class="num">${r.calls_connected}</td><td class="num">${r.new_leads}</td><td class="num">${r.qualification_calls}</td><td class="num">${r.tours}</td><td class="num">${r.proposals}</td><td class="num">${r.follow_ups}</td><td class="num">${r.scot_calls}</td><td class="num">${r.closures}</td><td class="num">${money(r.mrr_won)}</td><td class="small">${fdt(r.submitted_at)}</td></tr>`).join('') || '<tr><td colspan="13" class="empty">No reports yet.</td></tr>'}</tbody></table></div>`;
    $('[data-fill]', el).addEventListener('click', () => openForm('dsr', row || null, { onSaved: () => P.dsr(el), presets: { date: today, user_id: state.user.id } }));
  };

  /* ---------- Digest ---------- */
  P.digest = async (el) => {
    const r = await api('/api/analytics/digest');
    el.innerHTML = `<div class="page-head"><div><h1>WhatsApp digest</h1><div class="lead">Copy and paste into the SSPACIA sales group at 17:30 (or whenever Praveen asks). It lists red flags with owners, SCOT calls due and the month's numbers against plan.</div></div><div class="actions"><button class="btn primary" id="cp">Copy</button><a class="btn" target="_blank" href="https://wa.me/?text=${encodeURIComponent(r.text)}">Open WhatsApp</a></div></div><pre class="wa">${esc(r.text)}</pre>`;
    $('#cp', el).addEventListener('click', () => { navigator.clipboard.writeText(r.text); toast('Copied'); });
  };

  /* ---------- list options for entity pages ---------- */
  const LEADS = { lead: 'Every enquiry is one row with an accountable salesperson. Logging it starts the NBD Sales FMS: qualification call within the hour, tour, proposal the same day, five follow-ups, closure. Website leads arrive here automatically (Settings → intake API key).' };
  P.listOpts = (entity) => {
    if (entity === 'leads') return { lead: LEADS.lead, extraActions: '<a class="btn" href="#/fms">FMS board</a>' };
    if (entity === 'clients') return { lead: 'All clients, past and present (the ASMP Client Database). Active and on-notice accounts are called on the SCOT cycle; wallet share and cross-sell live on each client card.', extraActions: '<a class="btn" href="#/scot">SCOT board</a>' };
    if (entity === 'golden_clients') return { lead: 'The Golden 100: target companies that fit the ideal client profile. Score 0–3 on industry, size, location, timing and budget (ICP score /15); work the highest scores first — 5 contacts a day.', extraActions: '<a class="btn" href="#/e/golden_segments">Segments</a>' };
    if (entity === 'lead_gen_channels') return { lead: 'Channels sized to the funnel with weekly quotas and owners. Mark status weekly; the Weekly Review shows enquiries and wins by source so effort shifts to what converts.' };
    if (entity === 'proposals') return { lead: 'Every quote sent. Marking a proposal Sent records the FMS proposal step and starts the follow-up cadence.', extraActions: '<a class="btn" href="#/quote">Quote calculator</a>' };
    if (entity === 'plan_year') return { lead: 'Plan the Year: revenue and net profit by month (from the Gap Analysis), NBD vs CRR split and activity plan; Accounts enter actuals monthly. Used by MeCA, NBD-CRR and MCAP pages as the plan line.' };
    if (entity === 'fms_stage_defs') return { lead: 'WHAT / WHO / HOW / WHEN for every stage of the NBD and CRM flows. Offsets are in working hours (Mon–Sat 10:00–19:00), working days or calendar days; changing them re-plans every open enquiry.' };
    if (entity === 'inventory') return { lead: 'What is free, where, at what rate. Fill total units per centre and product; occupied seats were counted from the client base on first import.' };
    if (entity === 'users') return { lead: 'Roles drive the escalation chain: red flags go to the Process Coordinator, then the Sales Head (Problem Solver), then the Executive. Set a password to let someone sign in.' };
    return {};
  };

  App.logScotCall = logScotCall;
  App.doneStep = doneStep;
})();
