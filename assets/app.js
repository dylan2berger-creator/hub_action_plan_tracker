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

  var state = {
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
      if (state.store !== 'all' && t.storeId !== state.store) return false;
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
    var scope = tasks.filter(function (t) { return state.store === 'all' || t.storeId === state.store; });
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
    var eyebrow = (state.store === 'all' && s) ? '<div class="card-eyebrow">' + esc(s.name) + '</div>' : '';

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
    var items = [{ id: 'all', name: 'All stores', count: (DATA.plans || []).length }]
      .concat((DATA.stores || []).map(function (s) { return { id: s.id, name: s.name, count: counts[s.id] || 0 }; }));
    menu.innerHTML = items.map(function (it) {
      return '<button type="button" role="option" class="store-item' + (it.id === state.store ? ' active' : '') + '" data-store="' + esc(it.id) + '">' +
        '<span class="store-name">' + esc(it.name) + '</span><span class="store-count">' + it.count + '</span></button>';
    }).join('');
  }
  function setStore(id) {
    state.store = id;
    var s = id === 'all' ? { name: 'All stores' } : STORE_BY_ID[id];
    document.getElementById('shopName').textContent = s ? s.name : 'All stores';
    buildStoreMenu();
    render();
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

    // inert nav tabs
    Array.prototype.forEach.call(document.querySelectorAll('.nav-item:not(.selected)'), function (btn) {
      btn.addEventListener('click', function () { toast(btn.getAttribute('data-label') + ' isn’t part of this prototype'); });
    });

    setStore(state.store);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
