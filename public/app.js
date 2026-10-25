/* SSPACIA Sales Autopilot — front-end core (no build step, no dependencies) */
'use strict';
const App = (() => {
  const state = { user: null, meta: null, options: {}, route: '', pages: {} };
  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

  /* ---------- helpers ---------- */
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function money(n, dash = '—') { if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return dash; return '₹' + Math.round(Number(n)).toLocaleString('en-IN'); }
  function num(n, d = 0) { if (n === null || n === undefined || n === '') return '—'; return Number(n).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: 0 }); }
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fdate(s) { if (!s) return '—'; const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/); if (!m) return esc(s); return `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}`; }
  function fdt(s) { if (!s) return '—'; const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/); if (!m) return fdate(s); return `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1].slice(2)}, ${m[4]}:${m[5]}`; }
  function fmonth(m) { if (!m) return ''; const [y, mo] = m.split('-'); return `${MONTHS[+mo - 1]} ${y}`; }
  function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function nowLocal() { const d = new Date(); return `${todayStr()}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
  function toLocalInput(s) { if (!s) return ''; return String(s).replace(' ', 'T').slice(0, 16); }
  function pill(text, cls = '') { return `<span class="pill ${cls}">${esc(text)}</span>`; }
  function flagPill(level) { const l = Number(level || 0); if (!l) return pill('On time', 'green'); return pill(['', 'L1 → PC', 'L2 → Problem Solver', 'L3 → Praveen'][l], l === 1 ? 'amber' : l === 2 ? 'red' : 'dark'); }
  function stagePill(stage) { const map = { New: 'blue', Qualified: 'teal', 'Tour Done': 'teal', 'Proposal Sent': 'amber', Negotiation: 'amber', Won: 'green', Lost: 'red', Dormant: '', Disqualified: '' }; return pill(stage || '—', map[stage] || ''); }
  function statusPill(s) { const map = { Active: 'green', 'On Notice': 'red', Inactive: '', Terminated: 'red', Prospect: 'blue', Live: 'green', Planned: 'blue', Paused: 'amber', Dropped: '', Draft: '', Sent: 'blue', Negotiating: 'amber', Accepted: 'green', Rejected: 'red', Expired: '', Done: 'green', Running: 'teal', Cancelled: '' }; return pill(s || '—', map[s] || ''); }
  function wa(mobile, text) { if (!mobile) return ''; const m = String(mobile).replace(/\D/g, ''); const n = m.length === 10 ? '91' + m : m; return `https://wa.me/${n}${text ? '?text=' + encodeURIComponent(text) : ''}`; }
  function toast(msg, err = false) { const el = document.createElement('div'); el.className = 'toast' + (err ? ' err' : ''); el.textContent = msg; $('#toast').appendChild(el); setTimeout(() => el.remove(), err ? 5000 : 2600); }

  async function api(path, opts = {}) {
    const res = await fetch(path, { method: opts.method || 'GET', headers: opts.body ? { 'Content-Type': 'application/json' } : {}, body: opts.body ? JSON.stringify(opts.body) : undefined, credentials: 'same-origin' });
    let data = null;
    try { data = await res.json(); } catch (_) { data = null; }
    if (res.status === 401 && !path.startsWith('/api/auth/')) { renderLogin(); throw new Error('Please sign in'); }
    if (!res.ok) { const msg = (data && data.error) || `Request failed (${res.status})`; if (!opts.silent) toast(msg, true); throw new Error(msg); }
    return data;
  }

  async function options(entity) {
    if (!state.options[entity]) state.options[entity] = await api('/api/options/' + entity);
    return state.options[entity];
  }
  function invalidateOptions(entity) { delete state.options[entity]; }

  /* ---------- modal & drawer ---------- */
  function modal({ title, body, footer, onMount, wide }) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="modal"><div class="box" style="${wide ? 'width:min(900px,100%)' : ''}"><div class="head">${esc(title)}</div><div class="body">${body}</div><div class="foot">${footer || '<button class="btn" data-close>Close</button>'}</div></div></div>`;
    const close = () => { root.innerHTML = ''; };
    root.querySelector('.modal').addEventListener('click', (e) => { if (e.target.classList.contains('modal')) close(); });
    $$('[data-close]', root).forEach((b) => b.addEventListener('click', close));
    if (onMount) onMount(root, close);
    return close;
  }
  function drawer({ title, body, footer, onMount }) {
    const root = $('#modal-root');
    root.innerHTML = `<div class="drawer-bg"></div><div class="drawer"><div class="head"><h2 style="margin:0">${esc(title)}</h2><button class="btn sm" data-close>✕</button></div><div class="body">${body}</div><div class="foot">${footer || ''}</div></div>`;
    const close = () => { root.innerHTML = ''; };
    root.querySelector('.drawer-bg').addEventListener('click', close);
    $$('[data-close]', root).forEach((b) => b.addEventListener('click', close));
    if (onMount) onMount(root, close);
    return close;
  }
  function confirmBox(text, onYes) {
    modal({ title: 'Please confirm', body: `<p>${esc(text)}</p>`, footer: '<button class="btn" data-close>Cancel</button><button class="btn danger" data-yes>Yes, continue</button>', onMount: (root, close) => { $('[data-yes]', root).addEventListener('click', async () => { close(); await onYes(); }); } });
  }

  /* ---------- generic forms ---------- */
  async function fieldHtml(f, value, entity) {
    const id = `f_${f.name}`;
    const v = value === null || value === undefined ? (f.default !== undefined && f.default !== 'now' && f.default !== 'today' ? f.default : '') : value;
    const req = f.required && !f.readonly ? ' required' : '';
    const ro = f.readonly ? ' disabled' : '';
    let input = '';
    switch (f.type) {
      case 'text': case 'json': input = `<textarea id="${id}" name="${f.name}"${ro}>${esc(v)}</textarea>`; break;
      case 'int': input = `<input id="${id}" name="${f.name}" type="number" step="1" value="${esc(v)}"${req}${ro}>`; break;
      case 'decimal': case 'money': case 'pct': input = `<input id="${id}" name="${f.name}" type="number" step="any" value="${esc(v)}"${req}${ro}>`; break;
      case 'date': input = `<input id="${id}" name="${f.name}" type="date" value="${esc(String(v || '').slice(0, 10))}"${req}${ro}>`; break;
      case 'datetime': input = `<input id="${id}" name="${f.name}" type="datetime-local" value="${esc(value ? toLocalInput(value) : (f.default === 'now' ? nowLocal() : ''))}"${req}${ro}>`; break;
      case 'bool': input = `<select id="${id}" name="${f.name}"${ro}><option value="1"${Number(v) === 1 || v === true ? ' selected' : ''}>Yes</option><option value="0"${!(Number(v) === 1 || v === true) ? ' selected' : ''}>No</option></select>`; break;
      case 'password': input = `<input id="${id}" name="${f.name}" type="password" autocomplete="new-password" placeholder="••••••••">`; break;
      case 'select': input = `<select id="${id}" name="${f.name}"${req}${ro}><option value="">—</option>${f.options.map((o) => `<option value="${esc(o)}"${o === v ? ' selected' : ''}>${esc((f.optionLabels && f.optionLabels[o]) || o)}</option>`).join('')}</select>`; break;
      case 'ref': { const opts = await options(f.ref); input = `<select id="${id}" name="${f.name}"${req}${ro}><option value="">—</option>${opts.map((o) => `<option value="${o.id}"${String(o.id) === String(v) ? ' selected' : ''}>${esc(o.label)}${o.enq_no ? ' · ' + esc(o.enq_no) : ''}${o.company && f.ref === 'leads' ? ' · ' + esc(o.company) : ''}</option>`).join('')}</select>`; break; }
      default: input = `<input id="${id}" name="${f.name}" type="text" value="${esc(v)}"${req}${ro}>`;
    }
    const span = ['text', 'json'].includes(f.type) ? ' span2' : '';
    return `<div class="field${span}"><label for="${id}">${esc(f.label)}${f.required && !f.readonly ? ' *' : ''}</label>${input}${f.help ? `<div class="help">${esc(f.help)}</div>` : ''}</div>`;
  }
  async function formHtml(entity, row, only) {
    const def = state.meta[entity];
    const fields = def.fields.filter((f) => !f.readonly || (row && row[f.name] !== null && row[f.name] !== undefined)).filter((f) => !only || only.includes(f.name));
    const parts = [];
    for (const f of fields) parts.push(await fieldHtml(f, row ? row[f.name] : null, entity));
    return `<form class="form-grid" id="entity-form" autocomplete="off">${parts.join('')}</form>`;
  }
  function readForm(formEl) {
    const out = {};
    $$('input, select, textarea', formEl).forEach((el) => {
      if (!el.name || el.disabled) return;
      if (el.type === 'password' && !el.value) return;
      let v = el.value;
      if (el.type === 'datetime-local' && v) v = v.replace('T', ' ') + ':00';
      out[el.name] = v;
    });
    return out;
  }
  async function openForm(entity, row, { onSaved, title, only, presets } = {}) {
    const def = state.meta[entity];
    const body = await formHtml(entity, Object.assign({}, presets || {}, row || {}), only);
    drawer({
      title: title || (row ? `Edit ${def.label}` : `New ${def.label}`), body,
      footer: `${row && def.canWrite ? '<button class="btn danger" data-del>Delete</button>' : ''}<span style="flex:1"></span><button class="btn" data-close>Cancel</button><button class="btn primary" data-save>Save</button>`,
      onMount: (root, close) => {
        $('[data-save]', root).addEventListener('click', async () => {
          const form = $('#entity-form', root);
          if (!form.reportValidity()) return;
          const data = readForm(form);
          try {
            const res = row ? await api(`/api/e/${entity}/${row.id}`, { method: 'PUT', body: data }) : await api(`/api/e/${entity}`, { method: 'POST', body: data });
            toast(res.message || 'Saved');
            invalidateOptions(entity);
            close();
            if (onSaved) onSaved(res.data);
          } catch (e) { /* toast shown */ }
        });
        const del = $('[data-del]', root);
        if (del) del.addEventListener('click', () => confirmBox(`Delete this ${def.label}? This cannot be undone.`, async () => { await api(`/api/e/${entity}/${row.id}`, { method: 'DELETE' }); toast('Deleted'); close(); invalidateOptions(entity); if (onSaved) onSaved(null); }));
      },
    });
  }

  /* ---------- generic list ---------- */
  function cellValue(f, row) {
    const v = row[f.name];
    if (f.type === 'ref') return esc(row[f.name + '_label'] || '');
    if (v === null || v === undefined || v === '') return '<span class="muted">—</span>';
    switch (f.type) {
      case 'money': return money(v);
      case 'pct': return num(v, 2) + '%';
      case 'decimal': return num(v, 2);
      case 'int': return num(v);
      case 'date': return fdate(v);
      case 'datetime': return fdt(v);
      case 'bool': return Number(v) ? '✓' : '—';
      case 'select': if (f.name === 'stage') return stagePill(v); if (f.name === 'status') return statusPill(v); return esc((f.optionLabels && f.optionLabels[v]) || v);
      case 'text': return esc(String(v).slice(0, 90)) + (String(v).length > 90 ? '…' : '');
      default: return esc(v);
    }
  }
  const listState = {};
  async function renderEntityList(entity, container, opts = {}) {
    const def = state.meta[entity];
    if (!def) { container.innerHTML = '<div class="card">Unknown module</div>'; return; }
    const ls = listState[entity] = listState[entity] || { search: '', sort: '', filters: {}, offset: 0 };
    Object.assign(ls.filters, opts.filters || {});
    const listFields = def.fields.filter((f) => f.list);
    const q = new URLSearchParams();
    if (ls.search) q.set('search', ls.search);
    if (ls.sort) q.set('sort', ls.sort);
    q.set('limit', 100); q.set('offset', ls.offset);
    for (const [k, v] of Object.entries(ls.filters)) if (v !== '' && v !== null && v !== undefined) q.set(k, v);
    const res = await api(`/api/e/${entity}?${q}`);
    const selectFilters = def.fields.filter((f) => f.type === 'select' && ['stage', 'status', 'role', 'block', 'channel', 'category', 'flow', 'type', 'channel_type'].includes(f.name)).slice(0, 2);
    const refFilters = def.fields.filter((f) => f.type === 'ref' && ['centre_id', 'assigned_to', 'user_id', 'relationship_owner', 'segment_id', 'owner_user_id', 'product_id'].includes(f.name)).slice(0, 2);
    const refOpts = {};
    for (const f of refFilters) refOpts[f.name] = await options(f.ref);
    const rowLink = opts.rowLink || (entity === 'leads' ? (r) => `#/lead/${r.id}` : entity === 'clients' ? (r) => `#/client/${r.id}` : null);
    container.innerHTML = `
      <div class="page-head"><div><h1>${esc(opts.title || def.plural)}</h1>${opts.lead ? `<div class="lead">${opts.lead}</div>` : ''}</div>
        <div class="actions">${opts.extraActions || ''}<a class="btn" href="/api/e/${entity}/export.csv" target="_blank">Export CSV</a>${def.canWrite && !opts.noCreate ? `<button class="btn primary" data-new>+ New ${esc(def.label)}</button>` : ''}</div></div>
      <div class="toolbar">${def.searchFields.length ? `<input type="search" placeholder="Search ${esc(def.searchFields.join(', '))}…" value="${esc(ls.search)}" data-search>` : ''}
        ${selectFilters.map((f) => `<select data-filter="${f.name}"><option value="">${esc(f.label)}: all</option>${f.options.filter(Boolean).map((o) => `<option value="${esc(o)}"${ls.filters[f.name] === o ? ' selected' : ''}>${esc((f.optionLabels && f.optionLabels[o]) || o)}</option>`).join('')}</select>`).join('')}
        ${refFilters.map((f) => `<select data-filter="${f.name}"><option value="">${esc(f.label)}: all</option>${refOpts[f.name].map((o) => `<option value="${o.id}"${String(ls.filters[f.name]) === String(o.id) ? ' selected' : ''}>${esc(o.label)}</option>`).join('')}</select>`).join('')}
        <span class="muted small">${res.total} record${res.total === 1 ? '' : 's'}</span></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr>${listFields.map((f) => `<th class="sortable${['money', 'int', 'decimal', 'pct'].includes(f.type) ? ' num' : ''}" data-sort="${f.name}">${esc(f.label)}${ls.sort === f.name ? ' ▲' : ls.sort === '-' + f.name ? ' ▼' : ''}</th>`).join('')}<th></th></tr></thead>
      <tbody>${res.rows.length ? res.rows.map((r) => `<tr class="${rowLink ? 'clickable' : ''}" data-id="${r.id}">${listFields.map((f) => `<td class="${['money', 'int', 'decimal', 'pct'].includes(f.type) ? 'num' : ''}">${cellValue(f, r)}</td>`).join('')}<td class="nowrap">${rowLink ? `<a class="btn xs" href="${rowLink(r)}">Open</a> ` : ''}${def.canWrite ? `<button class="btn xs" data-edit="${r.id}">Edit</button>` : ''}</td></tr>`).join('') : `<tr><td colspan="${listFields.length + 1}" class="empty">Nothing here yet.</td></tr>`}</tbody></table></div>
      ${res.total > res.limit ? `<div class="toolbar" style="margin-top:8px"><button class="btn sm" data-page="-1" ${ls.offset === 0 ? 'disabled' : ''}>← Previous</button><span class="muted small">${ls.offset + 1}–${Math.min(ls.offset + res.limit, res.total)} of ${res.total}</span><button class="btn sm" data-page="1" ${ls.offset + res.limit >= res.total ? 'disabled' : ''}>Next →</button></div>` : ''}`;
    const rerender = () => renderEntityList(entity, container, opts);
    const s = $('[data-search]', container);
    if (s) { let t; s.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { ls.search = s.value; ls.offset = 0; rerender(); }, 300); }); }
    $$('[data-filter]', container).forEach((el) => el.addEventListener('change', () => { ls.filters[el.dataset.filter] = el.value; ls.offset = 0; rerender(); }));
    $$('[data-sort]', container).forEach((th) => th.addEventListener('click', () => { const k = th.dataset.sort; ls.sort = ls.sort === k ? '-' + k : k; rerender(); }));
    $$('[data-page]', container).forEach((b) => b.addEventListener('click', () => { ls.offset = Math.max(0, ls.offset + Number(b.dataset.page) * res.limit); rerender(); }));
    const nb = $('[data-new]', container);
    if (nb) nb.addEventListener('click', () => openForm(entity, null, { onSaved: rerender, presets: opts.presets, only: def.createFields || undefined }));
    $$('[data-edit]', container).forEach((b) => b.addEventListener('click', async (e) => { e.stopPropagation(); const row = res.rows.find((r) => String(r.id) === b.dataset.edit); openForm(entity, row, { onSaved: rerender }); }));
    if (rowLink) $$('tr.clickable', container).forEach((tr) => tr.addEventListener('click', (e) => { if (e.target.closest('button, a')) return; const row = res.rows.find((r) => String(r.id) === tr.dataset.id); location.hash = rowLink(row); }));
  }

  /* ---------- auth screens ---------- */
  function renderSetup() {
    $('#app').innerHTML = `<div class="auth"><div class="box"><h1>Welcome to SSPACIA Sales Autopilot</h1><p class="muted">First-time setup: create the Executive (admin) account. You can add the team afterwards under Users &amp; Roles.</p>
      <form id="setup"><div class="field"><label>Your name</label><input name="name" value="Praveen Agarwal" required></div><div class="field"><label>E-mail (login)</label><input name="email" type="email" placeholder="you@company.com" required></div><div class="field"><label>Mobile</label><input name="mobile"></div><div class="field"><label>Password (min 8 characters)</label><input name="password" type="password" minlength="8" required></div><div class="field"><label>Confirm password</label><input name="password2" type="password" minlength="8" required></div><button class="btn primary" style="width:100%;justify-content:center">Create account &amp; sign in</button></form></div></div>`;
    $('#setup').addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = readForm(e.target);
      if (d.password !== d.password2) return toast('Passwords do not match', true);
      try { await api('/api/auth/setup', { method: 'POST', body: d }); location.hash = '#/dashboard'; boot(); } catch (_) { /* toast */ }
    });
  }
  function renderLogin() {
    $('#app').innerHTML = `<div class="auth"><div class="box"><h1>SSPACIA Sales Autopilot</h1><p class="muted">Sign in with your e-mail and password.</p>
      <form id="login"><div class="field"><label>E-mail</label><input name="email" type="email" required autofocus></div><div class="field"><label>Password</label><input name="password" type="password" required></div><button class="btn primary" style="width:100%;justify-content:center">Sign in</button></form>
      <p class="small muted" style="margin-top:12px">No password yet? Ask the Executive to set one under Users &amp; Roles.</p></div></div>`;
    $('#login').addEventListener('submit', async (e) => { e.preventDefault(); try { await api('/api/auth/login', { method: 'POST', body: readForm(e.target) }); boot(); } catch (_) { /* toast */ } });
  }

  /* ---------- shell & routing ---------- */
  const NAV = [
    { group: 'Today', items: [['#/dashboard', 'Dashboard'], ['#/redflags', 'Red Flags'], ['#/dsr', 'Daily Sales Report'], ['#/digest', 'WhatsApp Digest']] },
    { group: 'New Business (NBD)', items: [['#/e/leads', 'Enquiry Capture / Lead Register'], ['#/fms', 'NBD Sales FMS board'], ['#/followups', 'Follow-ups due'], ['#/quote', 'Quote Calculator'], ['#/e/proposals', 'Proposals'], ['#/lost', 'Lost & Win-back']] },
    { group: 'Existing Clients (CRR)', items: [['#/scot', 'SCOT — calls & renewals'], ['#/scot-grid', 'SCOT monthly grid'], ['#/e/clients', 'Client Database'], ['#/crm', 'CRM FMS (onboarding)'], ['#/wallet', 'Wallet Share & Cross-sell'], ['#/e/call_logs', 'Call & Activity Log']] },
    { group: 'Lead Generation', items: [['#/e/golden_clients', 'Golden Client List'], ['#/e/golden_segments', 'Golden Segments (ICP)'], ['#/e/lead_gen_channels', 'Lead Generation Plan'], ['#/e/marketing_campaigns', 'Marketing Calendar'], ['#/playbooks', 'Marketing Strategy & Playbooks']] },
    { group: 'Sales Toolkit', items: [['#/e/scripts', 'Scripts & Objections'], ['#/templates', 'WhatsApp Templates'], ['#/e/inventory', 'Inventory to Sell']] },
    { group: 'Growth Sciences', items: [['#/funnel', 'Funnel Targets'], ['#/meca', 'MeCA (monthly)'], ['#/meca-weekly', 'Sales Rep MeCA (weekly)'], ['#/mcap', 'MCAP & 5-for-5'], ['#/nbd-crr', 'NBD vs CRR'], ['#/leaking', 'Leaking Bucket'], ['#/gp', 'G.P. Sheet'], ['#/gap', 'Gap Analysis'], ['#/e/plan_year', 'Plan the Year'], ['#/compounding', 'Compounding 4X'], ['#/weekly', 'Weekly Sales Review']] },
    { group: 'Masters & Settings', items: [['#/e/centres', 'Centres'], ['#/e/products', 'Products'], ['#/e/rate_card', 'Rate Card'], ['#/e/lead_sources', 'Lead Sources'], ['#/e/lost_reasons', 'Lost Reasons'], ['#/e/fms_stage_defs', 'FMS Stage Definitions'], ['#/e/users', 'Users & Roles'], ['#/settings', 'Settings'], ['#/e/activity_log', 'Audit Log']] },
  ];
  function renderShell() {
    const u = state.user;
    $('#app').innerHTML = `<div class="shell"><aside class="sidebar" id="sidebar"><div class="brand"><div class="logo">S</div><div>SSPACIA<span class="sub">Sales Autopilot · ASMP</span></div></div><nav class="nav" id="nav">${NAV.map((g) => `<div class="nav-group">${esc(g.group)}</div>${g.items.map(([h, l]) => `<a href="${h}" data-nav="${h}">${esc(l)}${h === '#/redflags' ? '<span class="badge" id="flag-badge" style="display:none"></span>' : ''}</a>`).join('')}`).join('')}</nav></aside>
      <div class="main"><div class="topbar"><button class="btn sm menu-btn" id="menu-btn">☰</button><strong id="page-title"></strong><span class="spacer"></span><span class="user">${esc(u.name)} · ${esc(roleLabel(u.role))}</span><button class="btn sm" id="pw-btn">Password</button><button class="btn sm" id="logout-btn">Sign out</button></div><div class="content" id="content"></div></div></div>`;
    $('#logout-btn').addEventListener('click', async () => { await api('/api/auth/logout', { method: 'POST', body: {} }); state.user = null; renderLogin(); });
    $('#menu-btn').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
    $('#nav').addEventListener('click', () => $('#sidebar').classList.remove('open'));
    $('#pw-btn').addEventListener('click', () => modal({ title: 'Change password', body: `<form id="pwf"><div class="field"><label>Current password</label><input name="current" type="password" required></div><div class="field"><label>New password</label><input name="password" type="password" minlength="8" required></div></form>`, footer: '<button class="btn" data-close>Cancel</button><button class="btn primary" data-ok>Change</button>', onMount: (root, close) => { $('[data-ok]', root).addEventListener('click', async () => { const f = $('#pwf', root); if (!f.reportValidity()) return; await api('/api/auth/change-password', { method: 'POST', body: readForm(f) }); toast('Password changed'); close(); }); } }));
  }
  function roleLabel(r) { const f = state.meta && state.meta.users.fields.find((x) => x.name === 'role'); return (f && f.optionLabels && f.optionLabels[r]) || r; }

  async function route() {
    if (!state.user) return;
    const hash = location.hash || '#/dashboard';
    state.route = hash;
    $$('[data-nav]').forEach((a) => a.classList.toggle('active', hash === a.dataset.nav || hash.startsWith(a.dataset.nav + '/') && a.dataset.nav.startsWith('#/e/')));
    const content = $('#content');
    content.innerHTML = '<div class="muted">Loading…</div>';
    const parts = hash.slice(2).split('/');
    try {
      if (parts[0] === 'e' && parts[1]) {
        $('#page-title').textContent = state.meta[parts[1]] ? state.meta[parts[1]].plural : '';
        await renderEntityList(parts[1], content, state.pages.listOpts ? state.pages.listOpts(parts[1]) : {});
      } else if (state.pages[parts[0]]) {
        $('#page-title').textContent = '';
        await state.pages[parts[0]](content, parts.slice(1));
      } else {
        content.innerHTML = '<div class="card">Page not found.</div>';
      }
      window.scrollTo(0, 0);
    } catch (e) { content.innerHTML = `<div class="card">Could not load this page: ${esc(e.message)}</div>`; }
  }

  async function boot() {
    try {
      const st = await api('/api/auth/status');
      if (st.needsSetup) return renderSetup();
      if (!st.user) return renderLogin();
      state.user = st.user;
      state.meta = await api('/api/meta');
      renderShell();
      await route();
      refreshBadge();
    } catch (e) { $('#app').innerHTML = `<div class="boot">Could not start: ${esc(e.message)}</div>`; }
  }
  async function refreshBadge() {
    try { const r = await api('/api/analytics/red-flags', { silent: true }); const n = r.counts.l1 + r.counts.l2 + r.counts.l3; const b = $('#flag-badge'); if (b) { b.textContent = n; b.style.display = n ? '' : 'none'; } } catch (_) { /* ignore */ }
  }
  window.addEventListener('hashchange', route);

  return { boot, route, state, api, options, invalidateOptions, esc, money, num, fdate, fdt, fmonth, todayStr, nowLocal, toLocalInput, pill, flagPill, stagePill, statusPill, wa, toast, modal, drawer, confirmBox, openForm, readForm, fieldHtml, renderEntityList, refreshBadge, $, $$, MONTHS };
})();
