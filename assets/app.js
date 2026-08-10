/* ============================================================
   The Hub — Action Plans (Kanban) tab
   Vanilla JS. State persists to localStorage. No build step.
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'hub.actionPlans.v1';

  var STATUSES = [
    { key: 'todo',     label: 'To Do',       col: 'col-todo' },
    { key: 'progress', label: 'In Progress', col: 'col-progress' },
    { key: 'blocked',  label: 'Blocked',     col: 'col-blocked' },
    { key: 'done',     label: 'Done',        col: 'col-done' }
  ];

  var PRIORITIES = [
    { key: 'urgent', label: 'Urgent', chip: 'chip-red' },
    { key: 'high',   label: 'High',   chip: 'chip-orange' },
    { key: 'medium', label: 'Medium', chip: 'chip-blue' },
    { key: 'low',    label: 'Low',    chip: 'chip-gray' }
  ];
  var PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };

  // Owners that feel native to the shop (free text is also allowed).
  var OWNERS = [
    'Andres V Perea Barrera', 'Body Team', 'Daniel Escareno', 'Ernesto Perea',
    'Kurt Schorsch', 'Front Office', 'Parts', 'Estimating', 'Management', 'Calibrations'
  ];
  var AVATAR_COLORS = ['#2b7a8e', '#00529b', '#6a4c93', '#b5179e', '#36832f',
                       '#c1660f', '#9d174d', '#006a64', '#3375af', '#5f5e5e'];

  var state = { items: [], filters: { search: '', owner: 'all', priority: 'all' }, sort: 'due' };
  var editingId = null;

  /* ---------- date helpers ---------- */
  function todayMidnight() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function isoOffset(days) {
    var d = todayMidnight(); d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parseISO(s) {
    if (!s) return null;
    var p = s.split('-'); if (p.length !== 3) return null;
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }
  function daysUntil(iso) {
    var d = parseISO(iso); if (!d) return null;
    return Math.round((d - todayMidnight()) / 86400000);
  }
  function formatDate(iso) {
    var d = parseISO(iso); if (!d) return '';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  /* ---------- misc helpers ---------- */
  function uid() { return 'ap_' + Math.random().toString(36).slice(2, 9); }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '—';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  function avatarColor(name) {
    var h = 0, s = String(name || '');
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }
  function priorityMeta(key) {
    for (var i = 0; i < PRIORITIES.length; i++) if (PRIORITIES[i].key === key) return PRIORITIES[i];
    return PRIORITIES[2];
  }

  /* ---------- persistence ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) { var p = JSON.parse(raw); if (p && Array.isArray(p.items)) { state.items = p.items; return true; } }
    } catch (e) { /* ignore */ }
    return false;
  }
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ items: state.items })); }
    catch (e) { /* storage may be unavailable */ }
  }

  function seed() {
    state.items = [
      { id: uid(), title: 'Order LKQ bumper cover for RO 32106', desc: 'Confirm color match with Ernesto before ordering. Prime + refinish scheduled Thu.', owner: 'Parts', priority: 'high', status: 'todo', due: isoOffset(1), tag: 'Parts', created: Date.now() - 5e7 },
      { id: uid(), title: 'Set rental for customer on RO 32120', desc: 'Enterprise pickup — cycle time now 9 days, notify customer of delay.', owner: 'Front Office', priority: 'medium', status: 'todo', due: isoOffset(2), tag: 'Customer', created: Date.now() - 4e7 },
      { id: uid(), title: 'Refresh DRP scorecard for weekly review', owner: 'Management', priority: 'low', status: 'todo', due: isoOffset(4), tag: 'Admin', created: Date.now() - 3e7 },
      { id: uid(), title: 'Reassemble 2022 Sonata (31985)', desc: 'Bumper repair complete, all parts here 8/6.', owner: 'Body Team', priority: 'high', status: 'progress', due: isoOffset(1), tag: 'Production', created: Date.now() - 6e7 },
      { id: uid(), title: 'Blueprint 2018 Explorer (32156)', desc: 'Tear-down + full supplement before EOD.', owner: 'Estimating', priority: 'medium', status: 'progress', due: isoOffset(0), tag: 'Blueprint', created: Date.now() - 2e7 },
      { id: uid(), title: 'Awaiting knee-part ETA for RO 32106', desc: 'Vendor has not confirmed. Escalate — holding refinish.', owner: 'Parts', priority: 'urgent', status: 'blocked', due: isoOffset(-1), tag: 'Parts', created: Date.now() - 7e7 },
      { id: uid(), title: 'Insurance approval on supplement (32112)', desc: 'Impact bar, lamp, resonator pending adjuster review.', owner: 'Estimating', priority: 'high', status: 'blocked', due: isoOffset(-2), tag: 'Insurance', created: Date.now() - 8e7 },
      { id: uid(), title: 'Deliver 2026 CR-V (32143)', desc: 'QC passed, customer notified.', owner: 'Front Office', priority: 'medium', status: 'done', due: isoOffset(-1), tag: 'Delivery', created: Date.now() - 9e7 },
      { id: uid(), title: 'Post-scan 2019 Altima (32164)', owner: 'Calibrations', priority: 'low', status: 'done', due: isoOffset(-1), tag: 'Calibration', created: Date.now() - 9.5e7 }
    ];
    save();
  }

  /* ---------- filtering / sorting ---------- */
  function visibleItems() {
    var f = state.filters, q = f.search.trim().toLowerCase();
    return state.items.filter(function (it) {
      if (f.owner !== 'all' && it.owner !== f.owner) return false;
      if (f.priority !== 'all' && it.priority !== f.priority) return false;
      if (q) {
        var hay = (it.title + ' ' + (it.desc || '') + ' ' + (it.owner || '') + ' ' + (it.tag || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }
  function sortItems(list) {
    var s = state.sort;
    return list.slice().sort(function (a, b) {
      if (s === 'priority') return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (s === 'created') return b.created - a.created;
      // due (default): items with a due date first, ascending; empty dates last
      var da = a.due ? parseISO(a.due).getTime() : Infinity;
      var db = b.due ? parseISO(b.due).getTime() : Infinity;
      return da - db;
    });
  }

  /* ---------- rendering ---------- */
  var boardEl, statTotal, statOverdue, statBlocked;

  function render() {
    var shown = visibleItems();
    var byStatus = {};
    STATUSES.forEach(function (s) { byStatus[s.key] = []; });
    shown.forEach(function (it) { (byStatus[it.status] || (byStatus[it.status] = [])).push(it); });

    boardEl.innerHTML = STATUSES.map(function (s) {
      var list = sortItems(byStatus[s.key] || []);
      var cards = list.length
        ? list.map(cardHTML).join('')
        : '<div class="col-empty">Nothing here yet</div>';
      return (
        '<section class="column ' + s.col + '" data-status="' + s.key + '" aria-label="' + esc(s.label) + '">' +
          '<div class="column-head">' +
            '<span class="column-dot"></span>' +
            '<span class="column-title">' + esc(s.label) + '</span>' +
            '<span class="count-badge">' + list.length + '</span>' +
          '</div>' +
          '<div class="cards">' + cards + '</div>' +
        '</section>'
      );
    }).join('');

    // stats reflect the full data set, not just the filtered view
    var overdue = 0, blocked = 0;
    state.items.forEach(function (it) {
      if (it.status !== 'done' && it.due && daysUntil(it.due) < 0) overdue++;
      if (it.status === 'blocked') blocked++;
    });
    statTotal.textContent = state.items.length;
    statOverdue.textContent = overdue;
    statBlocked.textContent = blocked;
  }

  function cardHTML(it) {
    var pm = priorityMeta(it.priority);
    var idx = statusIndex(it.status);
    var dueHTML = '';
    if (it.due) {
      var du = daysUntil(it.due), cls = '', label = formatDate(it.due);
      if (it.status !== 'done') {
        if (du < 0) { cls = ' overdue'; label = 'Overdue · ' + label; }
        else if (du <= 1) { cls = ' soon'; label = (du === 0 ? 'Due today' : 'Due tomorrow'); }
      }
      dueHTML = '<span class="due' + cls + '">' + calendarIcon() + esc(label) + '</span>';
    } else {
      dueHTML = '<span class="due">No due date</span>';
    }

    var tagHTML = it.tag ? '<span class="chip chip-gray">' + esc(it.tag) + '</span>' : '';

    return (
      '<article class="card p-' + esc(it.priority) + '" draggable="true" data-id="' + esc(it.id) + '" tabindex="0" role="button" aria-label="Edit action: ' + esc(it.title) + '">' +
        '<div class="card-top">' +
          '<div class="card-title">' + esc(it.title) + '</div>' +
        '</div>' +
        (it.desc ? '<div class="card-desc">' + esc(it.desc) + '</div>' : '') +
        '<div class="card-meta">' +
          '<span class="chip ' + pm.chip + '"><span class="dot" style="background:' + priorityDot(it.priority) + '"></span>' + esc(pm.label) + '</span>' +
          tagHTML +
        '</div>' +
        '<div class="card-foot">' +
          '<span class="owner">' + avatarHTML(it.owner) + esc(it.owner || 'Unassigned') + '</span>' +
          dueHTML +
        '</div>' +
        '<div class="card-foot" style="border-top:none;padding-top:0;">' +
          '<div class="card-moves">' +
            '<button class="mini-btn" data-move="prev" data-id="' + esc(it.id) + '" title="Move to ' + (idx > 0 ? esc(STATUSES[idx - 1].label) : '') + '" aria-label="Move left"' + (idx === 0 ? ' disabled' : '') + '>' + chevronLeft() + '</button>' +
            '<button class="mini-btn" data-move="next" data-id="' + esc(it.id) + '" title="Move to ' + (idx < STATUSES.length - 1 ? esc(STATUSES[idx + 1].label) : '') + '" aria-label="Move right"' + (idx === STATUSES.length - 1 ? ' disabled' : '') + '>' + chevronRight() + '</button>' +
          '</div>' +
          '<button class="mini-btn" data-edit="' + esc(it.id) + '" title="Edit" aria-label="Edit action">' + editIcon() + '</button>' +
        '</div>' +
      '</article>'
    );
  }

  function avatarHTML(name) {
    return '<span class="avatar" style="background:' + avatarColor(name) + '">' + esc(initials(name)) + '</span>';
  }
  function priorityDot(key) {
    return { urgent: '#ba1a1a', high: '#c1660f', medium: '#2b7a8e', low: '#787777' }[key] || '#787777';
  }
  function statusIndex(key) { for (var i = 0; i < STATUSES.length; i++) if (STATUSES[i].key === key) return i; return 0; }

  /* ---------- inline SVG icons ---------- */
  function calendarIcon() { return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2m0 16H5V10h14zm0-12H5V6h14z"/></svg>'; }
  function chevronLeft() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>'; }
  function chevronRight() { return '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.59 16.59 13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>'; }
  function editIcon() { return '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z"/></svg>'; }

  /* ---------- board interactions (event delegation) ---------- */
  function onBoardClick(e) {
    var moveBtn = e.target.closest('[data-move]');
    if (moveBtn) { e.stopPropagation(); moveItem(moveBtn.getAttribute('data-id'), moveBtn.getAttribute('data-move')); return; }
    var editBtn = e.target.closest('[data-edit]');
    if (editBtn) { e.stopPropagation(); openModal(editBtn.getAttribute('data-edit')); return; }
    var card = e.target.closest('.card');
    if (card) openModal(card.getAttribute('data-id'));
  }
  function onBoardKey(e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var card = e.target.closest('.card');
    if (card && e.target === card) { e.preventDefault(); openModal(card.getAttribute('data-id')); }
  }

  function moveItem(id, dir) {
    var it = findItem(id); if (!it) return;
    var idx = statusIndex(it.status) + (dir === 'next' ? 1 : -1);
    if (idx < 0 || idx >= STATUSES.length) return;
    it.status = STATUSES[idx].key;
    save(); render();
  }
  function findItem(id) { for (var i = 0; i < state.items.length; i++) if (state.items[i].id === id) return state.items[i]; return null; }

  /* ---------- drag & drop ---------- */
  var dragId = null;
  function onDragStart(e) {
    var card = e.target.closest('.card'); if (!card) return;
    dragId = card.getAttribute('data-id');
    card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', dragId); } catch (err) {}
  }
  function onDragEnd(e) {
    var card = e.target.closest('.card'); if (card) card.classList.remove('dragging');
    dragId = null;
    Array.prototype.forEach.call(document.querySelectorAll('.column.drag-over'),
      function (c) { c.classList.remove('drag-over'); });
  }
  function onDragOver(e) {
    var col = e.target.closest('.column'); if (!col) return;
    e.preventDefault(); e.dataTransfer.dropEffect = 'move';
    col.classList.add('drag-over');
  }
  function onDragLeave(e) {
    var col = e.target.closest('.column'); if (!col) return;
    if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over');
  }
  function onDrop(e) {
    var col = e.target.closest('.column'); if (!col) return;
    e.preventDefault();
    var id = dragId; try { id = e.dataTransfer.getData('text/plain') || dragId; } catch (err) {}
    var it = findItem(id);
    if (it) { it.status = col.getAttribute('data-status'); save(); render(); }
    col.classList.remove('drag-over');
  }

  /* ---------- modal ---------- */
  var overlay, form, fTitle, fDesc, fOwner, fPriority, fStatus, fDue, fTag,
      modalTitle, deleteBtn, ownerList;

  function openModal(id) {
    editingId = id || null;
    var it = id ? findItem(id) : null;
    modalTitle.textContent = it ? 'Edit action' : 'New action';
    deleteBtn.style.display = it ? 'inline-flex' : 'none';

    fTitle.value = it ? it.title : '';
    fDesc.value = it ? (it.desc || '') : '';
    fOwner.value = it ? (it.owner || '') : '';
    fPriority.value = it ? it.priority : 'medium';
    fStatus.value = it ? it.status : 'todo';
    fDue.value = it ? (it.due || '') : '';
    fTag.value = it ? (it.tag || '') : '';
    clearInvalid();

    overlay.classList.add('open');
    setTimeout(function () { fTitle.focus(); }, 30);
  }
  function closeModal() { overlay.classList.remove('open'); editingId = null; }

  function clearInvalid() {
    var r = fTitle.closest('.form-row'); if (r) r.classList.remove('invalid');
  }

  function submitForm(e) {
    e.preventDefault();
    var title = fTitle.value.trim();
    if (!title) {
      var r = fTitle.closest('.form-row'); if (r) r.classList.add('invalid');
      fTitle.focus(); return;
    }
    var data = {
      title: title,
      desc: fDesc.value.trim(),
      owner: fOwner.value.trim(),
      priority: fPriority.value,
      status: fStatus.value,
      due: fDue.value || '',
      tag: fTag.value.trim()
    };
    if (editingId) {
      var it = findItem(editingId);
      if (it) { for (var k in data) it[k] = data[k]; }
      toast('Action updated');
    } else {
      data.id = uid(); data.created = Date.now();
      state.items.push(data);
      toast('Action added');
    }
    save(); render(); closeModal();
  }

  function deleteCurrent() {
    if (!editingId) return;
    state.items = state.items.filter(function (it) { return it.id !== editingId; });
    save(); render(); closeModal(); toast('Action deleted');
  }

  /* ---------- toast ---------- */
  var toastEl, toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1900);
  }

  /* ---------- wire up ---------- */
  function populateSelect(sel, options, includeAll, allLabel) {
    var html = includeAll ? '<option value="all">' + esc(allLabel) + '</option>' : '';
    html += options.map(function (o) {
      var val = typeof o === 'string' ? o : o.key;
      var lab = typeof o === 'string' ? o : o.label;
      return '<option value="' + esc(val) + '">' + esc(lab) + '</option>';
    }).join('');
    sel.innerHTML = html;
  }

  function init() {
    boardEl = document.getElementById('board');
    statTotal = document.getElementById('statTotal');
    statOverdue = document.getElementById('statOverdue');
    statBlocked = document.getElementById('statBlocked');
    toastEl = document.getElementById('toast');

    // toolbar controls
    var search = document.getElementById('searchInput');
    var ownerFilter = document.getElementById('ownerFilter');
    var priorityFilter = document.getElementById('priorityFilter');
    var sortSelect = document.getElementById('sortSelect');

    populateSelect(ownerFilter, OWNERS, true, 'All owners');
    populateSelect(priorityFilter, PRIORITIES, true, 'All priorities');

    search.addEventListener('input', function () { state.filters.search = search.value; render(); });
    ownerFilter.addEventListener('change', function () { state.filters.owner = ownerFilter.value; render(); });
    priorityFilter.addEventListener('change', function () { state.filters.priority = priorityFilter.value; render(); });
    sortSelect.addEventListener('change', function () { state.sort = sortSelect.value; render(); });

    document.getElementById('newBtn').addEventListener('click', function () { openModal(null); });

    // overflow menu
    var menuBtn = document.getElementById('menuBtn');
    var menu = document.getElementById('menu');
    menuBtn.addEventListener('click', function (e) { e.stopPropagation(); menu.classList.toggle('open'); });
    document.addEventListener('click', function () { menu.classList.remove('open'); });
    document.getElementById('resetBtn').addEventListener('click', function () {
      if (confirm('Reset the board to the sample action plans?')) { seed(); render(); toast('Sample data restored'); }
    });
    document.getElementById('clearBtn').addEventListener('click', function () {
      if (confirm('Remove all actions? This cannot be undone.')) { state.items = []; save(); render(); toast('Board cleared'); }
    });

    // board delegation
    boardEl.addEventListener('click', onBoardClick);
    boardEl.addEventListener('keydown', onBoardKey);
    boardEl.addEventListener('dragstart', onDragStart);
    boardEl.addEventListener('dragend', onDragEnd);
    boardEl.addEventListener('dragover', onDragOver);
    boardEl.addEventListener('dragleave', onDragLeave);
    boardEl.addEventListener('drop', onDrop);

    // modal
    overlay = document.getElementById('overlay');
    form = document.getElementById('actionForm');
    fTitle = document.getElementById('fTitle');
    fDesc = document.getElementById('fDesc');
    fOwner = document.getElementById('fOwner');
    fPriority = document.getElementById('fPriority');
    fStatus = document.getElementById('fStatus');
    fDue = document.getElementById('fDue');
    fTag = document.getElementById('fTag');
    modalTitle = document.getElementById('modalTitle');
    deleteBtn = document.getElementById('deleteBtn');
    ownerList = document.getElementById('ownerOptions');

    populateSelect(fPriority, PRIORITIES, false);
    populateSelect(fStatus, STATUSES, false);
    ownerList.innerHTML = OWNERS.map(function (o) { return '<option value="' + esc(o) + '">'; }).join('');

    form.addEventListener('submit', submitForm);
    document.getElementById('cancelBtn').addEventListener('click', closeModal);
    deleteBtn.addEventListener('click', deleteCurrent);
    overlay.addEventListener('click', function (e) { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && overlay.classList.contains('open')) closeModal(); });
    fTitle.addEventListener('input', clearInvalid);

    // inert nav tabs (prototype)
    Array.prototype.forEach.call(document.querySelectorAll('.nav-item:not(.selected)'), function (btn) {
      btn.addEventListener('click', function () { toast(btn.getAttribute('data-label') + ' isn’t part of this prototype'); });
    });

    // data
    if (!load()) seed();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
