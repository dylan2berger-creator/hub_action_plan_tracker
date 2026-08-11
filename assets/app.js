/* ============================================================
   The Hub — Action Plans (Kanban)
   Renders the mock action-plan dataset (assets/data.js).
   State is held in memory only — no persistence. Drag moves
   tasks between columns; cards are viewable and editable.
   ============================================================ */
(function () {
  'use strict';

  var DATA = window.HUB_DATA || { stores: [], plans: [], rootCauses: [], referenceDate: '2026-08-10' };
  var TODAY = parseISO(DATA.referenceDate);

  var COLUMNS = [
    { key: 'identified', label: 'Identified',  accent: '#6a4c93' },
    { key: 'inprogress', label: 'In Progress', accent: '#2b7a8e' },
    { key: 'blocked',    label: 'Blocked',     accent: '#ba1a1a' },
    { key: 'verifying',  label: 'Verifying',   accent: '#c1660f' },
    { key: 'closed',     label: 'Closed',      accent: '#36832f' }
  ];
  // 'planned' was merged into 'identified'
  function normColumn(c) { return c === 'planned' ? 'identified' : c; }

  var PRIORITIES = [
    { key: 'urgent', label: 'Urgent', chip: 'chip-red' },
    { key: 'high',   label: 'High',   chip: 'chip-orange' },
    { key: 'medium', label: 'Medium', chip: 'chip-blue' },
    { key: 'low',    label: 'Low',    chip: 'chip-gray' }
  ];
  var PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

  var OUTCOMES = ['Improved', 'No Change', 'No Change — market driven', 'Superseded'];

  var ROOT_BY_KEY = {};
  (DATA.rootCauses || []).forEach(function (r) { ROOT_BY_KEY[r.key] = r; });
  var STORE_BY_ID = {};
  (DATA.stores || []).forEach(function (s) { STORE_BY_ID[s.id] = s; });
  var PLAN_BY_ID = {};
  (DATA.plans || []).forEach(function (p) { PLAN_BY_ID[p.id] = p; });

  // how many plans point at each plan as a parent (for "upstream of N")
  var CHILD_COUNT = {};
  (DATA.plans || []).forEach(function (p) {
    if (p.parentPlanId) CHILD_COUNT[p.parentPlanId] = (CHILD_COUNT[p.parentPlanId] || 0) + 1;
  });

  // Flatten plan tasks into a single in-memory list (source of truth for the board)
  var tasks = [];
  (DATA.plans || []).forEach(function (p) {
    (p.tasks || []).forEach(function (t) {
      var item = shallow(t);
      item.planId = p.id;
      item.storeId = p.storeId;
      item.column = normColumn(item.column);
      tasks.push(item);
    });
  });
  var taskSeq = 1000;

  var MARKET = DATA.market || { name: 'Market', manager: '', storeIds: [] };
  var ALL_STORE_IDS = (DATA.stores || []).map(function (s) { return s.id; });
  function isMarketScope(id) { return typeof id === 'string' && id.indexOf('mkt::') === 0; }
  function resolveIds(storeId) {
    if (storeId === 'book') return MARKET.storeIds.slice();
    // Region-level scopes (Regional Manager) have no per-market stores in this
    // prototype — the board shows the region's instrumented action plans (all stores).
    if (storeId === 'all' || storeId === 'region' || isMarketScope(storeId)) return ALL_STORE_IDS.slice();
    return [storeId];
  }
  function scopeIds() { return resolveIds(state.store); }
  function inScope(sid) { return scopeIds().indexOf(sid) >= 0; }

  var state = {
    view: 'plans',
    role: 'gm',
    store: DATA.defaultStoreId || 'all',
    root: 'all',
    owner: 'all',
    behind: false,
    search: '',
    sort: 'due'
  };
  var editingId = null;

  /* ---------------- helpers ---------------- */
  function shallow(o) { var n = {}; for (var k in o) n[k] = o[k]; if (o.verificationSignal) n.verificationSignal = { metric: o.verificationSignal.metric, lagDays: o.verificationSignal.lagDays }; if (o.activityLog) n.activityLog = o.activityLog.map(function (e) { return { date: e.date, note: e.note }; }); return n; }
  function parseISO(s) { if (!s) return null; var p = String(s).split('-'); if (p.length !== 3) return null; return new Date(+p[0], +p[1] - 1, +p[2]); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function daysBetween(a, b) { return Math.round((a - b) / 86400000); }
  function fmtDate(s) { var d = parseISO(s); if (!d) return ''; return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  function fmtDateY(s) { var d = parseISO(s); if (!d) return ''; return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
  function uid() { taskSeq += 1; return 'T-' + taskSeq; }
  function initials(name) { var p = String(name || '').trim().split(/\s+/).filter(Boolean); if (!p.length) return '—'; if (p.length === 1) return p[0].slice(0, 2).toUpperCase(); return (p[0][0] + p[p.length - 1][0]).toUpperCase(); }
  var AV = ['#2b7a8e', '#00529b', '#6a4c93', '#b5179e', '#36832f', '#c1660f', '#9d174d', '#006a64', '#3375af', '#5f5e5e'];
  function avatarColor(name) { var h = 0, s = String(name || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return AV[h % AV.length]; }
  function planOf(t) { return PLAN_BY_ID[t.planId]; }
  function storeOf(t) { return STORE_BY_ID[t.storeId]; }
  function rootOf(t) { var p = planOf(t); return p ? ROOT_BY_KEY[p.rootCauseCategory] : null; }
  function colMeta(key) { for (var i = 0; i < COLUMNS.length; i++) if (COLUMNS[i].key === key) return COLUMNS[i]; return COLUMNS[0]; }
  function colIndex(key) { for (var i = 0; i < COLUMNS.length; i++) if (COLUMNS[i].key === key) return i; return 0; }
  function priorityMeta(key) { for (var i = 0; i < PRIORITIES.length; i++) if (PRIORITIES[i].key === key) return PRIORITIES[i]; return PRIORITIES[2]; }

  function isOverdue(t) { return t.column !== 'closed' && t.dueDate && daysBetween(parseISO(t.dueDate), TODAY) < 0; }
  function isBehind(t) {
    if (t.column === 'closed') return false;
    if (t.dueDate && daysBetween(parseISO(t.dueDate), TODAY) < 0) return true;
    var p = planOf(t);
    if (p && p.targetCloseDate && daysBetween(parseISO(p.targetCloseDate), TODAY) < 0) return true;
    return false;
  }

  /* ---------------- filtering ---------------- */
  function visible() {
    var q = state.search.trim().toLowerCase();
    return tasks.filter(function (t) {
      if (!inScope(t.storeId)) return false;
      var p = planOf(t);
      if (state.root !== 'all' && (!p || p.rootCauseCategory !== state.root)) return false;
      if (state.owner !== 'all' && t.ownerName !== state.owner) return false;
      if (state.behind && !isBehind(t)) return false;
      if (q) {
        var s = storeOf(t), r = rootOf(t);
        var hay = [t.title, t.description, t.ownerName, t.ownerRole, p && p.diagnosis, p && p.carrier,
                   s && s.name, r && r.label, t.blockedReason, t.verificationSignal && t.verificationSignal.metric]
                  .join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }
  function sortTasks(list) {
    var s = state.sort;
    return list.slice().sort(function (a, b) {
      if (s === 'priority') return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (s === 'opened') { var pa = planOf(a), pb = planOf(b); return (parseISO((pb && pb.openedDate) || '2000-01-01')) - (parseISO((pa && pa.openedDate) || '2000-01-01')); }
      var da = a.dueDate ? parseISO(a.dueDate).getTime() : Infinity;
      var db = b.dueDate ? parseISO(b.dueDate).getTime() : Infinity;
      return da - db;
    });
  }

  /* ---------------- rendering ---------------- */
  var boardEl, statPlans, statBlocked, statBehind, pageSub;

  function render() {
    var shown = visible();
    var byCol = {};
    COLUMNS.forEach(function (c) { byCol[c.key] = []; });
    shown.forEach(function (t) { (byCol[t.column] || (byCol[t.column] = [])).push(t); });

    boardEl.innerHTML = COLUMNS.map(function (c) {
      var list = sortTasks(byCol[c.key] || []);
      var cards = list.length ? list.map(cardHTML).join('') : '<div class="col-empty">Nothing here</div>';
      return (
        '<section class="column" data-col="' + c.key + '" aria-label="' + esc(c.label) + '">' +
          '<div class="column-head">' +
            '<span class="column-dot" style="background:' + c.accent + '"></span>' +
            '<span class="column-title">' + esc(c.label) + '</span>' +
            '<span class="count-badge">' + list.length + '</span>' +
          '</div>' +
          '<div class="cards">' + cards + '</div>' +
        '</section>'
      );
    }).join('');

    // stats reflect the current store scope
    var scope = tasks.filter(function (t) { return inScope(t.storeId); });
    var planIds = {}, storeIds = {}, blocked = 0, behind = 0;
    scope.forEach(function (t) {
      planIds[t.planId] = 1; storeIds[t.storeId] = 1;
      if (t.column === 'blocked') blocked++;
      if (isBehind(t)) behind++;
    });
    statPlans.textContent = Object.keys(planIds).length;
    statBlocked.textContent = blocked;
    statBehind.textContent = behind;
    var nStores = Object.keys(storeIds).length;
    pageSub.textContent = Object.keys(planIds).length + ' plan' + (Object.keys(planIds).length === 1 ? '' : 's') +
      ' across ' + nStores + ' store' + (nStores === 1 ? '' : 's') + ' · as of ' + fmtDateY(DATA.referenceDate);
  }

  function catChip(root) {
    if (!root) return '';
    return '<span class="chip cat" style="background:' + root.bg + ';color:' + root.fg + '">' +
      '<span class="dot" style="background:' + root.dot + '"></span>' + esc(root.label) + '</span>';
  }

  function cardHTML(t) {
    var p = planOf(t), s = storeOf(t), root = rootOf(t), pm = priorityMeta(t.priority);
    var idx = colIndex(t.column);
    var eyebrow = (scopeIds().length > 1 && s) ? '<div class="card-eyebrow">' + esc(s.name) + '</div>' : '';

    var dueHTML = '';
    if (t.dueDate) {
      var du = daysBetween(parseISO(t.dueDate), TODAY), cls = '', label = fmtDate(t.dueDate);
      if (t.column !== 'closed') {
        if (du < 0) { cls = ' overdue'; label = 'Overdue · ' + label; }
        else if (du <= 2) { cls = ' soon'; label = (du === 0 ? 'Due today' : 'Due ' + label); }
      }
      dueHTML = '<span class="due' + cls + '">' + calIcon() + esc(label) + '</span>';
    }

    var signal = t.verificationSignal && t.verificationSignal.metric
      ? '<div class="signal">' + eyeIcon() + 'Watching <b>' + esc(t.verificationSignal.metric) + '</b>' +
        (t.verificationSignal.lagDays ? ' · ~' + t.verificationSignal.lagDays + 'd' : '') + '</div>'
      : '';

    var blocked = (t.column === 'blocked' && t.blockedReason)
      ? '<div class="blocked-note">' + lockIcon() + esc(t.blockedReason) + '</div>' : '';

    var outcome = (t.column === 'closed' && t.outcome)
      ? '<span class="chip outcome ' + outcomeClass(t.outcome) + '">' + esc(t.outcome) + '</span>' : '';

    var link = (p && p.parentPlanId && PLAN_BY_ID[p.parentPlanId])
      ? '<span class="chip link-chip" title="Downstream of ' + esc(p.parentPlanId) + '">↳ linked</span>' : '';
    var upstream = (p && CHILD_COUNT[p.id])
      ? '<span class="chip link-chip up" title="Upstream cause">▲ upstream of ' + CHILD_COUNT[p.id] + '</span>' : '';
    var carrier = (p && p.carrier) ? '<span class="chip chip-gray">' + esc(p.carrier) + '</span>' : '';

    return (
      '<article class="card p-' + esc(t.priority) + '" draggable="true" data-id="' + esc(t.id) + '" tabindex="0" role="button" aria-label="Open ' + esc(t.title) + '">' +
        eyebrow +
        '<div class="card-meta">' + catChip(root) + carrier + link + upstream + '</div>' +
        '<div class="card-title">' + esc(t.title) + '</div>' +
        (t.description ? '<div class="card-desc">' + esc(t.description) + '</div>' : '') +
        signal +
        blocked +
        '<div class="card-foot">' +
          '<span class="owner">' + avatarHTML(t.ownerName) + '<span class="owner-txt"><b>' + esc(t.ownerName || 'Unassigned') + '</b><span class="owner-role">' + esc(t.ownerRole || '') + '</span></span></span>' +
          '<span class="chip ' + pm.chip + '">' + esc(pm.label) + '</span>' +
        '</div>' +
        '<div class="card-foot foot2">' +
          '<span class="foot-left">' + dueHTML + outcome + '</span>' +
          '<span class="card-moves">' +
            '<button class="mini-btn" data-move="prev" data-id="' + esc(t.id) + '" aria-label="Move left"' + (idx === 0 ? ' disabled' : '') + '>' + chevL() + '</button>' +
            '<button class="mini-btn" data-move="next" data-id="' + esc(t.id) + '" aria-label="Move right"' + (idx === COLUMNS.length - 1 ? ' disabled' : '') + '>' + chevR() + '</button>' +
            '<button class="mini-btn" data-edit="' + esc(t.id) + '" aria-label="Open task">' + editIcon() + '</button>' +
          '</span>' +
        '</div>' +
      '</article>'
    );
  }

  function ctxRow(k, v) { return '<div class="ctx-row"><span class="k">' + esc(k) + '</span><span class="v">' + v + '</span></div>'; }
  function outcomeClass(o) { if (o === 'Improved') return 'chip-green'; if (o === 'Superseded') return 'chip-blue'; return 'chip-gray'; }
  function avatarHTML(name) { return '<span class="avatar" style="background:' + avatarColor(name) + '">' + esc(initials(name)) + '</span>'; }

  /* ---------------- icons ---------------- */
  function calIcon() { return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m0 16H5V10h14zm0-12H5V6h14z"/></svg>'; }
  function eyeIcon() { return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7m0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8m0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4"/></svg>'; }
  function lockIcon() { return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2M9 6a3 3 0 0 1 6 0v2H9zm3 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4"/></svg>'; }
  function chevL() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>'; }
  function chevR() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>'; }
  function editIcon() { return '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z"/></svg>'; }

  /* ---------------- board interactions ---------------- */
  function onBoardClick(e) {
    var mv = e.target.closest('[data-move]');
    if (mv) { e.stopPropagation(); moveItem(mv.getAttribute('data-id'), mv.getAttribute('data-move')); return; }
    var ed = e.target.closest('[data-edit]');
    if (ed) { e.stopPropagation(); openModal(ed.getAttribute('data-edit')); return; }
    var card = e.target.closest('.card');
    if (card) openModal(card.getAttribute('data-id'));
  }
  function onBoardKey(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var card = e.target.closest('.card');
    if (card && e.target === card) { e.preventDefault(); openModal(card.getAttribute('data-id')); }
  }
  function findTask(id) { for (var i = 0; i < tasks.length; i++) if (tasks[i].id === id) return tasks[i]; return null; }
  function moveItem(id, dir) {
    var t = findTask(id); if (!t) return;
    var idx = colIndex(t.column) + (dir === 'next' ? 1 : -1);
    if (idx < 0 || idx >= COLUMNS.length) return;
    t.column = COLUMNS[idx].key;
    render();
  }

  /* ---------------- drag & drop ---------------- */
  var dragId = null;
  function onDragStart(e) { var c = e.target.closest('.card'); if (!c) return; dragId = c.getAttribute('data-id'); c.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (x) {} }
  function onDragEnd(e) { var c = e.target.closest('.card'); if (c) c.classList.remove('dragging'); dragId = null; Array.prototype.forEach.call(document.querySelectorAll('.column.drag-over'), function (n) { n.classList.remove('drag-over'); }); }
  function onDragOver(e) { var col = e.target.closest('.column'); if (!col) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; col.classList.add('drag-over'); }
  function onDragLeave(e) { var col = e.target.closest('.column'); if (!col) return; if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over'); }
  function onDrop(e) {
    var col = e.target.closest('.column'); if (!col) return; e.preventDefault();
    var id = dragId; try { id = e.dataTransfer.getData('text/plain') || dragId; } catch (x) {}
    var t = findTask(id);
    if (t) { t.column = col.getAttribute('data-col'); render(); }
    col.classList.remove('drag-over');
  }

  /* ---------------- modal (edit + context) ---------------- */
  var overlay, modalTitle, deleteBtn,
      fPlan, fTitle, fDesc, fOwner, fRole, fStatus, fPriority, fDue, fRisk, fBlocked, fMetric, fLag,
      ctxWrap, logWrap, noteInput;

  function planOptionsHTML(selectedPlanId) {
    var plans = (DATA.plans || []).slice().sort(function (a, b) {
      var sa = STORE_BY_ID[a.storeId].name, sb = STORE_BY_ID[b.storeId].name;
      return sa < sb ? -1 : sa > sb ? 1 : (a.id < b.id ? -1 : 1);
    });
    return plans.map(function (p) {
      var r = ROOT_BY_KEY[p.rootCauseCategory];
      var lab = STORE_BY_ID[p.storeId].name + ' · ' + (r ? r.label : '') + ' · ' + p.id;
      return '<option value="' + esc(p.id) + '"' + (p.id === selectedPlanId ? ' selected' : '') + '>' + esc(lab) + '</option>';
    }).join('');
  }

  function openModal(id) {
    editingId = id || null;
    var t = id ? findTask(id) : null;
    modalTitle.textContent = t ? 'Task detail' : 'New task';
    deleteBtn.style.display = t ? 'inline-flex' : 'none';

    var defaultPlan = state.store !== 'all'
      ? (DATA.plans.filter(function (p) { return p.storeId === state.store; })[0] || DATA.plans[0])
      : DATA.plans[0];
    var planId = t ? t.planId : (defaultPlan && defaultPlan.id);

    fPlan.innerHTML = planOptionsHTML(planId);
    fTitle.value = t ? t.title : '';
    fDesc.value = t ? (t.description || '') : '';
    fOwner.value = t ? (t.ownerName || '') : '';
    fRole.value = t ? (t.ownerRole || '') : '';
    fStatus.value = t ? t.column : 'identified';
    fPriority.value = t ? t.priority : 'medium';
    fDue.value = t ? (t.dueDate || '') : '';
    fRisk.value = t ? (t.risk || '') : '';
    fBlocked.value = t ? (t.blockedReason || '') : '';
    fMetric.value = t && t.verificationSignal ? (t.verificationSignal.metric || '') : '';
    fLag.value = t && t.verificationSignal && t.verificationSignal.lagDays != null ? t.verificationSignal.lagDays : '';

    renderContext(planId, t);
    overlay.classList.add('open');
    setTimeout(function () { fTitle.focus(); }, 30);
  }
  function closeModal() { overlay.classList.remove('open'); editingId = null; }

  function renderContext(planId, t) {
    var p = PLAN_BY_ID[planId];
    if (!p) { ctxWrap.innerHTML = ''; logWrap.innerHTML = ''; return; }
    var s = STORE_BY_ID[p.storeId], r = ROOT_BY_KEY[p.rootCauseCategory];
    var parent = p.parentPlanId ? PLAN_BY_ID[p.parentPlanId] : null;
    var parentRoot = parent ? ROOT_BY_KEY[parent.rootCauseCategory] : null;

    var rows = '';
    rows += ctxRow('Store', esc(s ? s.name : '') + (s ? ' <span class="ctx-sub">' + esc(s.cbsa) + '</span>' : ''));
    rows += ctxRow('Root cause', catChip(r));
    if (p.carrier) rows += ctxRow('Carrier', esc(p.carrier));
    rows += ctxRow('Owning persona', esc(p.owningPersona));
    rows += ctxRow('Opened', fmtDateY(p.openedDate) + ' · <span class="ctx-sub">target ' + fmtDateY(p.targetCloseDate) + '</span>');
    if (parent) rows += ctxRow('Linked', '<span class="link-chip chip">↳ Downstream of ' + esc(parentRoot ? parentRoot.label : '') + ' · ' + esc(parent.id) + '</span>');
    if (CHILD_COUNT[p.id]) rows += ctxRow('Linked', '<span class="link-chip chip up">▲ Upstream cause of ' + CHILD_COUNT[p.id] + ' plan' + (CHILD_COUNT[p.id] === 1 ? '' : 's') + '</span>');

    ctxWrap.innerHTML =
      '<div class="ctx-head">Action plan <span class="ctx-id">' + esc(p.id) + '</span></div>' +
      '<div class="ctx-diag">' + esc(p.diagnosis) + '</div>' +
      '<div class="ctx-grid">' + rows + '</div>';

    var log = (t && t.activityLog) ? t.activityLog : [];
    logWrap.innerHTML =
      '<div class="ctx-head">Activity log</div>' +
      (log.length
        ? '<ol class="tl">' + log.map(function (e) {
            return '<li class="tl-item"><span class="tl-date">' + esc(fmtDate(e.date)) + '</span><span class="tl-note">' + esc(e.note) + '</span></li>';
          }).join('') + '</ol>'
        : '<div class="ctx-sub">No activity recorded yet.</div>') +
      '<div class="note-add">' +
        '<input id="noteInput" type="text" placeholder="Add an activity note…" maxlength="180" />' +
        '<button type="button" class="btn btn-ghost" id="addNoteBtn">Add</button>' +
      '</div>';
    noteInput = document.getElementById('noteInput');
    document.getElementById('addNoteBtn').addEventListener('click', addNote);
    noteInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addNote(); } });
  }

  function addNote() {
    if (!editingId) { toast('Save the task first, then add notes'); return; }
    var t = findTask(editingId); if (!t) return;
    var v = (noteInput.value || '').trim(); if (!v) return;
    if (!t.activityLog) t.activityLog = [];
    t.activityLog.push({ date: DATA.referenceDate, note: v });
    renderContext(t.planId, t);
  }

  function submitForm(e) {
    e.preventDefault();
    var title = fTitle.value.trim();
    if (!title) { fTitle.closest('.form-row').classList.add('invalid'); fTitle.focus(); return; }
    var metric = fMetric.value.trim();
    var lag = fLag.value.trim();
    var vs = metric ? { metric: metric, lagDays: lag ? parseInt(lag, 10) : null } : null;
    var data = {
      planId: fPlan.value,
      storeId: (PLAN_BY_ID[fPlan.value] || {}).storeId,
      title: title,
      description: fDesc.value.trim(),
      ownerName: fOwner.value.trim(),
      ownerRole: fRole.value.trim(),
      column: fStatus.value,
      priority: fPriority.value,
      dueDate: fDue.value || '',
      risk: fRisk.value.trim(),
      blockedReason: fBlocked.value.trim(),
      verificationSignal: vs
    };
    if (editingId) {
      var t = findTask(editingId);
      if (t) { for (var k in data) t[k] = data[k]; }
      toast('Task updated');
    } else {
      data.id = uid();
      data.createdDate = DATA.referenceDate;
      data.activityLog = [];
      tasks.push(data);
      toast('Task added');
    }
    refreshOwnerFilter();
    render();
    closeModal();
  }
  function deleteCurrent() {
    if (!editingId) return;
    tasks = tasks.filter(function (t) { return t.id !== editingId; });
    refreshOwnerFilter(); render(); closeModal(); toast('Task deleted');
  }

  /* ---------------- toast ---------------- */
  var toastEl, toastTimer;
  function toast(m) { toastEl.textContent = m; toastEl.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1900); }

  /* ---------------- store selector (nav) ---------------- */
  function buildStoreMenu() {
    var menu = document.getElementById('storeMenu');
    var counts = {};
    (DATA.plans || []).forEach(function (p) { counts[p.storeId] = (counts[p.storeId] || 0) + 1; });
    var items;
    if (state.role === 'regional') {
      var region = currentRegion();
      var regionOpen = region.markets.reduce(function (a, nm) { return a + marketPlanActivity(nm).open; }, 0);
      items = [{ id: 'region', name: 'All my markets', count: regionOpen, sub: region.markets.length + ' markets' }]
        .concat(region.markets.map(function (nm) { return { id: 'mkt::' + nm, name: nm, count: marketPlanActivity(nm).open }; }));
    } else if (state.role === 'market') {
      var bookPlans = (DATA.plans || []).filter(function (p) { return MARKET.storeIds.indexOf(p.storeId) >= 0; }).length;
      items = [{ id: 'book', name: 'All my shops', count: bookPlans, sub: MARKET.storeIds.length + ' shops' }]
        .concat(MARKET.storeIds.map(function (id) { var s = STORE_BY_ID[id]; return { id: id, name: s ? s.name : id, count: counts[id] || 0 }; }));
    } else {
      items = (DATA.stores || []).map(function (s) { return { id: s.id, name: s.name, count: counts[s.id] || 0 }; });
    }
    menu.innerHTML = items.map(function (it) {
      return '<button type="button" role="option" class="store-item' + (it.id === state.store ? ' active' : '') + '" data-store="' + esc(it.id) + '">' +
        '<span class="store-name">' + esc(it.name) + (it.sub ? ' <span class="store-sub">' + esc(it.sub) + '</span>' : '') + '</span><span class="store-count">' + it.count + '</span></button>';
    }).join('');
  }
  function setStore(id) {
    state.store = id;
    var label = id === 'book' ? MARKET.name + ' · all shops'
      : id === 'region' ? currentRegion().name + ' · all markets'
      : isMarketScope(id) ? id.slice(5)
      : id === 'all' ? 'All stores'
      : (STORE_BY_ID[id] ? STORE_BY_ID[id].name : id);
    document.getElementById('shopName').textContent = label;
    buildStoreMenu();
    render();
    if (state.view === 'kpis') renderKpiTab(id);
  }

  /* ---------------- filters ---------------- */
  function refreshOwnerFilter() {
    var sel = document.getElementById('ownerFilter');
    var cur = sel.value;
    var names = {};
    tasks.forEach(function (t) { if (t.ownerName) names[t.ownerName] = 1; });
    var list = Object.keys(names).sort();
    sel.innerHTML = '<option value="all">All owners</option>' + list.map(function (n) { return '<option value="' + esc(n) + '">' + esc(n) + '</option>'; }).join('');
    sel.value = (cur && (cur === 'all' || names[cur])) ? cur : 'all';
    state.owner = sel.value;
  }
  function populate(sel, opts, allLabel) {
    sel.innerHTML = '<option value="all">' + esc(allLabel) + '</option>' +
      opts.map(function (o) { return '<option value="' + esc(o.key) + '">' + esc(o.label) + '</option>'; }).join('');
  }

  /* ---------------- KPI dashboard (KPIs tab) ---------------- */
  var KPI_FUNNEL = (DATA.kpiMetrics || []).filter(function (m) { return m.group === 'funnel'; });
  var KPIS_BY_STORE = DATA.kpisByStore || {};
  var PACING_BY_STORE = DATA.pacingByStore || {};
  var MTD = DATA.mtd || { day: 10, daysInMonth: 31 };

  /* ---- Regions (Regional Manager scope) + deterministic per-market KPIs ----
     Markets in the region list have no stores in this prototype, so their
     funnel / pacing / plan activity are generated deterministically from the
     market name (same seeded approach as the sparklines). */
  var REGIONS = DATA.regions || [];
  var REGION_BY_ID = {}; REGIONS.forEach(function (r) { REGION_BY_ID[r.id] = r; });
  function currentRegion() { return REGION_BY_ID[DATA.defaultRegionId] || REGIONS[0] || { id: 'rg', name: 'Region', manager: '', markets: [] }; }
  function mrng(name, salt) { return mulberry(hashStr('mkt:' + name + ':' + salt)); }
  function marketFunnelObj(name) { var r = mrng(name, 'fun'); return { estimate: 78 + r() * 11, ro: 61 + r() * 15, arrive: 5.8 + r() * 2.2 }; }
  function marketPacingObj(name) { var r = mrng(name, 'pac'); return { budget: 3800000 + Math.floor(r() * 4600000), closedPace: 0.80 + r() * 0.30, forecastFactor: 0.88 + r() * 0.20 }; }
  function marketPlanActivity(name) {
    var r = mrng(name, 'plan');
    var open = 1 + Math.floor(r() * 7);
    var blocked = Math.floor(r() * Math.min(3, open));
    var inprog = Math.min(open - blocked, Math.floor(r() * (open + 1)));
    var atRisk = Math.floor(r() * 4);
    return { open: open, blocked: blocked, inprog: Math.max(0, inprog), atRisk: atRisk };
  }
  function regionFunnelAvg(region) {
    var ids = region.markets, n = ids.length || 1, acc = {};
    ids.forEach(function (nm) { var f = marketFunnelObj(nm); KPI_FUNNEL.forEach(function (m) { acc[m.key] = (acc[m.key] || 0) + f[m.key]; }); });
    var out = {}; KPI_FUNNEL.forEach(function (m) { out[m.key] = acc[m.key] / n; });
    return out;
  }

  function kpiFunnelValuesFor(storeId) {
    if (isMarketScope(storeId)) return marketFunnelObj(storeId.slice(5));
    if (storeId === 'region') return regionFunnelAvg(currentRegion());
    var ids = resolveIds(storeId).filter(function (id) { return KPIS_BY_STORE[id]; });
    if (ids.length === 1) return KPIS_BY_STORE[ids[0]];
    var acc = {}, n = ids.length;
    ids.forEach(function (id) { KPI_FUNNEL.forEach(function (m) { acc[m.key] = (acc[m.key] || 0) + KPIS_BY_STORE[id][m.key]; }); });
    var out = {}; KPI_FUNNEL.forEach(function (m) { out[m.key] = n ? acc[m.key] / n : 0; });
    return out;
  }

  function trimNum(x) { return String(parseFloat(x.toFixed(2))); }
  function fmtVal(v, unit) {
    if (unit === '%') return Math.round(v) + '%';
    if (unit === 'days') { var s = parseFloat(v.toFixed(2)); return trimNum(s) + ' ' + (s === 1 ? 'day' : 'days'); }
    return String(Math.round(v));
  }
  function deltaMag(unit, g) {
    if (unit === '%') return Math.round(g) + '%';
    if (unit === 'days') { var s = parseFloat(g.toFixed(1)); return trimNum(s) + ' ' + (s < 2 ? 'day' : 'days'); }
    return String(Math.round(g));
  }
  function kpiDelta(m, v) {
    var gap = Math.abs(v - m.goal);
    var ahead = m.dir === 'higher' ? v >= m.goal : v <= m.goal;
    var zero = m.unit === 'days' ? parseFloat(gap.toFixed(1)) === 0 : Math.round(gap) === 0;
    return { ahead: ahead, gap: gap, zero: zero, mag: deltaMag(m.unit, gap) };
  }
  function infoIcon(text) {
    return '<span class="kpi-info" tabindex="0" role="img" aria-label="' + esc(text) + '" title="' + esc(text) + '">' +
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8"/></svg></span>';
  }
  function arrowUp() { return '<svg class="mcb-arrow" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m4 12 1.41 1.41L11 7.83V20h2V7.83l5.58 5.59L20 12l-8-8z"/></svg>'; }
  function arrowDown() { return '<svg class="mcb-arrow" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m20 12-1.41-1.41L13 16.17V4h-2v12.17l-5.58-5.59L4 12l8 8z"/></svg>'; }

  function funnelBoxHTML(m, v) {
    var d = kpiDelta(m, v), cls = d.ahead ? 'ahead' : 'behind';
    return '<div class="mcb" data-name="' + esc(m.label) + '">' +
      '<div class="mcb-label"><span>' + esc(m.label) + '</span>' + infoIcon(m.info) + '</div>' +
      '<div class="mcb-boxes">' +
        '<div class="mcb-box actual"><b>' + esc(fmtVal(v, m.unit)) + '</b><span>Actual</span></div>' +
        '<div class="mcb-box goal ' + cls + '"><b>' + esc(fmtVal(m.goal, m.unit)) + '</b><span>Monthly Goal</span></div>' +
      '</div>' +
      '<div class="mcb-msg ' + (d.zero ? 'ahead' : cls) + '">' + ((d.ahead || d.zero) ? arrowUp() : arrowDown()) +
        '<span>' + esc(d.zero ? 'On goal' : (d.mag + (d.ahead ? ' above goal' : ' below goal'))) + '</span></div>' +
    '</div>';
  }

  /* ---- sales-forecast pacing tiles ---- */
  function hashStr(s) { var h = 2166136261 >>> 0; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function money(v) { var a = Math.abs(v); var s = a >= 1000000 ? '$' + (a / 1000000).toFixed(a >= 10000000 ? 0 : 1) + 'M' : '$' + Math.round(a / 1000) + 'K'; return (v < 0 ? '−' : '') + s; }
  function moneySigned(v) { return (v > 0 ? '+' : v < 0 ? '−' : '') + money(Math.abs(v)); }

  /* ---- Weekly forecast: a four-week window running forward from a selectable beginning week ---- */
  function addDaysD(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  function weekStartMonday(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); return addDaysD(x, -((x.getDay() + 6) % 7)); }
  function mdShort(d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
  var PAST_WEEKS = 12, FUTURE_WEEKS = 3;   // selector history back + forecast weeks forward
  var CUR_WEEK_KEY = iso(weekStartMonday(TODAY));
  var weeklyState = { asOfKey: null };     // beginning week (ISO Monday); null → current week
  function weekSeries(storeId, weeklyTarget) {
    var cur = weekStartMonday(TODAY), out = [];
    for (var i = -PAST_WEEKS; i <= FUTURE_WEEKS; i++) {
      var start = addDaysD(cur, 7 * i), key = iso(start);
      var wr = mulberry(hashStr(storeId + ':wk:' + key));
      var f = weeklyTarget * (0.86 + wr() * 0.26);
      out.push({ start: start, key: key, label: 'Wk of ' + mdShort(start), forecast: f, target: weeklyTarget, variance: f - weeklyTarget });
    }
    return out; // chronological ascending; series[PAST_WEEKS] = current week
  }

  function avgPacingOver(ids) {
    ids = ids.filter(function (id) { return PACING_BY_STORE[id]; });
    var n = ids.length || 1, b = 0, cp = 0, ff = 0;
    ids.forEach(function (id) { b += PACING_BY_STORE[id].budget; cp += PACING_BY_STORE[id].closedPace; ff += PACING_BY_STORE[id].forecastFactor; });
    return { budget: b / n, closedPace: cp / n, forecastFactor: ff / n };
  }
  function pacingFromBase(base, seedKey) {
    var frac = MTD.day / MTD.daysInMonth;
    var budget = base.budget;
    var mtdTarget = budget * frac;
    var closedMTD = mtdTarget * base.closedPace;
    var forecast = budget * base.forecastFactor;
    var fillTarget = budget * 0.985;
    var closedVariance = closedMTD - mtdTarget;
    var pctClosedToBudget = closedMTD / budget * 100;
    var pacePct = frac * 100;
    var daysBehind = (mtdTarget - closedMTD) / (budget / 22);
    var dr = mulberry(hashStr(seedKey + ':dnc'));
    var dncCount = 3 + Math.floor(dr() * 6);
    var dncValue = dncCount * (12000 + dr() * 9000);
    var weeklyTarget = budget / (MTD.daysInMonth / 7);
    var weeks = weekSeries(seedKey, weeklyTarget);
    return { budget: budget, mtdTarget: mtdTarget, closedMTD: closedMTD, forecast: forecast, fillTarget: fillTarget,
      closedVariance: closedVariance, pctClosedToBudget: pctClosedToBudget, pacePct: pacePct, daysBehind: daysBehind,
      monthlyClosed: budget * base.closedPace, dncCount: dncCount, dncValue: dncValue, weeks: weeks };
  }
  function computeMarketPacing(name) { return pacingFromBase(marketPacingObj(name), 'mkt::' + name); }
  function computeRegionPacing(region) {
    var ids = region.markets, n = ids.length || 1, b = 0, cp = 0, ff = 0;
    ids.forEach(function (nm) { var mp = marketPacingObj(nm); b += mp.budget; cp += mp.closedPace; ff += mp.forecastFactor; });
    return pacingFromBase({ budget: b, closedPace: cp / n, forecastFactor: ff / n }, 'region:' + region.id);
  }
  function computePacing(storeId) {
    if (isMarketScope(storeId)) return computeMarketPacing(storeId.slice(5));
    if (storeId === 'region') return computeRegionPacing(currentRegion());
    var ids = resolveIds(storeId);
    var base = (ids.length === 1 && PACING_BY_STORE[ids[0]]) ? PACING_BY_STORE[ids[0]] : avgPacingOver(ids);
    return pacingFromBase(base, storeId);
  }
  function statusOf(actual, target) {
    var r = actual / target;
    if (r >= 1.01) return { word: 'Ahead', cls: 'good' };
    if (r >= 0.99) return { word: 'On Track', cls: 'good' };
    if (r >= 0.95) return { word: 'Behind', cls: 'warn' };
    return { word: 'Behind', cls: 'serious' };
  }

  function tileStatus(label, info, forecast, target, targetLabel) {
    var st = statusOf(forecast, target);
    return '<div class="kpi-tile"><div class="kpi-name">' + esc(label) + infoIcon(info) + '</div>' +
      '<div class="kpi-status ' + st.cls + '">' + esc(st.word) + '</div>' +
      '<div class="kpi-subline">Forecast <b>' + esc(money(forecast)) + '</b> vs ' + esc(targetLabel) + ' ' + esc(money(target)) + '</div></div>';
  }
  function tileMoney(label, info, value, sub, muted) {
    return '<div class="kpi-tile"><div class="kpi-name">' + esc(label) + infoIcon(info) + '</div>' +
      '<div class="kpi-value' + (muted ? ' muted' : '') + '">' + esc(money(value)) + '</div>' +
      '<div class="kpi-subline">' + esc(sub) + '</div></div>';
  }
  function tileVariance(label, info, value, sub) {
    var pos = value >= 0, cls = pos ? 'good' : (Math.abs(value) >= 20000 ? 'serious' : 'warn');
    return '<div class="kpi-tile"><div class="kpi-name">' + esc(label) + infoIcon(info) + '</div>' +
      '<div class="kpi-value ' + (pos ? 'pos' : 'neg') + '">' + esc(moneySigned(value)) + '</div>' +
      '<div class="kpi-subline">' + esc(sub) + '</div>' +
      '<span class="delta-chip ' + cls + '"><span class="arw" aria-hidden="true">' + (pos ? '▲' : '▼') + '</span>' + (pos ? 'ahead of target' : 'behind target') + '</span></div>';
  }
  function tileDays(label, info, days) {
    var behind = days > 0.05, ahead = days < -0.05;
    var cls = ahead ? 'good' : (days > 1.5 ? 'serious' : behind ? 'warn' : 'good');
    var word = behind ? 'behind' : ahead ? 'ahead' : 'on pace';
    return '<div class="kpi-tile"><div class="kpi-name">' + esc(label) + infoIcon(info) + '</div>' +
      '<div class="kpi-main"><div class="kpi-value">' + esc(Math.abs(days).toFixed(1)) + ' <span class="kpi-unit">days</span></div>' +
      '<span class="delta-chip ' + cls + '"><span class="arw" aria-hidden="true">' + (ahead ? '▲' : behind ? '▼' : '✓') + '</span>' + esc(word) + '</span></div>' +
      '<div class="kpi-subline">Against straight-line pace</div></div>';
  }
  function tileMeter(label, info, pct, pacePct) {
    var ahead = pct >= pacePct, cls = ahead ? 'good' : (pacePct - pct > 6 ? 'serious' : 'warn');
    var p = Math.max(0, Math.min(100, pct)), mk = Math.max(0, Math.min(100, pacePct));
    return '<div class="kpi-tile"><div class="kpi-name">' + esc(label) + infoIcon(info) + '</div>' +
      '<div class="kpi-main"><div class="kpi-value">' + Math.round(pct) + '%</div>' +
      '<span class="delta-chip ' + cls + '"><span class="arw" aria-hidden="true">' + (ahead ? '▲' : '▼') + '</span>' + (ahead ? 'ahead of pace' : 'behind pace') + '</span></div>' +
      '<div class="meter" role="img" aria-label="' + Math.round(pct) + '% closed versus ' + Math.round(pacePct) + '% straight-line pace"><div class="meter-fill" style="width:' + p.toFixed(1) + '%"></div><div class="meter-mark" style="left:' + mk.toFixed(1) + '%"></div></div>' +
      '<div class="kpi-subline">' + Math.round(pct) + '% closed &middot; ' + Math.round(pacePct) + '% straight-line pace</div></div>';
  }
  function tileDNC(label, info, count, value) {
    return '<div class="kpi-tile"><div class="kpi-name">' + esc(label) + infoIcon(info) + '</div>' +
      '<div class="kpi-main"><div class="kpi-value">' + count + ' <span class="kpi-unit">files</span></div>' +
      '<span class="delta-chip warn"><span class="arw" aria-hidden="true">●</span>open</span></div>' +
      '<div class="kpi-subline">' + esc(money(value)) + ' delivered, not yet closed</div></div>';
  }
  function weeklyWindow(series) {
    var last = series.length - 4;               // last beginning index that still has four weeks forward
    var sel = -1;
    if (weeklyState.asOfKey) {
      for (var i = 0; i < series.length; i++) { if (series[i].key === weeklyState.asOfKey) { sel = i; break; } }
    }
    if (sel < 0) { for (var j = 0; j < series.length; j++) { if (series[j].key === CUR_WEEK_KEY) { sel = j; break; } } }
    if (sel < 0) sel = last;
    sel = Math.max(0, Math.min(sel, last));
    return { sel: sel, win: series.slice(sel, sel + 4) };
  }
  function weeklyInnerHTML(series) {
    var w = weeklyWindow(series), win = w.win, last = series.length - 4;
    var opts = '';
    for (var i = last; i >= 0; i--) {           // selectable beginning weeks, most recent first
      opts += '<option value="' + esc(series[i].key) + '"' + (i === w.sel ? ' selected' : '') + '>' +
        esc(mdShort(series[i].start)) + (series[i].key === CUR_WEEK_KEY ? ' · current' : '') + '</option>';
    }
    var rows = win.map(function (wk, idx) {
      var pos = wk.variance >= 0, isSel = idx === 0;
      return '<tr' + (isSel ? ' class="wk-sel"' : '') + '><td>' + esc(wk.label) +
        (isSel ? ' <span class="wk-badge">begins</span>' : '') + '</td>' +
        '<td class="num">' + esc(money(wk.forecast)) + '</td><td class="num">' + esc(money(wk.target)) + '</td>' +
        '<td class="num var ' + (pos ? 'pos' : 'neg') + '">' + esc(moneySigned(wk.variance)) + '</td></tr>';
    }).join('');
    var spanEnd = addDaysD(win[win.length - 1].start, 6);
    var span = mdShort(win[0].start) + ' – ' + spanEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return '<div class="wk-head"><label class="wk-pick">Week beginning ' +
      '<span class="wk-select"><select id="wkSelect" aria-label="Beginning week for the four-week forecast">' + opts + '</select></span></label>' +
      '<span class="wk-caption">Four weeks · ' + esc(span) + '</span></div>' +
      '<table class="wk-table"><thead><tr><th>Week</th><th class="num">Forecast</th><th class="num">Target</th><th class="num">Variance</th></tr></thead><tbody>' + rows + '</tbody></table>';
  }
  function tileWeekly(label, info, series) {
    return '<div class="kpi-tile kpi-tile-wide"><div class="kpi-name">' + esc(label) + infoIcon(info) + '</div>' +
      '<div id="wkInner">' + weeklyInnerHTML(series) + '</div></div>';
  }
  function wireWeekly(storeId) {
    var inner = document.getElementById('wkInner');
    if (!inner) return;
    inner.addEventListener('change', function (e) {
      if (!e.target || e.target.id !== 'wkSelect') return;
      weeklyState.asOfKey = e.target.value;
      inner.innerHTML = weeklyInnerHTML(computePacing(storeId).weeks);
    });
  }

  function possessive(name) { return name.charAt(name.length - 1).toLowerCase() === 's' ? name + "'" : name + "'s"; }
  function shortStore(name) { return name.replace(/,\s*[A-Z]{2}$/, ''); }

  function renderKpis(storeId) {
    var root = document.getElementById('kpiRoot');
    if (!root) return;
    var fvals = kpiFunnelValuesFor(storeId);
    var p = computePacing(storeId);
    var isMkt = isMarketScope(storeId);
    var name = isMkt ? storeId.slice(5) : (storeId === 'all' ? 'All stores' : (STORE_BY_ID[storeId] ? shortStore(STORE_BY_ID[storeId].name) : 'All stores'));
    var title = isMkt ? name + ' — Market KPIs' : possessive(name) + ' KPIs';
    var html = '';
    html += '<div class="kpi-head"><p class="kpi-title" data-testid="kpi-page-title">' + esc(title) + '</p>' +
      '<p class="kpi-sub" data-testid="kpi-page-subtitle">80/70/7</p></div>';
    html += '<div class="kpi-funnel" data-testid="capture-rate-metrics">' +
      KPI_FUNNEL.map(function (m) { return funnelBoxHTML(m, fvals[m.key]); }).join('') + '</div>';

    html += '<div class="kpi-section"><div class="kpi-section-title">Sales forecast</div><div class="kpi-tiles">' +
      tileStatus('Funnel Status', 'Status for the current sales forecast versus the Fill the Funnel target', p.forecast, p.fillTarget, 'Fill the Funnel') +
      tileStatus('Budget Funnel Status', 'Status for the current sales forecast versus budget', p.forecast, p.budget, 'Budget') +
      tileMeter('% Closed to Budget', 'Total closed and delivered against budget', p.pctClosedToBudget, p.pacePct) +
      tileDays('Days Behind', 'How many days of work the shop is ahead or behind', p.daysBehind) +
      '</div></div>';

    html += '<div class="kpi-section"><div class="kpi-section-title">Closed sales — month to date</div><div class="kpi-tiles">' +
      tileMoney('Closed Sales MTD', 'Actual sales delivered and closed for the current month', p.closedMTD, 'Delivered & closed, MTD', false) +
      tileMoney('MTD Closed Sales Target', 'Straight-line sales target for today', p.mtdTarget, 'Straight-line target for today', true) +
      tileVariance('Closed Sales MTD Variance', 'Closed Sales MTD actuals minus MTD closed sales target', p.closedVariance, 'Actual − target') +
      tileDNC('DNC (Delivered Not Closed)', 'Vehicle has been delivered, but the file(s) has not been closed', p.dncCount, p.dncValue) +
      '</div></div>';

    html += '<div class="kpi-section"><div class="kpi-section-title">Weekly forecast</div><div class="kpi-tiles">' +
      tileWeekly('Weekly forecast & variance', 'Weekly forecast vs target for the four weeks beginning the selected week — pick any week to shift the window', p.weeks) +
      '</div></div>';

    html += trendsSectionHTML();
    root.innerHTML = html;
    drawTrends(storeId);
    wireTrends(storeId);
    wireWeekly(storeId);
  }

  /* ---- KPI trends chart: focus up to two metrics over a period ---- */
  var TREND_COLORS = ['#0072b2', '#e69f00', '#009e73', '#cc79a7', '#56b4e9'];
  var TREND_METRICS = [
    { key: 'estimate',  label: 'Opportunity to Estimate', short: 'Estimate', unit: '%',    dir: 'higher', goal: function () { return 80; } },
    { key: 'ro',        label: 'Opportunity to RO',       short: 'RO',       unit: '%',    dir: 'higher', goal: function () { return 70; } },
    { key: 'arrive',    label: 'Opportunity to Arrive',   short: 'Arrive',   unit: 'days', dir: 'lower',  goal: function () { return 7; } },
    { key: 'closed',    label: 'Closed Sales (monthly)',  short: 'Closed',   unit: '$',    dir: 'higher', goal: function (p) { return p.budget; } },
    { key: 'pctBudget', label: '% Closed to Budget',      short: '% Budget', unit: '%',    dir: 'higher', goal: function () { return 100; } }
  ];
  TREND_METRICS.forEach(function (m, i) { m.color = TREND_COLORS[i]; });
  var TREND_PERIODS = [6, 12, 24];
  var TREND_TOTAL = 24;
  var TREND_MAX = 2;
  var trendState = { metrics: ['ro', 'closed'], period: 12 };
  var MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function trendMonths() {
    var out = [], ay = 2026, am = 7; // anchor: Aug 2026 (the dataset month)
    for (var k = TREND_TOTAL - 1; k >= 0; k--) {
      var idx = am - k, y = ay;
      while (idx < 0) { idx += 12; y -= 1; }
      out.push({ label: MONTH_ABBR[idx] + (idx === 0 ? " '" + String(y).slice(2) : '') });
    }
    return out;
  }
  function metricLatest(m, fvals, p) {
    if (m.key === 'estimate') return fvals.estimate;
    if (m.key === 'ro') return fvals.ro;
    if (m.key === 'arrive') return fvals.arrive;
    if (m.key === 'closed') return p.monthlyClosed;
    if (m.key === 'pctBudget') return p.monthlyClosed / p.budget * 100;
    return 0;
  }
  function seriesFull(m, storeId, latest) {
    var amp = m.unit === 'days' ? 0.7 : m.unit === '%' ? 3.2 : m.unit === '$' ? Math.max(latest * 0.05, 12000) : latest * 0.05;
    var drift = 1.1 * amp * (m.dir === 'higher' ? -1 : 1);
    var rnd = mulberry(hashStr(storeId + ':' + m.key + ':trend'));
    var a = [];
    for (var i = 0; i < TREND_TOTAL; i++) { var t = i / (TREND_TOTAL - 1); a.push(latest + drift * (1 - t) + (rnd() - 0.5) * amp); }
    a[TREND_TOTAL - 1] = latest;
    return a;
  }
  function fmtMetric(m, v) {
    if (m.unit === '$') return money(v);
    if (m.unit === '%') return Math.round(v) + '%';
    if (m.unit === 'days') return parseFloat(v.toFixed(1)) + ' days';
    return String(Math.round(v));
  }
  function fmtAxis(m, v) {
    if (m.unit === '$') return money(v);
    if (m.unit === '%') return Math.round(v) + '%';
    if (m.unit === 'days') return String(parseFloat(v.toFixed(1)));
    return String(Math.round(v));
  }
  function rangeOf(vals) {
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (hi === lo) hi = lo + 1;
    var s = hi - lo;
    return { lo: lo - s * 0.12, hi: hi + s * 0.12 };
  }
  function unitWord(u) { return u === '$' ? 'dollars' : u === 'days' ? 'days' : 'percent'; }

  function trendsSectionHTML() {
    var chips = TREND_METRICS.map(function (m) {
      var on = trendState.metrics.indexOf(m.key) >= 0;
      return '<button type="button" class="trend-chip' + (on ? ' on' : '') + '" data-metric="' + m.key + '" aria-pressed="' + on + '">' +
        '<span class="sw" style="background:' + m.color + '"></span>' + esc(m.label) + '</button>';
    }).join('');
    var periods = TREND_PERIODS.map(function (n) {
      return '<button type="button" class="trend-per' + (trendState.period === n ? ' on' : '') + '" data-period="' + n + '" aria-pressed="' + (trendState.period === n) + '">' + n + 'M</button>';
    }).join('');
    return '<div class="kpi-section trends"><div class="trend-head">' +
      '<div class="kpi-section-title">Trends over time</div>' +
      '<div class="trend-period-group" id="trendPeriod" role="group" aria-label="Time range">' + periods + '</div></div>' +
      '<div class="trend-metrics" id="trendMetrics" role="group" aria-label="Metrics to plot">' + chips + '</div>' +
      '<div class="trend-hint">Compare up to two metrics. Different units use a left and a right axis.</div>' +
      '<div class="trend-mode" id="trendMode"></div>' +
      '<div class="trend-plot" id="trendPlot"></div>' +
      '<div class="trend-legend" id="trendLegend"></div>' +
      '<div class="visually-hidden" id="trendTable"></div></div>';
  }

  function drawTrends(storeId) {
    var plot = document.getElementById('trendPlot'); if (!plot) return;
    var fvals = kpiFunnelValuesFor(storeId), p = computePacing(storeId);
    var months = trendMonths(), start = TREND_TOTAL - trendState.period, n = trendState.period;
    var sel = TREND_METRICS.filter(function (m) { return trendState.metrics.indexOf(m.key) >= 0; });
    if (!sel.length) sel = [TREND_METRICS[0]];
    var mode = sel.length === 1 ? 'single' : (sel[0].unit === sel[1].unit ? 'shared' : 'dual');

    var series = sel.map(function (m) {
      return { m: m, raw: seriesFull(m, storeId, metricLatest(m, fvals, p)).slice(start), latest: metricLatest(m, fvals, p), goal: m.goal(p) };
    });

    var W = Math.max(plot.clientWidth || 760, 320), H = 320, mT = 14, mB = 34;
    var mL = 58, mR = mode === 'dual' ? 72 : 62, iw = W - mL - mR, ih = H - mT - mB;
    function X(i) { return mL + (n <= 1 ? iw / 2 : iw * i / (n - 1)); }

    var rA, rB, YA, YB, R, Y;
    if (mode === 'dual') {
      rA = rangeOf(series[0].raw.concat([series[0].goal]));
      rB = rangeOf(series[1].raw.concat([series[1].goal]));
      YA = function (v) { return mT + ih * (1 - (v - rA.lo) / (rA.hi - rA.lo)); };
      YB = function (v) { return mT + ih * (1 - (v - rB.lo) / (rB.hi - rB.lo)); };
    } else {
      var allv = [];
      series.forEach(function (s) { allv = allv.concat(s.raw, [s.goal]); });
      R = rangeOf(allv);
      Y = function (v) { return mT + ih * (1 - (v - R.lo) / (R.hi - R.lo)); };
    }
    function Yof(si, v) { return mode === 'dual' ? (si === 0 ? YA(v) : YB(v)) : Y(v); }

    // gridlines + y axis labels
    var grid = '', ylab = '', ticks = 4;
    for (var t = 0; t <= ticks; t++) {
      var gy = mT + ih * (1 - t / ticks);
      grid += '<line class="tg" x1="' + mL + '" x2="' + (W - mR) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '"/>';
      if (mode === 'dual') {
        var la = fmtAxis(series[0].m, rA.lo + (rA.hi - rA.lo) * t / ticks);
        var lb = fmtAxis(series[1].m, rB.lo + (rB.hi - rB.lo) * t / ticks);
        ylab += '<text class="ax" x="' + (mL - 8) + '" y="' + (gy + 3).toFixed(1) + '" text-anchor="end" fill="' + series[0].m.color + '">' + esc(la) + '</text>';
        ylab += '<text class="ax" x="' + (W - mR + 8) + '" y="' + (gy + 3).toFixed(1) + '" text-anchor="start" fill="' + series[1].m.color + '">' + esc(lb) + '</text>';
      } else {
        var lv = fmtAxis(series[0].m, R.lo + (R.hi - R.lo) * t / ticks);
        ylab += '<text class="ax" x="' + (mL - 8) + '" y="' + (gy + 3).toFixed(1) + '" text-anchor="end">' + esc(lv) + '</text>';
      }
    }
    // x axis labels
    var xlab = '', step = Math.ceil(n / 6);
    for (var i = 0; i < n; i++) { if (i % step === 0 || i === n - 1) { xlab += '<text class="ax" x="' + X(i).toFixed(1) + '" y="' + (H - 12) + '" text-anchor="middle">' + esc(months[start + i].label) + '</text>'; } }

    // goal reference
    var goalM = '';
    if (mode === 'single') {
      var gyy = Y(series[0].goal);
      goalM = '<line class="ref" x1="' + mL + '" x2="' + (W - mR) + '" y1="' + gyy.toFixed(1) + '" y2="' + gyy.toFixed(1) + '"/>' +
        '<text class="ref-lab" x="' + (W - mR + 4) + '" y="' + (gyy + 3).toFixed(1) + '">Goal</text>';
    } else if (mode === 'shared') {
      series.forEach(function (s) {
        var gy2 = Y(s.goal);
        goalM += '<line class="ref" x1="' + mL + '" x2="' + (W - mR) + '" y1="' + gy2.toFixed(1) + '" y2="' + gy2.toFixed(1) + '" stroke="' + s.m.color + '" opacity="0.55"/>';
      });
    } else {
      goalM += '<line class="ref" x1="' + mL + '" x2="' + (mL + 12) + '" y1="' + YA(series[0].goal).toFixed(1) + '" y2="' + YA(series[0].goal).toFixed(1) + '" stroke="' + series[0].m.color + '"/>';
      goalM += '<line class="ref" x1="' + (W - mR - 12) + '" x2="' + (W - mR) + '" y1="' + YB(series[1].goal).toFixed(1) + '" y2="' + YB(series[1].goal).toFixed(1) + '" stroke="' + series[1].m.color + '"/>';
    }

    // lines + endpoints + (single/shared) end labels
    var paths = '', ends = '';
    series.forEach(function (s, si) {
      var d = s.raw.map(function (v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Yof(si, v).toFixed(1); }).join(' ');
      paths += '<path class="ln" d="' + d + '" stroke="' + s.m.color + '"/>';
      var lx = X(n - 1), ly = Yof(si, s.raw[n - 1]);
      paths += '<circle r="3.2" cx="' + lx.toFixed(1) + '" cy="' + ly.toFixed(1) + '" fill="' + s.m.color + '" stroke="#fff" stroke-width="1.5"/>';
      if (mode !== 'dual') ends += '<text class="end" x="' + (lx + 7).toFixed(1) + '" y="' + (ly + 3).toFixed(1) + '" fill="' + s.m.color + '">' + esc(s.m.short) + '</text>';
    });

    var svg = '<svg class="trend-svg" viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="Trend of ' + esc(sel.map(function (mm) { return mm.label; }).join(' and ')) + ' over ' + n + ' months">' +
      grid + goalM + ylab + xlab + paths + ends +
      '<rect class="hit" x="' + mL + '" y="' + mT + '" width="' + iw + '" height="' + ih + '" fill="transparent"/>' +
      '<g class="cross" style="display:none"><line class="cx" y1="' + mT + '" y2="' + (mT + ih) + '"/></g></svg>';
    plot.innerHTML = svg + '<div class="trend-tip" id="trendTip" style="display:none"></div>';

    document.getElementById('trendLegend').innerHTML = series.map(function (s, si) {
      var ax = mode === 'dual' ? '<span class="axtag">' + (si === 0 ? 'left axis' : 'right axis') + '</span>' : '';
      return '<span class="lg"><span class="sw" style="background:' + s.m.color + '"></span>' + esc(s.m.label) + ' <b>' + esc(fmtMetric(s.m, s.latest)) + '</b>' + ax + '</span>';
    }).join('');
    document.getElementById('trendMode').textContent = mode === 'single'
      ? 'Actual values with the goal line.'
      : mode === 'shared'
        ? 'Both in ' + unitWord(sel[0].unit) + ' on one shared axis, with each goal line.'
        : 'Two axes — ' + series[0].m.short + ' on the left, ' + series[1].m.short + ' on the right — each in its own units.';

    var thead = '<tr><th>Month</th>' + series.map(function (s) { return '<th>' + esc(s.m.label) + '</th>'; }).join('') + '</tr>';
    var trows = '';
    for (var r = 0; r < n; r++) { trows += '<tr><td>' + esc(months[start + r].label) + '</td>' + series.map(function (s) { return '<td>' + esc(fmtMetric(s.m, s.raw[r])) + '</td>'; }).join('') + '</tr>'; }
    document.getElementById('trendTable').innerHTML = '<table>' + thead + trows + '</table>';

    var svgEl = plot.querySelector('.trend-svg'), tip = document.getElementById('trendTip');
    var cross = plot.querySelector('.cross'), cx = plot.querySelector('.cx'), hit = plot.querySelector('.hit');
    function move(ev) {
      var rect = svgEl.getBoundingClientRect(), sx = (ev.clientX - rect.left) * (W / rect.width);
      var i = Math.max(0, Math.min(n - 1, Math.round((sx - mL) / (iw / Math.max(n - 1, 1)))));
      var px = X(i);
      cross.style.display = ''; cx.setAttribute('x1', px.toFixed(1)); cx.setAttribute('x2', px.toFixed(1));
      tip.innerHTML = '<div class="tt-h">' + esc(months[start + i].label) + '</div>' + series.map(function (s) {
        return '<div class="tt-row"><span class="sw" style="background:' + s.m.color + '"></span>' + esc(s.m.short) + '<b>' + esc(fmtMetric(s.m, s.raw[i])) + '</b></div>';
      }).join('');
      tip.style.display = 'block';
      var lpx = (px / W) * plot.clientWidth + 14;
      if (lpx > plot.clientWidth - 160) lpx = (px / W) * plot.clientWidth - 160;
      tip.style.left = Math.max(4, lpx) + 'px';
    }
    hit.addEventListener('mousemove', move);
    hit.addEventListener('mouseleave', function () { cross.style.display = 'none'; tip.style.display = 'none'; });
  }

  function refreshTrendChips() {
    Array.prototype.forEach.call(document.querySelectorAll('.trend-chip'), function (c) {
      var on = trendState.metrics.indexOf(c.getAttribute('data-metric')) >= 0;
      c.classList.toggle('on', on); c.setAttribute('aria-pressed', on);
    });
  }
  function wireTrends(storeId) {
    var mets = document.getElementById('trendMetrics'), per = document.getElementById('trendPeriod');
    if (mets) mets.addEventListener('click', function (e) {
      var b = e.target.closest('[data-metric]'); if (!b) return;
      var k = b.getAttribute('data-metric'), at = trendState.metrics.indexOf(k);
      if (at >= 0) { if (trendState.metrics.length > 1) trendState.metrics.splice(at, 1); }
      else { trendState.metrics.push(k); if (trendState.metrics.length > TREND_MAX) trendState.metrics.shift(); }
      refreshTrendChips();
      drawTrends(storeId);
    });
    if (per) per.addEventListener('click', function (e) {
      var b = e.target.closest('[data-period]'); if (!b) return;
      trendState.period = parseInt(b.getAttribute('data-period'), 10);
      Array.prototype.forEach.call(per.children, function (c) { var on = c === b; c.classList.toggle('on', on); c.setAttribute('aria-pressed', on); });
      drawTrends(storeId);
    });
  }

  /* ---- Market Manager roll-up (book of shops) ---- */
  var marketSort = { key: 'risk', dir: 'desc' };

  function shopRow(id) {
    var s = STORE_BY_ID[id] || { name: id }, k = KPIS_BY_STORE[id] || {}, pc = computePacing(id);
    var openPlans = 0, atRisk = 0;
    (DATA.plans || []).forEach(function (pl) {
      if (pl.storeId !== id) return;
      if ((pl.tasks || []).some(function (t) { return t.column !== 'closed'; })) openPlans++;
    });
    tasks.forEach(function (t) { if (t.storeId === id && isBehind(t)) atRisk++; });
    var pctBudget = pc.pctClosedToBudget, pace = pc.pacePct, daysBehind = pc.daysBehind, ro = k.ro;
    var risk = 0;
    if (daysBehind > 1.5) risk += 2; else if (daysBehind > 0.5) risk += 1;
    if (pctBudget < pace - 5) risk += 2; else if (pctBudget < pace - 2) risk += 1;
    if (ro < 68) risk += 1;
    if (atRisk >= 3) risk += 1;
    var status = risk >= 3 ? { w: 'Behind', c: 'serious' } : risk >= 1 ? { w: 'Watch', c: 'warn' } : { w: 'On track', c: 'good' };
    return { id: id, name: s.name, ro: ro, closed: pc.closedMTD, pctBudget: pctBudget, pace: pace, daysBehind: daysBehind, openPlans: openPlans, atRisk: atRisk, risk: risk, status: status };
  }

  /* a market row for the region scorecard — generated, no underlying stores */
  function marketRow(name) {
    var f = marketFunnelObj(name), pc = computeMarketPacing(name), act = marketPlanActivity(name);
    var pctBudget = pc.pctClosedToBudget, pace = pc.pacePct, daysBehind = pc.daysBehind, ro = f.ro;
    var risk = 0;
    if (daysBehind > 1.5) risk += 2; else if (daysBehind > 0.5) risk += 1;
    if (pctBudget < pace - 5) risk += 2; else if (pctBudget < pace - 2) risk += 1;
    if (ro < 68) risk += 1;
    if (act.atRisk >= 3) risk += 1;
    var status = risk >= 3 ? { w: 'Behind', c: 'serious' } : risk >= 1 ? { w: 'Watch', c: 'warn' } : { w: 'On track', c: 'good' };
    return { id: 'mkt::' + name, name: name, ro: ro, closed: pc.closedMTD, pctBudget: pctBudget, pace: pace, daysBehind: daysBehind, openPlans: act.open, atRisk: act.atRisk, risk: risk, status: status };
  }

  function sortScorecard(rows) {
    var k = marketSort.key, dir = marketSort.dir === 'asc' ? 1 : -1;
    return rows.slice().sort(function (a, b) {
      var va = k === 'status' ? a.risk : a[k], vb = k === 'status' ? b.risk : b[k];
      if (va < vb) return -1 * dir; if (va > vb) return 1 * dir; return 0;
    });
  }
  /* shared scorecard used by the Market (shops) and Region (markets) roll-ups */
  function scorecardHTML(rows, firstLabel) {
    var cols = [
      { k: 'name', label: firstLabel, num: false },
      { k: 'ro', label: 'Opp. to RO', num: true },
      { k: 'closed', label: 'Closed MTD', num: true },
      { k: 'pctBudget', label: '% to Budget', num: true },
      { k: 'daysBehind', label: 'Days Behind', num: true },
      { k: 'openPlans', label: 'Open plans', num: true },
      { k: 'atRisk', label: 'At-risk', num: true },
      { k: 'status', label: 'Status', num: false }
    ];
    var thead = '<tr>' + cols.map(function (c) {
      var arrow = marketSort.key === c.k ? (marketSort.dir === 'asc' ? ' ▲' : ' ▼') : '';
      return '<th class="' + (c.num ? 'num' : '') + '" data-sort="' + c.k + '" tabindex="0">' + esc(c.label) + arrow + '</th>';
    }).join('') + '</tr>';
    var body = sortScorecard(rows).map(function (r) {
      var roCls = r.ro >= 70 ? 'ok' : 'bad';
      var budCls = r.pctBudget >= r.pace ? 'ok' : 'bad';
      var dbCls = r.daysBehind > 0.5 ? 'bad' : (r.daysBehind < -0.05 ? 'ok' : '');
      var arCls = r.atRisk > 0 ? 'bad' : '';
      return '<tr data-store="' + esc(r.id) + '" tabindex="0" role="button" aria-label="Open ' + esc(r.name) + ' dashboard">' +
        '<td class="shop">' + esc(r.name) + '</td>' +
        '<td class="num ' + roCls + '">' + Math.round(r.ro) + '%</td>' +
        '<td class="num">' + esc(money(r.closed)) + '</td>' +
        '<td class="num ' + budCls + '">' + Math.round(r.pctBudget) + '%</td>' +
        '<td class="num ' + dbCls + '">' + (r.daysBehind < -0.05 ? '−' : '') + Math.abs(r.daysBehind).toFixed(1) + '</td>' +
        '<td class="num">' + r.openPlans + '</td>' +
        '<td class="num ' + arCls + '">' + r.atRisk + '</td>' +
        '<td><span class="mk-status ' + r.status.c + '">' + esc(r.status.w) + '</span></td>' +
      '</tr>';
    }).join('');
    return '<table class="mk-table"><thead>' + thead + '</thead><tbody>' + body + '</tbody></table>';
  }
  function marketTableHTML() { return scorecardHTML(MARKET.storeIds.map(shopRow), 'Shop'); }
  function regionTableHTML(region) { return scorecardHTML(region.markets.map(marketRow), 'Market'); }

  function wireScorecard(rebuild) {
    var wrap = document.getElementById('mkTableWrap'); if (!wrap) return;
    wrap.addEventListener('click', function (e) {
      var th = e.target.closest('th[data-sort]');
      if (th) {
        var k = th.getAttribute('data-sort');
        if (marketSort.key === k) marketSort.dir = marketSort.dir === 'asc' ? 'desc' : 'asc';
        else { marketSort.key = k; marketSort.dir = (k === 'name') ? 'asc' : 'desc'; }
        wrap.innerHTML = rebuild();
        return;
      }
      var tr = e.target.closest('tr[data-store]');
      if (tr) setStore(tr.getAttribute('data-store'));
    });
    wrap.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var tr = e.target.closest('tr[data-store]'); if (tr) { setStore(tr.getAttribute('data-store')); return; }
      var th = e.target.closest('th[data-sort]'); if (th) th.click();
    });
  }

  function renderMarketKpis() {
    var root = document.getElementById('kpiRoot'); if (!root) return;
    var fvals = kpiFunnelValuesFor('book');
    var rows = MARKET.storeIds.map(shopRow);
    var behindCount = rows.filter(function (r) { return r.status.w === 'Behind'; }).length;
    var openPlans = rows.reduce(function (a, r) { return a + r.openPlans; }, 0);
    var html = '';
    html += '<div class="kpi-head"><p class="kpi-title" data-testid="kpi-page-title">' + esc(MARKET.name) + ' — Market KPIs</p>' +
      '<p class="kpi-sub" data-testid="kpi-page-subtitle">80/70/7</p>' +
      '<p class="mk-lead">Market Manager · ' + esc(MARKET.manager) + ' · ' + MARKET.storeIds.length + ' shops · ' +
      '<b>' + behindCount + '</b> behind · <b>' + openPlans + '</b> open action plans</p></div>';
    html += '<div class="kpi-funnel">' + KPI_FUNNEL.map(function (m) { return funnelBoxHTML(m, fvals[m.key]); }).join('') + '</div>';
    html += '<div class="kpi-section"><div class="kpi-section-title">Shops in book</div>' +
      '<div class="mk-table-wrap" id="mkTableWrap">' + marketTableHTML() + '</div>' +
      '<div class="trend-hint">Sort by any column; click a shop to drill into its dashboard.</div></div>';
    html += trendsSectionHTML();
    root.innerHTML = html;
    wireScorecard(marketTableHTML);
    drawTrends('book');
    wireTrends('book');
  }

  function renderRegionKpis() {
    var root = document.getElementById('kpiRoot'); if (!root) return;
    var region = currentRegion();
    var fvals = regionFunnelAvg(region);
    var rows = region.markets.map(marketRow);
    var behindCount = rows.filter(function (r) { return r.status.w === 'Behind'; }).length;
    var openPlans = rows.reduce(function (a, r) { return a + r.openPlans; }, 0);
    var html = '';
    html += '<div class="kpi-head"><p class="kpi-title" data-testid="kpi-page-title">' + esc(region.name + ' — Region KPIs') + '</p>' +
      '<p class="kpi-sub" data-testid="kpi-page-subtitle">80/70/7</p>' +
      '<p class="mk-lead">Regional Manager · ' + esc(region.manager) + ' · ' + region.markets.length + ' markets · ' +
      '<b>' + behindCount + '</b> behind · <b>' + openPlans + '</b> open action plans</p></div>';
    html += '<div class="kpi-funnel">' + KPI_FUNNEL.map(function (m) { return funnelBoxHTML(m, fvals[m.key]); }).join('') + '</div>';
    html += '<div class="kpi-section"><div class="kpi-section-title">Markets in region</div>' +
      '<div class="mk-table-wrap" id="mkTableWrap">' + regionTableHTML(region) + '</div>' +
      '<div class="trend-hint">Sort by any column; click a market to drill into its dashboard.</div></div>';
    html += trendsSectionHTML();
    root.innerHTML = html;
    wireScorecard(function () { return regionTableHTML(region); });
    drawTrends('region');
    wireTrends('region');
  }

  function renderKpiTab(storeId) {
    if (state.role === 'regional') { if (storeId === 'region') renderRegionKpis(); else renderKpis(storeId); return; }
    if (state.role === 'market' && storeId === 'book') renderMarketKpis();
    else renderKpis(storeId);
  }

  function setRole(role) {
    state.role = role;
    Array.prototype.forEach.call(document.querySelectorAll('.proto-role'), function (b) {
      var on = b.getAttribute('data-role') === role;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
    });
    var note = document.getElementById('protoNote');
    if (note) {
      var rg = currentRegion();
      note.textContent = role === 'market'
        ? MARKET.name + ' — a roll-up across the book of ' + MARKET.storeIds.length + ' shops, with a shop-by-shop scorecard. Drill into any shop from the selector.'
        : role === 'regional'
        ? rg.name + ' region — a roll-up across ' + rg.markets.length + ' markets, with a market-by-market scorecard. Drill into any market from the selector.'
        : 'One shop’s Action Plans and KPIs. Use the location selector to choose the shop.';
    }
    state.store = role === 'market' ? 'book' : role === 'regional' ? 'region' : (DATA.defaultStoreId || (DATA.stores[0] && DATA.stores[0].id));
    setStore(state.store);
  }

  function setView(view) {
    state.view = view;
    document.getElementById('viewActionPlans').hidden = (view !== 'plans');
    document.getElementById('viewKpis').hidden = (view !== 'kpis');
    Array.prototype.forEach.call(document.querySelectorAll('.nav-item[data-view]'), function (b) {
      var sel = b.getAttribute('data-view') === view;
      b.classList.toggle('selected', sel);
      if (sel) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (view === 'kpis') renderKpiTab(state.store);
  }

  /* ---------------- init ---------------- */
  function init() {
    boardEl = document.getElementById('board');
    statPlans = document.getElementById('statPlans');
    statBlocked = document.getElementById('statBlocked');
    statBehind = document.getElementById('statBehind');
    pageSub = document.getElementById('pageSub');
    toastEl = document.getElementById('toast');

    // toolbar
    var search = document.getElementById('searchInput');
    var rootFilter = document.getElementById('rootFilter');
    var ownerFilter = document.getElementById('ownerFilter');
    var behindBtn = document.getElementById('behindBtn');
    var sortSelect = document.getElementById('sortSelect');

    populate(rootFilter, DATA.rootCauses || [], 'All root causes');
    refreshOwnerFilter();

    search.addEventListener('input', function () { state.search = search.value; render(); });
    rootFilter.addEventListener('change', function () { state.root = rootFilter.value; render(); });
    ownerFilter.addEventListener('change', function () { state.owner = ownerFilter.value; render(); });
    sortSelect.addEventListener('change', function () { state.sort = sortSelect.value; render(); });
    behindBtn.addEventListener('click', function () {
      state.behind = !state.behind;
      behindBtn.classList.toggle('active', state.behind);
      behindBtn.setAttribute('aria-pressed', state.behind ? 'true' : 'false');
      render();
    });

    document.getElementById('newBtn').addEventListener('click', function () { openModal(null); });

    // board delegation
    boardEl.addEventListener('click', onBoardClick);
    boardEl.addEventListener('keydown', onBoardKey);
    boardEl.addEventListener('dragstart', onDragStart);
    boardEl.addEventListener('dragend', onDragEnd);
    boardEl.addEventListener('dragover', onDragOver);
    boardEl.addEventListener('dragleave', onDragLeave);
    boardEl.addEventListener('drop', onDrop);

    // store selector
    var shopBtn = document.getElementById('shopBtn');
    var storeMenu = document.getElementById('storeMenu');
    buildStoreMenu();
    shopBtn.addEventListener('click', function (e) { e.stopPropagation(); storeMenu.classList.toggle('open'); });
    storeMenu.addEventListener('click', function (e) {
      var it = e.target.closest('[data-store]'); if (!it) return;
      setStore(it.getAttribute('data-store'));
      storeMenu.classList.remove('open');
    });
    document.addEventListener('click', function () { storeMenu.classList.remove('open'); });

    // modal refs
    overlay = document.getElementById('overlay');
    modalTitle = document.getElementById('modalTitle');
    deleteBtn = document.getElementById('deleteBtn');
    fPlan = document.getElementById('fPlan');
    fTitle = document.getElementById('fTitle');
    fDesc = document.getElementById('fDesc');
    fOwner = document.getElementById('fOwner');
    fRole = document.getElementById('fRole');
    fStatus = document.getElementById('fStatus');
    fPriority = document.getElementById('fPriority');
    fDue = document.getElementById('fDue');
    fRisk = document.getElementById('fRisk');
    fBlocked = document.getElementById('fBlocked');
    fMetric = document.getElementById('fMetric');
    fLag = document.getElementById('fLag');
    ctxWrap = document.getElementById('ctxWrap');
    logWrap = document.getElementById('logWrap');

    fStatus.innerHTML = COLUMNS.map(function (c) { return '<option value="' + c.key + '">' + esc(c.label) + '</option>'; }).join('');
    fPriority.innerHTML = PRIORITIES.map(function (p) { return '<option value="' + p.key + '">' + esc(p.label) + '</option>'; }).join('');
    fRole.setAttribute('list', 'roleOptions');
    document.getElementById('roleOptions').innerHTML = ['Market Manager (CPM)', 'RDO', 'Shop GM', 'Estimator', 'Body Technician', 'Refinish Technician', 'Painter', 'Parts Manager', 'CSR', 'National Account Manager', 'RVP', 'ADAS Calibration Tech', 'Facilities / Capex', 'HR Recruiter', 'Regional Fixed Ops', 'Sales Rep']
      .map(function (r) { return '<option value="' + esc(r) + '">'; }).join('');

    fPlan.addEventListener('change', function () { renderContext(fPlan.value, editingId ? findTask(editingId) : null); });
    document.getElementById('actionForm').addEventListener('submit', submitForm);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);
    deleteBtn.addEventListener('click', deleteCurrent);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal(); });
    fTitle.addEventListener('input', function () { fTitle.closest('.form-row').classList.remove('invalid'); });

    // nav: Action Plans / KPI's switch views; other tabs are inert
    Array.prototype.forEach.call(document.querySelectorAll('.nav-item'), function (btn) {
      var view = btn.getAttribute('data-view');
      if (view) { btn.addEventListener('click', function () { setView(view); }); }
      else { btn.addEventListener('click', function () { toast(btn.getAttribute('data-label') + ' isn’t part of this prototype'); }); }
    });

    // prototype persona banner
    var protoRoles = document.getElementById('protoRoles');
    if (protoRoles) protoRoles.addEventListener('click', function (e) {
      var b = e.target.closest('[data-role]'); if (b) setRole(b.getAttribute('data-role'));
    });
    var pn = document.getElementById('protoNote');
    if (pn) pn.textContent = 'One shop’s Action Plans and KPIs. Use the location selector to choose the shop.';

    var rz; window.addEventListener('resize', function () { if (state.view !== 'kpis') return; clearTimeout(rz); rz = setTimeout(function () { drawTrends(state.store); }, 150); });

    setStore(state.store);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
