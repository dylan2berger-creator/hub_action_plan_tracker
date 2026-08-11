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
  function rootOf(t) { if (t.rootCauseCategory && ROOT_BY_KEY[t.rootCauseCategory]) return ROOT_BY_KEY[t.rootCauseCategory]; var p = planOf(t); return p ? ROOT_BY_KEY[p.rootCauseCategory] : null; }
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
      if (state.root !== 'all') { var rc = rootOf(t); if (!rc || rc.key !== state.root) return false; }
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
  var boardEl, statBlocked, statBehind, pageSub;

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
            '<button class="mini-btn" data-edit="' + esc(t.id) + '" aria-label="Open task details">' + editIcon() + '</button>' +
          '</span>' +
        '</div>' +
      '</article>'
    );
  }

  function outcomeClass(o) { if (o === 'Improved') return 'chip-green'; if (o === 'Superseded') return 'chip-blue'; return 'chip-gray'; }
  function avatarHTML(name) { return '<span class="avatar" style="background:' + avatarColor(name) + '">' + esc(initials(name)) + '</span>'; }

  /* ---------------- icons ---------------- */
  function calIcon() { return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m0 16H5V10h14zm0-12H5V6h14z"/></svg>'; }
  function eyeIcon() { return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 5c-5 0-9 4.5-10 7 1 2.5 5 7 10 7s9-4.5 10-7c-1-2.5-5-7-10-7m0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8m0-2a2 2 0 1 0 0-4 2 2 0 0 0 0 4"/></svg>'; }
  function lockIcon() { return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18 8h-1V6a5 5 0 0 0-10 0v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2M9 6a3 3 0 0 1 6 0v2H9zm3 11a2 2 0 1 1 0-4 2 2 0 0 1 0 4"/></svg>'; }
  function editIcon() { return '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z"/></svg>'; }

  /* ---------------- board interactions ---------------- */
  function onBoardClick(e) {
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
      fPlan, fTitle, fDesc, fOwner, fRole, fRoot, fStatus, fPriority, fDue, fRisk, fBlocked, fMetric, fLag,
      logWrap, noteInput;

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
    fRoot.value = (t && t.rootCauseCategory) || (PLAN_BY_ID[planId] && PLAN_BY_ID[planId].rootCauseCategory) || (DATA.rootCauses[0] && DATA.rootCauses[0].key);
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
      rootCauseCategory: fRoot.value,
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
      var regionShops = region.markets.reduce(function (a, nm) { return a + shopsOfMarket(nm).length; }, 0);
      items = [{ id: 'region', name: 'All my markets', count: regionShops, sub: region.markets.length + ' markets' }]
        .concat(region.markets.map(function (nm) { return { id: 'mkt::' + nm, name: nm, count: shopsOfMarket(nm).length }; }));
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
    if (state.view === 'kpis') {
      if (state.role !== 'gm') {
        if (id === 'region' || id === 'book' || id === 'all') { kpiState.market = 'all'; kpiState.view = 'dashboard'; kpiState.shopId = null; }
        else if (isMarketScope(id)) { kpiState.market = id.slice(5); kpiState.view = 'dashboard'; kpiState.shopId = null; }
        else if (shopById(id)) { kpiState.view = 'shop'; kpiState.shopId = id; }
      }
      renderKpiTab();
    }
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

  /* ====================== KPIs dashboard (rebuilt) ======================
     Shop-centric workflow: revenue attainment → challenged flagging →
     shop detail → carrier scorecard. Every threshold/target/direction
     comes from window.HUB_CONFIG (assets/config.js) — nothing hardcodes
     "green above target"; the formatting reads each metric's `direction`. */
  var CFG = window.HUB_CONFIG || {};
  var CHALLENGED_PCT = (CFG.revenue && CFG.revenue.challengedVariancePct != null) ? CFG.revenue.challengedVariancePct : -0.10;
  var FUNNEL = CFG.funnel || [];
  var DRP = CFG.drp || { scoreMin: 0, scoreMax: 100, variables: [] };
  var CARRIERS = DATA.carriers || [];
  var RULE_TEXTS = DATA.ruleTexts || [];
  // offset = how many months back the window ends (0 = through the current month; 1 = the previous complete month)
  var PERIODS = [{ key: 'prev', label: 'Prev mo', months: 1, offset: 1 }, { key: 'mtd', label: 'MTD', months: 1, offset: 0 }, { key: 'm3', label: '3M', months: 3, offset: 0 }, { key: 'm6', label: '6M', months: 6, offset: 0 }, { key: 'm12', label: '12M', months: 12, offset: 0 }];
  var MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function periodBtnsHTML() { return PERIODS.map(function (p) { return '<button type="button" class="seg' + (kpiState.period === p.key ? ' on' : '') + '" data-period="' + p.key + '">' + p.label + '</button>'; }).join(''); }
  var CUR_MONTH = TODAY.getMonth();
  var RA_MIN = -0.35, RA_MAX = 0.25;   // fixed revenue-variance chart domain

  var kpiState = { view: 'dashboard', shopId: null, period: 'prev', gran: 'shops', market: 'all', carriers: null, chartKpis: ['revenue'], carrierOpen: null, carrierMetric: 'score', roCarrier: null };

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function pctStr(p) { return (p >= 0 ? '+' : '−') + Math.abs(Math.round(p * 100)) + '%'; }

  /* ---- hierarchy: market → region, real shops by market, shops per market ---- */
  var REGION_OF_MARKET = {};
  REGIONS.forEach(function (rg) { rg.markets.forEach(function (m) { REGION_OF_MARKET[m] = rg; }); });
  var REAL_SHOPS_BY_MARKET = {};
  (DATA.stores || []).forEach(function (s) { if (!s.market) return; (REAL_SHOPS_BY_MARKET[s.market] = REAL_SHOPS_BY_MARKET[s.market] || []).push(s); });
  function isDemoMarket(m) { var rg = REGION_OF_MARKET[m]; return rg && rg.id === DATA.defaultRegionId; }
  function shopCountForMarket(m) { var r = mulberry(hashStr('shopn:' + m)); return isDemoMarket(m) ? 4 + Math.floor(r() * 5) : 1 + Math.floor(r() * 3); }
  var LOCALITIES = ['Riverside', 'Oakdale', 'Fairview', 'Lakeside', 'Brookfield', 'Westgate', 'Hillcrest', 'Kingston', 'Ashford', 'Belmont', 'Clearwater', 'Devon', 'Easton', 'Fremont', 'Glenwood', 'Harmon', 'Ivywood', 'Kendall', 'Lorain', 'Maple Grove', 'Northfield', 'Oakhurst', 'Pinewood', 'Ridgeway', 'Stonebridge', 'Trenton', 'Vernon', 'Westbrook'];
  var SHOP_BY_ID = {}, _shopsCache = {};
  function shopsOfMarket(m) {
    if (_shopsCache[m]) return _shopsCache[m];
    var real = (REAL_SHOPS_BY_MARKET[m] || []).map(function (s) { return { id: s.id, name: s.name, market: m, real: true }; });
    var out = real.slice(), target = shopCountForMarket(m), need = Math.max(0, target - real.length);
    var r = mulberry(hashStr('shops:' + m)), used = {};
    for (var k = 0; k < need; k++) {
      var idx = Math.floor(r() * LOCALITIES.length), guard = 0;
      while (used[idx] && guard++ < LOCALITIES.length) idx = (idx + 1) % LOCALITIES.length;
      used[idx] = 1;
      out.push({ id: 'g:' + m + ':' + k, name: LOCALITIES[idx], market: m, real: false });
    }
    out.forEach(function (sh) { SHOP_BY_ID[sh.id] = sh; });
    _shopsCache[m] = out;
    return out;
  }
  function shopsOfRegion(rg) { var out = []; rg.markets.forEach(function (m) { out = out.concat(shopsOfMarket(m)); }); return out; }
  function shopById(id) {
    if (SHOP_BY_ID[id]) return SHOP_BY_ID[id];
    var st = STORE_BY_ID[id];
    if (st && st.market) { shopsOfMarket(st.market); if (SHOP_BY_ID[id]) return SHOP_BY_ID[id]; }
    if (typeof id === 'string' && id.indexOf('g:') === 0) { shopsOfMarket(id.slice(2, id.lastIndexOf(':'))); return SHOP_BY_ID[id] || null; }
    return null;
  }

  /* ---- deterministic per-shop data ---- */
  function srng(id, salt) { return mulberry(hashStr('shop:' + id + ':' + salt)); }
  // 12-month backward random walk ending at `end`
  function walk12(id, salt, end, spread, lo, hi) {
    var r = mulberry(hashStr('ms:' + id + ':' + salt)), v = new Array(12); v[11] = end;
    for (var i = 10; i >= 0; i--) { v[i] = clamp(v[i + 1] - (r() * 2 - 1) * spread, lo, hi); }
    var out = [];
    for (var j = 0; j < 12; j++) { var mi = (CUR_MONTH - 11 + j + 1200) % 12; out.push({ mi: mi, label: MONTH_ABBR[mi], value: v[j] }); }
    return out;
  }
  var _shopDataCache = {};
  function shopData(id) {
    if (_shopDataCache[id]) return _shopDataCache[id];
    var sh = shopById(id); if (!sh) return null;
    var m = sh.market, mpac = marketPacingObj(m), mfun = marketFunnelObj(m);
    var r = srng(id, 'rev');
    var target = Math.round(mpac.budget / Math.max(1, shopsOfMarket(m).length) * (0.85 + r() * 0.3) / 1000) * 1000;
    var baseVar = clamp((mpac.closedPace - 0.95) + (r() * 2 - 1) * 0.14, -0.30, 0.20);
    // funnel
    var est = clamp(mfun.estimate + (srng(id, 'est')() * 10 - 5), 60, 95);
    var ro = clamp(mfun.ro + (srng(id, 'ro')() * 12 - 6), 52, 82);
    var arr = clamp(mfun.arrive + (srng(id, 'arr')() * 2 - 1), 4.5, 10);
    // interesting case: ~1/3 of challenged shops are funnel-clean → carrier is the only cause
    var carrierOnly = false;
    if (baseVar <= CHALLENGED_PCT && srng(id, 'pick')() < 0.34) {
      est = clamp(82 + srng(id, 'e2')() * 7, 82, 93);
      ro = clamp(72 + srng(id, 'r2')() * 7, 72, 82);
      arr = clamp(5.1 + srng(id, 'a2')() * 1.5, 5.1, 6.9);
      carrierOnly = true;
    }
    // monthly revenue: target (slight seasonality) + actual (walk ending at current)
    var tg = mulberry(hashStr('tg:' + id)), months = [];
    var actualEnd = Math.round(target * (1 + baseVar));
    var varWalk = walk12(id, 'var', baseVar, 0.05, -0.4, 0.3);
    for (var i = 0; i < 12; i++) {
      var tgt = Math.round(target * (0.97 + tg() * 0.06));
      months.push({ mi: varWalk[i].mi, label: varWalk[i].label, target: tgt, actual: Math.round(tgt * (1 + varWalk[i].value)) });
    }
    months[11].target = target; months[11].actual = actualEnd; // pin current month
    var funTrend = { estimate: walk12(id, 'et', est, 2.2, 55, 97), ro: walk12(id, 'rt', ro, 2.6, 48, 86), arrive: walk12(id, 'at', arr, 0.4, 4, 11) };
    var opps = 200 + Math.floor(srng(id, 'opps')() * 260);
    var counts = { opportunities: opps, estimates: Math.round(opps * est / 100), ros: Math.round(opps * ro / 100), arrivals: 0 };
    counts.arrivals = Math.round(counts.ros * (0.90 + srng(id, 'av')() * 0.08));
    var d = {
      id: id, name: sh.name, market: m, region: (REGION_OF_MARKET[m] || {}).name, real: sh.real,
      months: months, funnel: { estimate: est, ro: ro, arrive: arr, counts: counts, trend: funTrend },
      carriers: buildCarriers(id), carrierOnly: carrierOnly
    };
    _shopDataCache[id] = d;
    return d;
  }
  // revenue summed over the selected period window (MTD = current month)
  function revFor(id, period) {
    var d = shopData(id); if (!d) return { actual: 0, target: 0, variancePct: 0, variance: 0 };
    var pd = PERIODS.filter(function (p) { return p.key === period; })[0] || PERIODS[0];
    var end = 12 - (pd.offset || 0), a = 0, t = 0;
    for (var i = end - pd.months; i < end; i++) { a += d.months[i].actual; t += d.months[i].target; }
    var vp = t ? (a - t) / t : 0;
    return { actual: a, target: t, variancePct: vp, variance: a - t };
  }
  function isChallenged(id, period) { return revFor(id, period).variancePct <= CHALLENGED_PCT; }

  /* ---- carriers (DRP scorecard) ---- */
  function buildCarriers(id) {
    var r = mulberry(hashStr('carr:' + id)), n = 5 + Math.floor(r() * 4);
    var pool = CARRIERS.slice(), chosen = [];
    for (var k = 0; k < n && pool.length; k++) { chosen.push(pool.splice(Math.floor(r() * pool.length), 1)[0]); }
    var shopAvg = { estAccuracy: 88 + r() * 6, rulesAdherence: 64 + r() * 12, cycleTime: 8 + r() * 4, csi: 90 + r() * 6 };
    return chosen.map(function (name) {
      var cr = mulberry(hashStr('carr:' + id + ':' + name));
      var score = Math.round(45 + cr() * 52), vol = 20 + Math.floor(cr() * 180);
      // rules adherence is realistically ~70% on average; the 90s are a rare, standout carrier
      var adherence = shopAvg.rulesAdherence + (cr() * 28 - 14);
      if (cr() < 0.05) adherence = 86 + cr() * 10;                   // ~1 in 20 carriers is a standout (86–96%)
      adherence = Math.round(clamp(adherence, 45, 96) * 10) / 10;
      var triggered = 18 + Math.floor(cr() * 40);                                  // rule triggers over the period
      var notAdhered = Math.max(0, Math.round(triggered * (1 - adherence / 100))); // count feeding the actionable list
      var vars = {
        estAccuracy: Math.round(clamp(shopAvg.estAccuracy + (cr() * 8 - 4), 78, 98) * 10) / 10,
        rulesAdherence: adherence,
        cycleTime: Math.round(clamp(shopAvg.cycleTime + (cr() * 4 - 2), 6, 16) * 10) / 10,
        csi: Math.round(clamp(shopAvg.csi + (cr() * 8 - 4), 80, 99) * 10) / 10
      };
      var trends = {
        score:          walk12(id + ':' + name, 'sc',  score,               4,   DRP.scoreMin, DRP.scoreMax),
        volume:         walk12(id + ':' + name, 'vol', vol,                  Math.max(3, vol * 0.05), 5, 260),
        estAccuracy:    walk12(id + ':' + name, 'ea',  vars.estAccuracy,    1.4, 74, 99),
        rulesAdherence: walk12(id + ':' + name, 'ra',  vars.rulesAdherence, 1.8, 40, 96),
        cycleTime:      walk12(id + ':' + name, 'ct',  vars.cycleTime,      0.5, 5,  18),
        csi:            walk12(id + ':' + name, 'cs',  vars.csi,            1.1, 78, 100)
      };
      return { name: name, score: score, volume: vol, vars: vars, shopAvg: shopAvg, trend: trends.score, trends: trends, rules: buildRules(id, name, notAdhered) };
    }).sort(function (a, b) { return b.volume - a.volume; });
  }
  function buildRules(id, carrier, total) {
    var r = mulberry(hashStr('rules:' + id + ':' + carrier)), groups = {}, count = Math.max(3, total);
    for (var k = 0; k < count; k++) { var t = RULE_TEXTS[Math.floor(r() * RULE_TEXTS.length)]; groups[t] = (groups[t] || 0) + 1; }
    return Object.keys(groups).map(function (t) { return { text: t, count: groups[t] }; }).sort(function (a, b) { return b.count - a.count; });
  }

  /* ---- scope resolution (persona + in-pane market filter) ---- */
  function baseShopIds() {
    var ids;
    if (state.role === 'regional') ids = shopsOfRegion(currentRegion()).map(function (s) { return s.id; });
    else if (state.role === 'market') ids = (MARKET.storeIds || []).slice();
    else ids = [state.store];
    if (kpiState.market && kpiState.market !== 'all') ids = ids.filter(function (id) { var sh = shopById(id); return sh && sh.market === kpiState.market; });
    return ids.filter(function (id) { return shopById(id); });
  }
  function scopeMarkets() {
    if (state.role === 'regional') return currentRegion().markets.slice();
    if (state.role === 'market') { var set = {}; (MARKET.storeIds || []).forEach(function (id) { var sh = shopById(id); if (sh) set[sh.market] = 1; }); return Object.keys(set); }
    var sh = shopById(state.store); return sh ? [sh.market] : [];
  }
  function scopeTitle() {
    if (state.role === 'regional') return currentRegion().name;
    if (state.role === 'market') return MARKET.name;
    var sh = shopById(state.store); return sh ? sh.name : 'Shop';
  }

  /* ---- aggregation for markets/region granularity ---- */
  function aggEntity(name, shopIds) {
    var a = 0, t = 0, ch = 0, est = 0, ro = 0, arr = 0, n = shopIds.length || 1;
    shopIds.forEach(function (id) { var rv = revFor(id, kpiState.period), d = shopData(id); a += rv.actual; t += rv.target; if (rv.variancePct <= CHALLENGED_PCT) ch++; est += d.funnel.estimate; ro += d.funnel.ro; arr += d.funnel.arrive; });
    return { key: name, name: name, variancePct: t ? (a - t) / t : 0, actual: a, target: t, count: shopIds.length, challenged: ch, funnel: { estimate: est / n, ro: ro / n, arrive: arr / n } };
  }
  // chart entities depending on granularity
  function chartEntities() {
    var ids = baseShopIds();
    if (state.role === 'market' && kpiState.gran !== 'shops') return [aggEntity(MARKET.name, ids)];      // MM: markets/region collapse to one bar
    if (state.role === 'regional' && kpiState.gran === 'region') return [aggEntity(currentRegion().name, ids)];
    if (state.role === 'regional' && kpiState.gran === 'markets') {
      var mkts = scopeMarkets();
      if (kpiState.market && kpiState.market !== 'all') mkts = mkts.filter(function (m) { return m === kpiState.market; });
      return mkts.map(function (m) { return aggEntity(m, shopsOfMarket(m).map(function (s) { return s.id; })); });
    }
    // shops
    return ids.map(function (id) { var rv = revFor(id, kpiState.period), sh = shopById(id); return { key: id, name: sh.name, shop: true, variancePct: rv.variancePct, actual: rv.actual, target: rv.target }; });
  }

  /* ---- funnel flag helpers (direction-aware) ---- */
  function funnelPass(f, v) { return f.direction === 'lower' ? v <= f.target : v >= f.target; }
  function fmtFunnel(f, v) { return f.unit === '%' ? Math.round(v) + '%' : f.unit === 'days' ? (Math.round(v * 10) / 10) + 'd' : '' + Math.round(v); }
  function funnelAsMetric(f) { return { label: f.label, unit: f.unit, goal: f.target, dir: f.direction, info: f.definition }; }
  function varClass(vp) { return vp <= CHALLENGED_PCT ? 'bad' : vp < 0 ? 'warn' : 'ok'; }

  /* ---- tiny inline charts ---- */
  function svgSpark(vals, color, W, H) {
    if (!vals.length) return '';
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), rng = (hi - lo) || 1, pad = 2;
    var pts = vals.map(function (v, i) { var x = pad + (W - 2 * pad) * (vals.length < 2 ? 0.5 : i / (vals.length - 1)); var y = pad + (H - 2 * pad) * (1 - (v - lo) / rng); return (Math.round(x * 10) / 10) + ',' + (Math.round(y * 10) / 10); });
    return '<svg class="spark" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true"><polyline fill="none" stroke="' + color + '" stroke-width="1.5" points="' + pts.join(' ') + '"/></svg>';
  }

  /* ====================== dashboard ====================== */
  function renderDashboard() {
    var root = document.getElementById('kpiRoot'); if (!root) return;
    var ids = baseShopIds();
    var challenged = ids.filter(function (id) { return isChallenged(id, kpiState.period); });
    var ents = chartEntities().slice().sort(function (a, b) { return a.variancePct - b.variancePct; }); // worst first
    var periodBtns = periodBtnsHTML();
    var granBtns = '';
    if (state.role === 'regional') granBtns = ['shops', 'markets', 'region'].map(function (g) { return '<button type="button" class="seg' + (kpiState.gran === g ? ' on' : '') + '" data-gran="' + g + '">' + g.charAt(0).toUpperCase() + g.slice(1) + '</button>'; }).join('');
    else if (state.role === 'market') granBtns = ['shops', 'markets', 'region'].map(function (g) { return '<button type="button" class="seg' + (kpiState.gran === g ? ' on' : '') + '" data-gran="' + g + '">' + (g === 'shops' ? 'Shops' : g === 'markets' ? 'Market' : 'Book') + '</button>'; }).join('');
    var mkts = scopeMarkets();
    var mktOptions = '<option value="all">All markets</option>' + mkts.map(function (m) { return '<option value="' + esc(m) + '"' + (kpiState.market === m ? ' selected' : '') + '>' + esc(m) + '</option>'; }).join('');

    var html = '';
    html += '<div class="kpi-head"><p class="kpi-title" data-testid="kpi-page-title">' + esc(scopeTitle()) + ' — Revenue Attainment</p>' +
      '<p class="mk-lead">' + esc(roleWord()) + ' · <b>' + challenged.length + '</b> of ' + ids.length + ' shops challenged (revenue ' + Math.round(CHALLENGED_PCT * 100) + '% or more below target)</p></div>';

    // control bar
    html += '<div class="dash-controls">' +
      '<div class="seg-group" id="dashPeriod" role="group" aria-label="Period">' + periodBtns + '</div>' +
      (granBtns ? '<div class="seg-group" id="dashGran" role="group" aria-label="Granularity">' + granBtns + '</div>' : '') +
      '<label class="wk-select dash-mkt"><span class="dash-mkt-l">Filter</span><select id="dashMarket" aria-label="Market filter">' + mktOptions + '</select></label>' +
      '</div>';

    // chart
    html += '<div class="ra-chart" id="raChart">' + raChartHTML(ents) + '</div>';

    // challenged list
    html += '<div class="kpi-section"><div class="kpi-section-title">Challenged shops <span class="ctx-sub">(' + challenged.length + ')</span></div>' +
      challengedListHTML(challenged) + '</div>';

    root.innerHTML = html;
    wireDashboard();
  }
  function roleWord() { return state.role === 'regional' ? 'Regional Manager · ' + currentRegion().division : state.role === 'market' ? 'Market Manager' : 'General Manager'; }

  function raChartHTML(ents) {
    function pos(v) { return clamp((v - RA_MIN) / (RA_MAX - RA_MIN) * 100, 0, 100); }
    var zero = pos(0), thr = pos(CHALLENGED_PCT);
    var rows = ents.map(function (e) {
      var vp = e.variancePct, cls = varClass(vp), p = pos(vp);
      var left = Math.min(p, zero), width = Math.abs(p - zero);
      var clickable = e.shop ? ' data-shop="' + esc(e.key) + '" role="button" tabindex="0"' : '';
      return '<div class="ra-row' + (e.shop ? ' clickable' : '') + '"' + clickable + '>' +
        '<span class="ra-name" title="' + esc(e.name) + '">' + esc(e.name) + '</span>' +
        '<span class="ra-track"><span class="ra-zero" style="left:' + zero + '%"></span>' +
        '<span class="ra-thresh" style="left:' + thr + '%"></span>' +
        '<span class="ra-bar ' + cls + '" style="left:' + left + '%;width:' + width + '%"></span></span>' +
        '<span class="ra-val ' + cls + '">' + pctStr(vp) + '</span></div>';
    }).join('');
    return '<div class="ra-legend"><span class="ra-thresh-key"></span> ' + Math.round(CHALLENGED_PCT * 100) + '% challenged line · worst first</div>' +
      '<div class="ra-rows">' + (rows || '<div class="ctx-sub" style="padding:10px">No shops in scope.</div>') + '</div>';
  }

  function challengedListHTML(ids) {
    if (!ids.length) return '<div class="mk-table-wrap"><div class="ctx-sub" style="padding:14px">No challenged shops in this scope for the selected period. 🎉</div></div>';
    var rows = ids.map(function (id) { return { id: id, d: shopData(id), rv: revFor(id, kpiState.period) }; })
      .sort(function (a, b) { return a.rv.variancePct - b.rv.variancePct; });
    var head = '<tr><th>Shop</th><th>Market</th><th class="num">Actual</th><th class="num">Target</th><th class="num">Variance</th>' +
      FUNNEL.map(function (f) { return '<th class="num">' + esc(f.label.replace('Opportunity to ', '')) + '</th>'; }).join('') +
      '<th>Likely cause</th></tr>';
    var body = rows.map(function (row) {
      var d = row.d, rv = row.rv;
      var funCells = FUNNEL.map(function (f) { var v = d.funnel[f.key]; var pass = funnelPass(f, v); return '<td class="num ' + (pass ? 'ok' : 'bad') + '">' + fmtFunnel(f, v) + '</td>'; }).join('');
      var allPass = FUNNEL.every(function (f) { return funnelPass(f, d.funnel[f.key]); });
      var cause = allPass ? '<span class="cause carrier">Carrier score</span>' : '<span class="cause funnel">Funnel</span>';
      return '<tr data-shop="' + esc(row.id) + '" tabindex="0" role="button" aria-label="Open ' + esc(d.name) + '">' +
        '<td class="shop">' + esc(d.name) + (d.real ? '' : '') + '</td>' +
        '<td>' + esc(d.market) + '</td>' +
        '<td class="num">' + money(rv.actual) + '</td>' +
        '<td class="num">' + money(rv.target) + '</td>' +
        '<td class="num bad">' + moneySigned(rv.variance) + ' <span class="ra-pct">' + pctStr(rv.variancePct) + '</span></td>' +
        funCells + '<td>' + cause + '</td></tr>';
    }).join('');
    return '<div class="mk-table-wrap"><table class="mk-table challenged-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
  }

  function wireDashboard() {
    var pg = document.getElementById('dashPeriod');
    if (pg) pg.addEventListener('click', function (e) { var b = e.target.closest('[data-period]'); if (b) { kpiState.period = b.getAttribute('data-period'); renderKpiTab(); } });
    var gg = document.getElementById('dashGran');
    if (gg) gg.addEventListener('click', function (e) { var b = e.target.closest('[data-gran]'); if (b) { kpiState.gran = b.getAttribute('data-gran'); renderKpiTab(); } });
    var mk = document.getElementById('dashMarket');
    if (mk) mk.addEventListener('change', function () { kpiState.market = mk.value; renderKpiTab(); });
    var root = document.getElementById('kpiRoot');
    root.addEventListener('click', function (e) { var row = e.target.closest('[data-shop]'); if (row) openShop(row.getAttribute('data-shop')); });
    root.addEventListener('keydown', function (e) { if (e.key !== 'Enter') return; var row = e.target.closest('[data-shop]'); if (row) openShop(row.getAttribute('data-shop')); });
  }
  function openShop(id) { kpiState.view = 'shop'; kpiState.shopId = id; kpiState.carriers = null; kpiState.carrierOpen = null; kpiState.roCarrier = null; renderKpiTab(); }
  function backToDashboard() { kpiState.view = 'dashboard'; kpiState.shopId = null; renderKpiTab(); }

  /* ====================== shop detail ====================== */
  function renderShopDetail(id) {
    var root = document.getElementById('kpiRoot'); if (!root) return;
    var d = shopData(id);
    if (!d) { root.innerHTML = '<div class="ctx-sub" style="padding:20px">Shop not found.</div>'; return; }
    var rv = revFor(id, kpiState.period), challenged = rv.variancePct <= CHALLENGED_PCT;
    var back = (state.role !== 'gm') ? '<button type="button" class="link-btn" id="kpiBack">← Back to dashboard</button>' : '';
    var html = '';
    html += '<div class="kpi-head">' + back +
      '<p class="kpi-title" data-testid="kpi-page-title">' + esc(d.name) + (challenged ? ' <span class="chal-badge">Challenged</span>' : '') + '</p>' +
      '<p class="mk-lead">' + esc(d.market) + ' · ' + esc(d.region) + (d.carrierOnly ? ' · <b>funnel on target — carrier score is the likely cause</b>' : '') + '</p></div>';

    // funnel metrics vs target (shown first on the shop detail)
    html += '<div class="kpi-section"><div class="kpi-section-title">Opportunity funnel — vs target</div>' +
      '<div class="kpi-funnel">' + FUNNEL.map(function (f) {
        return funnelBoxHTML(funnelAsMetric(f), d.funnel[f.key]);
      }).join('') + '</div>' +
      '</div>';

    // revenue block
    var periodBtns = periodBtnsHTML();
    html += '<div class="kpi-section"><div class="kpi-section-title">Revenue attainment</div>' +
      '<div class="rev-grid">' +
        '<div class="rev-tile"><span class="rev-l">Actual</span><b class="rev-v">' + money(rv.actual) + '</b></div>' +
        '<div class="rev-tile"><span class="rev-l">Target</span><b class="rev-v muted">' + money(rv.target) + '</b></div>' +
        '<div class="rev-tile"><span class="rev-l">Variance</span><b class="rev-v ' + varClass(rv.variancePct) + '">' + moneySigned(rv.variance) + '</b></div>' +
        '<div class="rev-tile"><span class="rev-l">Variance %</span><b class="rev-v ' + varClass(rv.variancePct) + '">' + pctStr(rv.variancePct) + '</b></div>' +
      '</div>' +
      '<div class="seg-group rev-period" id="detailPeriod" role="group" aria-label="Period">' + periodBtns + '</div>' +
      '<div class="rev-chart" id="revChart">' + trendChartHTML(d) + '</div>' +
      '</div>';

    // carrier panel
    html += '<div class="kpi-section" id="carrierPanel">' + carrierPanelHTML(d) + '</div>';

    root.innerHTML = html;
    wireShopDetail(d);
  }

  /* shop-level trend chart — revenue plus optional funnel KPIs.
     Up to two series at once; when the two use different units a second
     y-axis is drawn on the right so each keeps its own scale. */
  function funnelTarget(k) { var f = FUNNEL.filter(function (x) { return x.key === k; })[0]; return f ? f.target : null; }
  var SHOP_KPIS = [
    { key: 'revenue',  label: 'Revenue',        unit: '$', color: '#00529b',
      series: function (d) { return d.months.map(function (m) { return { label: m.label, value: m.actual }; }); },
      target: function (d) { return d.months.map(function (m) { return m.target; }); } },
    { key: 'estimate', label: 'Opp → Estimate', unit: '%', color: '#2e7d32', goal: funnelTarget('estimate'),
      series: function (d) { return d.funnel.trend.estimate; } },
    { key: 'ro',       label: 'Opp → RO',       unit: '%', color: '#c1660f', goal: funnelTarget('ro'),
      series: function (d) { return d.funnel.trend.ro; } },
    { key: 'arrive',   label: 'Opp → Arrive',   unit: 'd', color: '#7a5ea8', goal: funnelTarget('arrive'),
      series: function (d) { return d.funnel.trend.arrive; } }
  ];
  // axis tick label — precision adapts to the axis span so a narrow % band doesn't print duplicate ticks
  function fmtAxis(unit, v, span) {
    if (unit === '$') return money(v);
    if (unit === 'd') return (Math.round(v * 10) / 10) + 'd';
    return (span < 6 ? (Math.round(v * 10) / 10) : Math.round(v)) + '%';
  }
  function kpiByKey(k) { for (var i = 0; i < SHOP_KPIS.length; i++) if (SHOP_KPIS[i].key === k) return SHOP_KPIS[i]; return null; }
  function chartKeys() {
    var sel = (kpiState.chartKpis && kpiState.chartKpis.length ? kpiState.chartKpis : ['revenue']).slice(0, 2);
    sel = sel.filter(function (k) { return kpiByKey(k); });
    return sel.length ? sel : ['revenue'];
  }
  function chartWindow() {
    var pd = PERIODS.filter(function (p) { return p.key === kpiState.period; })[0] || PERIODS[0];
    var end = 12 - (pd.offset || 0), n = Math.max(pd.months, 3);  // at least 3 months of context, ending at the period
    return { start: Math.max(0, end - n), end: end };
  }

  function trendChartHTML(d) {
    var win = chartWindow(), keys = chartKeys();
    var series = keys.map(function (k) { var def = kpiByKey(k); return { def: def, pts: def.series(d).slice(win.start, win.end) }; });
    var labels = series[0].pts.map(function (p) { return p.label; });
    var W = 640, H = 172, padT = 10, mB = 18;
    var dual = series.length === 2 && series[0].def.unit !== series[1].def.unit;  // right axis only when units differ
    var mL = 52, mR = dual ? 52 : 16;
    function X(i) { return mL + (W - mL - mR) * (labels.length < 2 ? 0.5 : i / (labels.length - 1)); }

    // revenue's target-over-time line shows whenever revenue is plotted, on whichever axis revenue sits
    var revIdx = keys.indexOf('revenue'), showTarget = revIdx >= 0;
    var targetVals = showTarget ? kpiByKey('revenue').target(d).slice(win.start, win.end) : null;
    var revOnRight = showTarget && dual && revIdx === 1;

    function rangeOf(ptsArrays, extra) {
      var vs = []; ptsArrays.forEach(function (pts) { pts.forEach(function (p) { vs.push(p.value); }); });
      if (extra) extra.forEach(function (v) { vs.push(v); });
      var lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs), span = hi - lo;
      var pad = span ? span * 0.12 : (Math.abs(hi) * 0.1 || 1);
      return { lo: lo - pad, hi: hi + pad };
    }
    // each axis's range folds in its series' goal(s) and — for revenue's axis — the target, so those lines stay on-chart
    var leftSeries = dual ? [series[0]] : series;
    var leftExtra = [];
    leftSeries.forEach(function (s) { if (s.def.goal != null) leftExtra.push(s.def.goal); });
    if (showTarget && !revOnRight) targetVals.forEach(function (v) { leftExtra.push(v); });
    var L = rangeOf(leftSeries.map(function (s) { return s.pts; }), leftExtra);
    var R = null;
    if (dual) {
      var rightExtra = [];
      if (series[1].def.goal != null) rightExtra.push(series[1].def.goal);
      if (revOnRight) targetVals.forEach(function (v) { rightExtra.push(v); });
      R = rangeOf([series[1].pts], rightExtra);
    }
    function Y(range, v) { return padT + (H - padT - mB) * (1 - (v - range.lo) / ((range.hi - range.lo) || 1)); }
    function yFor(si, v) { return Y((dual && si === 1) ? R : L, v); }

    var svg = '';
    if (showTarget) {
      var tp = targetVals.map(function (v, i) { return X(i) + ',' + yFor(revIdx, v).toFixed(1); }).join(' ');
      svg += '<polyline fill="none" stroke="#9aa7b4" stroke-width="1.8" stroke-dasharray="1 5" stroke-linecap="round" points="' + tp + '"/>';
    }
    // goal reference line for any plotted KPI that has one (Opp → Estimate 80%, Opp → RO 70%, Opp → Arrive 7d)
    series.forEach(function (s, si) {
      if (s.def.goal == null) return;
      var gy = yFor(si, s.def.goal), gl = 'Goal ' + s.def.goal + (s.def.unit === '%' ? '%' : s.def.unit === 'd' ? 'd' : '');
      var onLeft = dual && si === 1;   // right-axis series labels on the left so two goals never overlap at the right edge
      svg += '<line x1="' + mL + '" y1="' + gy.toFixed(1) + '" x2="' + (W - mR) + '" y2="' + gy.toFixed(1) + '" stroke="' + s.def.color + '" stroke-width="1.2" stroke-dasharray="5 4" opacity="0.55"/>';
      svg += '<text x="' + (onLeft ? (mL + 3) : (W - mR - 3)) + '" y="' + (gy - 4).toFixed(1) + '" class="rc-goal" text-anchor="' + (onLeft ? 'start' : 'end') + '" fill="' + s.def.color + '">' + esc(gl) + '</text>';
    });
    series.forEach(function (s, si) {
      var pts = s.pts.map(function (p, i) { return X(i) + ',' + yFor(si, p.value); }).join(' ');
      svg += '<polyline fill="none" stroke="' + s.def.color + '" stroke-width="2" points="' + pts + '"/>';
      svg += s.pts.map(function (p, i) { return '<circle cx="' + X(i) + '" cy="' + yFor(si, p.value) + '" r="2.5" fill="' + s.def.color + '"/>'; }).join('');
    });
    svg += labels.map(function (lab, i) { return '<text x="' + X(i) + '" y="' + (H - 4) + '" class="rc-x">' + esc(lab) + '</text>'; }).join('');
    function axis(range, unit, xText, anchor, color) {
      var out = '', span = range.hi - range.lo;
      for (var t = 0; t <= 2; t++) {
        var frac = t / 2, val = range.hi - span * frac, y = padT + (H - padT - mB) * frac;
        out += '<text x="' + xText + '" y="' + (y + 3) + '" class="rc-ax" text-anchor="' + anchor + '"' + (color ? ' fill="' + color + '"' : '') + '>' + esc(fmtAxis(unit, val, span)) + '</text>';
      }
      return out;
    }
    svg += axis(L, series[0].def.unit, mL - 6, 'end', dual ? series[0].def.color : null);
    if (dual) svg += axis(R, series[1].def.unit, W - mR + 6, 'start', series[1].def.color);

    var titleTxt = series.map(function (s) { return s.def.label; }).join(' vs ');
    var subTxt = (win.end - win.start) + '-mo trend';
    var btns = SHOP_KPIS.map(function (k) {
      var on = keys.indexOf(k.key) >= 0;
      return '<button type="button" class="kser' + (on ? ' on' : '') + '" data-kpi="' + k.key + '" aria-pressed="' + on + '">' +
        '<span class="kser-dot" style="background:' + k.color + '"></span>' + esc(k.label) + '</button>';
    }).join('');
    var legend = series.map(function (s, i) {
      return '<span class="rc-item"><span class="rc-k" style="background:' + s.def.color + '"></span>' + esc(s.def.label) +
        (dual && i === 1 ? ' <span class="rc-side">right axis</span>' : '') + '</span>';
    }).join('');
    if (showTarget) legend += '<span class="rc-item"><span class="rc-k tgt"></span>Target</span>';

    return '<div class="rc-head"><div class="rc-title">' + esc(titleTxt) + ' <span class="rc-title-sub">· ' + subTxt + '</span></div>' +
      '<div class="kser-group" id="chartKpis" role="group" aria-label="Add KPIs to the trend chart">' + btns + '</div></div>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" class="rc-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + esc(titleTxt) + ' trend">' + svg + '</svg>' +
      '<div class="rc-legend">' + legend + '</div>';
  }

  /* ====================== carrier scorecard panel ====================== */
  function selectedCarriers(d) {
    var names = d.carriers.map(function (c) { return c.name; });
    if (kpiState.carriers === null) return names.slice();               // default: all
    return names.filter(function (n) { return kpiState.carriers.indexOf(n) >= 0; });
  }
  function carrierPanelHTML(d) {
    var sel = selectedCarriers(d);
    var chips = d.carriers.map(function (c) { var on = sel.indexOf(c.name) >= 0; return '<button type="button" class="carr-chip' + (on ? ' on' : '') + '" data-carrier="' + esc(c.name) + '" aria-pressed="' + on + '">' + esc(c.name) + '</button>'; }).join('');
    var cards = d.carriers.filter(function (c) { return sel.indexOf(c.name) >= 0; }).map(function (c) { return carrierCardHTML(c); }).join('');
    // trend panel for the opened carrier (only while it is still in the selected set)
    var openCarrier = kpiState.carrierOpen ? d.carriers.filter(function (c) { return c.name === kpiState.carrierOpen && sel.indexOf(c.name) >= 0; })[0] : null;
    var trendHTML = openCarrier ? carrierTrendPanelHTML(openCarrier) : '';
    return '<div class="kpi-section-title">Carrier scorecard <span class="ctx-sub">(DRP · ' + d.carriers.length + ' carriers with volume)</span></div>' +
      '<div class="carr-chips" id="carrChips" role="group" aria-label="Filter carriers">' + chips + '</div>' +
      '<div class="carr-cards" id="carrCards">' + cards + '</div>' +
      trendHTML +
      '<div class="ro-detail">' + repairOrderPanelHTML(d) + '</div>';
  }
  /* Repair-order-level detail — one row per RO. Row count per carrier equals that
     carrier's repair volume, so the totals match the carrier cards. Columns carry
     the same metrics as the trend charts, plus a rules-not-adhered count. */
  var _roCache = {};
  function repairOrders(d) {
    if (_roCache[d.id]) return _roCache[d.id];
    var out = [], seq = 100000 + (hashStr(d.id) % 800000);
    d.carriers.forEach(function (c) {
      var vol = Math.max(0, Math.round(c.volume)), rr = mulberry(hashStr('ro:' + d.id + ':' + c.name));
      for (var i = 0; i < vol; i++) {
        var estAcc = Math.round(clamp(c.vars.estAccuracy + (rr() * 12 - 6), 62, 100) * 10) / 10;
        var adh = Math.round(clamp(c.vars.rulesAdherence + (rr() * 34 - 17), 30, 100) * 10) / 10;
        var cyc = Math.round(clamp(c.vars.cycleTime + (rr() * 8 - 4), 2, 30) * 10) / 10;
        var csi = Math.round(clamp(c.vars.csi + (rr() * 14 - 7), 60, 100));
        var triggered = 3 + Math.floor(rr() * 6), notAdh = Math.max(0, Math.round(triggered * (1 - adh / 100)));
        out.push({ id: 'RO-' + (seq++), carrier: c.name, score: c.score, estAcc: estAcc, adh: adh, notAdh: notAdh, cyc: cyc, csi: csi });
      }
    });
    _roCache[d.id] = out;
    return out;
  }
  function repairOrderPanelHTML(d) {
    var all = repairOrders(d), roCarrier = kpiState.roCarrier;
    if (roCarrier && !d.carriers.some(function (c) { return c.name === roCarrier; })) roCarrier = null;
    var rows = (roCarrier ? all.filter(function (r) { return r.carrier === roCarrier; }) : all)
      .slice().sort(function (a, b) { return (b.notAdh - a.notAdh) || (b.cyc - a.cyc); });   // worst first
    var total = rows.length, CAP = 200, shown = rows.slice(0, CAP);
    var options = '<option value="">All carriers</option>' + d.carriers.map(function (c) {
      return '<option value="' + esc(c.name) + '"' + (roCarrier === c.name ? ' selected' : '') + '>' + esc(c.name) + ' (' + Math.round(c.volume) + ')</option>';
    }).join('');
    var body = shown.map(function (r) {
      return '<tr><td class="ro-id">' + esc(r.id) + '</td><td>' + esc(r.carrier) + '</td>' +
        '<td class="num">' + r.score + '</td><td class="num">' + r.estAcc + '%</td><td class="num">' + r.adh + '%</td>' +
        '<td class="num' + (r.notAdh > 0 ? ' warn' : '') + '">' + r.notAdh + '</td>' +
        '<td class="num">' + r.cyc + 'd</td><td class="num">' + r.csi + '</td></tr>';
    }).join('') || '<tr><td colspan="8" class="ctx-sub" style="padding:12px">No repair orders.</td></tr>';
    var table = '<table class="mk-table ro-table"><thead><tr>' +
      '<th>Repair order</th><th>Carrier</th><th class="num">Score</th><th class="num">Est. accuracy</th>' +
      '<th class="num">Rules adherence</th><th class="num">Rules not adhered</th><th class="num">Cycle time</th><th class="num">CSI</th>' +
      '</tr></thead><tbody>' + body + '</tbody></table>';
    var note = 'Showing ' + shown.length + ' of ' + total + ' repair orders' + (roCarrier ? ' · ' + esc(roCarrier) : ' this month') +
      (shown.length < total ? ' — filter by a carrier to see the rest' : '');
    return '<div class="ro-head"><div class="kpi-section-title sub">Repair order detail <span class="ctx-sub">(' + esc(MONTH_ABBR[CUR_MONTH]) + ' · key = repair order ID)</span></div>' +
      '<label class="ro-filter">Carrier <select id="roCarrier">' + options + '</select></label></div>' +
      '<div class="mk-table-wrap ro-scroll">' + table + '</div>' +
      '<div class="ro-note ctx-sub">' + note + '</div>';
  }
  /* carrier metrics that can be trended over time (one at a time) */
  var CARRIER_METRICS = [
    { key: 'score',           label: 'Score',             unit: '',      color: '#00529b' },
    { key: 'volume',          label: 'Repair volume',     unit: 'n',     color: '#2b7a8e' },
    { key: 'estAccuracy',     label: 'Estimate accuracy', unit: '%',     color: '#2e7d32' },
    { key: 'rulesAdherence', label: 'Rules Adherence %', unit: '%', color: '#c1660f' },
    { key: 'cycleTime',       label: 'Total cycle time',  unit: 'd',     color: '#7a5ea8' },
    { key: 'csi',             label: 'CSI',               unit: '',      color: '#b0357a' }
  ];
  function carrierMetricByKey(k) { for (var i = 0; i < CARRIER_METRICS.length; i++) if (CARRIER_METRICS[i].key === k) return CARRIER_METRICS[i]; return CARRIER_METRICS[0]; }
  function fmtCarrier(unit, v, span) {
    if (unit === '%') return (span != null && span < 6 ? (Math.round(v * 10) / 10) : Math.round(v)) + '%';
    if (unit === 'd') return (Math.round(v * 10) / 10) + 'd';
    return '' + Math.round(v);   // score / CSI / repair volume (count)
  }
  function carrierTrendPanelHTML(c) {
    var m = carrierMetricByKey(kpiState.carrierMetric), win = chartWindow();
    var pts = (c.trends[m.key] || c.trends.score).slice(win.start, win.end);
    var labels = pts.map(function (p) { return p.label; });
    var W = 640, H = 150, padT = 10, mB = 18, mL = 52, mR = 16;
    function X(i) { return mL + (W - mL - mR) * (labels.length < 2 ? 0.5 : i / (labels.length - 1)); }
    var vs = pts.map(function (p) { return p.value; });
    var lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs), s0 = hi - lo;
    var pad = s0 ? s0 * 0.14 : (Math.abs(hi) * 0.1 || 1), lo2 = lo - pad, hi2 = hi + pad;
    if (m.unit === '%') { hi2 = Math.min(hi2, 100); lo2 = Math.max(lo2, 0); }   // a rate can't exceed 100% or go negative
    var span = hi2 - lo2;
    function Y(v) { return padT + (H - padT - mB) * (1 - (v - lo2) / (span || 1)); }
    var line = pts.map(function (p, i) { return X(i) + ',' + Y(p.value); }).join(' ');
    var dots = pts.map(function (p, i) { return '<circle cx="' + X(i) + '" cy="' + Y(p.value) + '" r="2.5" fill="' + m.color + '"/>'; }).join('');
    var xlabs = labels.map(function (lab, i) { return '<text x="' + X(i) + '" y="' + (H - 4) + '" class="rc-x">' + esc(lab) + '</text>'; }).join('');
    // three ticks; add a decimal only when whole-number ticks would collide (flat count series)
    var tickV = [hi2, hi2 - span / 2, lo2];
    var needDec = m.unit === '%' ? span < 6 : m.unit === 'd' ? true
      : (function () { var il = tickV.map(function (v) { return '' + Math.round(v); }); return il[0] === il[1] || il[1] === il[2] || il[0] === il[2]; })();
    function fmtTick(v) {
      if (m.unit === '%') return (needDec ? (Math.round(v * 10) / 10) : Math.round(v)) + '%';
      if (m.unit === 'd') return (Math.round(v * 10) / 10) + 'd';
      return '' + (needDec ? (Math.round(v * 10) / 10) : Math.round(v));
    }
    var axis = tickV.map(function (v, t) { var y = padT + (H - padT - mB) * (t / 2); return '<text x="' + (mL - 6) + '" y="' + (y + 3) + '" class="rc-ax" text-anchor="end">' + esc(fmtTick(v)) + '</text>'; }).join('');
    var btns = CARRIER_METRICS.map(function (mm) {
      var on = mm.key === m.key;
      return '<button type="button" class="kser' + (on ? ' on' : '') + '" data-cmetric="' + mm.key + '" aria-pressed="' + on + '">' +
        '<span class="kser-dot" style="background:' + mm.color + '"></span>' + esc(mm.label) + '</button>';
    }).join('');
    var latest = pts[pts.length - 1].value;   // last point actually shown in the window
    return '<div class="carr-trend" id="carrTrend">' +
      '<div class="rc-head"><div class="rc-title">' + esc(c.name) + ' · ' + esc(m.label) + ' <span class="rc-title-sub">· ' + fmtCarrier(m.unit, latest, span) + ' latest · ' + (win.end - win.start) + '-mo</span></div>' +
      '<div class="rc-head-tools"><div class="seg-group" id="carrPeriod" role="group" aria-label="Period">' + periodBtnsHTML() + '</div>' +
      '<button type="button" class="link-btn ctrend-close" data-carrier-close="1">Close ✕</button></div></div>' +
      '<div class="kser-group" id="carrMetrics" role="group" aria-label="Select carrier metric to trend">' + btns + '</div>' +
      '<svg viewBox="0 0 ' + W + ' ' + H + '" class="rc-svg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="' + esc(c.name + ' ' + m.label) + ' trend">' +
      '<polyline fill="none" stroke="' + m.color + '" stroke-width="2" points="' + line + '"/>' + dots + xlabs + axis + '</svg>' +
      '</div>';
  }
  function carrierCardHTML(c) {
    var varsHTML = DRP.variables.map(function (v) {
      var cur = c.vars[v.key], avg = c.shopAvg[v.key];
      var better = v.direction === 'lower' ? cur <= avg : cur >= avg;
      var fmt = function (x) { return v.unit === '%' ? (Math.round(x * 10) / 10) + '%' : v.unit === 'days' ? (Math.round(x * 10) / 10) + 'd' : (Math.round(x * 10) / 10); };
      return '<div class="cv-row"><span class="cv-l">' + esc(v.label) + '</span>' +
        '<span class="cv-cur ' + (better ? 'ok' : 'bad') + '">' + fmt(cur) + '</span>' +
        '<span class="cv-avg">vs ' + fmt(avg) + ' avg</span></div>';
    }).join('');
    var scoreCls = c.score >= 80 ? 'ok' : c.score >= 65 ? 'warn' : 'bad';
    var open = kpiState.carrierOpen === c.name;
    return '<div class="carr-card' + (open ? ' open' : '') + '" data-carrier-card="' + esc(c.name) + '" role="button" tabindex="0" aria-expanded="' + open + '">' +
      '<div class="carr-top"><span class="carr-name">' + esc(c.name) + '</span><span class="carr-score ' + scoreCls + '">' + c.score + '<small>/100</small></span></div>' +
      '<div class="carr-sub">' + svgSpark(c.trend.map(function (p) { return p.value; }), '#00529b', 120, 26) + '<span class="carr-vol">' + c.volume + ' repairs</span></div>' +
      '<div class="cv-list">' + varsHTML + '</div>' +
      '<div class="carr-cta">' + (open ? 'Trend shown below ▾' : 'Click to trend a metric ▸') + '</div></div>';
  }

  function wireShopDetail(d) {
    var back = document.getElementById('kpiBack');
    if (back) back.addEventListener('click', backToDashboard);
    var pg = document.getElementById('detailPeriod');
    if (pg) pg.addEventListener('click', function (e) { var b = e.target.closest('[data-period]'); if (b) { kpiState.period = b.getAttribute('data-period'); renderKpiTab(); } });
    var kg = document.getElementById('chartKpis');
    if (kg) kg.addEventListener('click', function (e) {
      var b = e.target.closest('[data-kpi]'); if (!b) return;
      var k = b.getAttribute('data-kpi'), sel = chartKeys().slice(), i = sel.indexOf(k);
      if (i >= 0) { if (sel.length > 1) sel.splice(i, 1); }      // keep at least one series shown
      else { sel.push(k); if (sel.length > 2) sel.shift(); }     // cap at two, drop the oldest
      kpiState.chartKpis = sel;
      renderKpiTab();
    });
    function refreshPanel() {
      var panel = document.getElementById('carrierPanel');
      if (panel) { panel.innerHTML = carrierPanelHTML(shopData(kpiState.shopId || d.id)); wireShopDetail(d); }
    }
    var chips = document.getElementById('carrChips');
    if (chips) chips.addEventListener('click', function (e) {
      var b = e.target.closest('[data-carrier]'); if (!b) return;
      var name = b.getAttribute('data-carrier'), sel = selectedCarriers(d);
      var i = sel.indexOf(name);
      if (i >= 0) { if (sel.length > 1) sel.splice(i, 1); } else sel.push(name);
      kpiState.carriers = sel;
      refreshPanel();
    });
    // click a carrier card → toggle its trend panel
    var carrCards = document.getElementById('carrCards');
    function toggleCard(name) { kpiState.carrierOpen = (kpiState.carrierOpen === name) ? null : name; refreshPanel(); }
    if (carrCards) {
      carrCards.addEventListener('click', function (e) {
        var b = e.target.closest('[data-carrier-card]'); if (b) toggleCard(b.getAttribute('data-carrier-card'));
      });
      carrCards.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        var b = e.target.closest('[data-carrier-card]'); if (b) { e.preventDefault(); toggleCard(b.getAttribute('data-carrier-card')); }
      });
    }
    // time window inside the carrier view — shares the shop-detail period
    var cpg = document.getElementById('carrPeriod');
    if (cpg) cpg.addEventListener('click', function (e) { var b = e.target.closest('[data-period]'); if (b) { kpiState.period = b.getAttribute('data-period'); renderKpiTab(); } });
    // pick which metric to trend
    var cm = document.getElementById('carrMetrics');
    if (cm) cm.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cmetric]'); if (!b) return;
      kpiState.carrierMetric = b.getAttribute('data-cmetric');
      refreshPanel();
    });
    var cc = document.querySelector('[data-carrier-close]');
    if (cc) cc.addEventListener('click', function () { kpiState.carrierOpen = null; refreshPanel(); });
    // filter the repair-order detail table by carrier
    var roc = document.getElementById('roCarrier');
    if (roc) roc.addEventListener('change', function () { kpiState.roCarrier = roc.value || null; refreshPanel(); });
  }

  /* ====================== dispatch ====================== */
  function renderKpiTab() {
    var root = document.getElementById('kpiRoot'); if (!root) return;
    if (state.role === 'gm') { renderShopDetail(state.store); return; }
    if (kpiState.view === 'shop' && kpiState.shopId) { renderShopDetail(kpiState.shopId); return; }
    renderDashboard();
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
        ? rg.name + ' · ' + rg.division + ' — a roll-up across ' + rg.markets.length + ' markets, with a market-by-market scorecard. Drill into any market from the selector.'
        : 'One shop’s Action Plans and KPIs. Use the location selector to choose the shop.';
    }
    kpiState.view = 'dashboard'; kpiState.shopId = null; kpiState.market = 'all'; kpiState.gran = 'shops'; kpiState.carriers = null;
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
    if (view === 'kpis') renderKpiTab();
  }

  /* ---------------- init ---------------- */
  function init() {
    boardEl = document.getElementById('board');
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

    populate(rootFilter, DATA.rootCauses || [], 'Root Causes');
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
    fRoot = document.getElementById('fRoot');
    fStatus = document.getElementById('fStatus');
    fPriority = document.getElementById('fPriority');
    fDue = document.getElementById('fDue');
    fRisk = document.getElementById('fRisk');
    fBlocked = document.getElementById('fBlocked');
    fMetric = document.getElementById('fMetric');
    fLag = document.getElementById('fLag');
    logWrap = document.getElementById('logWrap');

    fStatus.innerHTML = COLUMNS.map(function (c) { return '<option value="' + c.key + '">' + esc(c.label) + '</option>'; }).join('');
    fPriority.innerHTML = PRIORITIES.map(function (p) { return '<option value="' + p.key + '">' + esc(p.label) + '</option>'; }).join('');
    fRoot.innerHTML = (DATA.rootCauses || []).map(function (r) { return '<option value="' + r.key + '">' + esc(r.label) + '</option>'; }).join('');
    fRole.setAttribute('list', 'roleOptions');
    document.getElementById('roleOptions').innerHTML = ['Market Manager (CPM)', 'RDO', 'Shop GM', 'Estimator', 'Body Technician', 'Refinish Technician', 'Painter', 'Parts Manager', 'CSR', 'National Account Manager', 'RVP', 'ADAS Calibration Tech', 'Facilities / Capex', 'HR Recruiter', 'Regional Fixed Ops', 'Sales Rep']
      .map(function (r) { return '<option value="' + esc(r) + '">'; }).join('');

    fPlan.addEventListener('change', function () { var pl = PLAN_BY_ID[fPlan.value]; if (pl) fRoot.value = pl.rootCauseCategory; renderContext(fPlan.value, editingId ? findTask(editingId) : null); });
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

    var rz; window.addEventListener('resize', function () { if (state.view !== 'kpis') return; clearTimeout(rz); rz = setTimeout(function () { renderKpiTab(); }, 200); });

    setStore(state.store);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
