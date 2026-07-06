/* Idea Archive — all logic. No frameworks, no build step. */
'use strict';

var STORAGE_KEY = 'idea-archive-data';
var THEME_KEY = 'idea-archive-theme';

/* ============ State ============ */

function uid() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function defaultState() {
  return {
    version: 1,
    categories: [{ id: uid(), name: 'General' }],
    ideas: []
  };
}

function loadState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    var data = JSON.parse(raw);
    var check = validateData(data);
    if (!check.ok) return defaultState();
    return data;
  } catch (e) {
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    showToast('Could not save — storage may be full');
  }
}

var state = loadState();
saveState(); // persist seeded state on first run

/* Which ideas are expanded in the Ideas view */
var expandedIdeas = {};

/* ============ Validation (shared by load + restore) ============ */

function validateData(data) {
  if (!data || typeof data !== 'object') return { ok: false, error: 'Not a data object.' };
  if (!Array.isArray(data.categories)) return { ok: false, error: 'Missing categories list.' };
  if (!Array.isArray(data.ideas)) return { ok: false, error: 'Missing ideas list.' };

  var catIds = {};
  for (var i = 0; i < data.categories.length; i++) {
    var c = data.categories[i];
    if (!c || typeof c.id !== 'string' || typeof c.name !== 'string' || !c.name.trim()) {
      return { ok: false, error: 'Category #' + (i + 1) + ' is malformed.' };
    }
    catIds[c.id] = true;
  }

  for (var j = 0; j < data.ideas.length; j++) {
    var idea = data.ideas[j];
    if (!idea || typeof idea.id !== 'string' || typeof idea.topic !== 'string' || !idea.topic.trim()) {
      return { ok: false, error: 'Idea #' + (j + 1) + ' is malformed.' };
    }
    if (typeof idea.categoryId !== 'string' || !catIds[idea.categoryId]) {
      return { ok: false, error: 'Idea "' + idea.topic.slice(0, 30) + '" points to a missing category.' };
    }
    if (typeof idea.createdAt !== 'string' || isNaN(Date.parse(idea.createdAt))) {
      return { ok: false, error: 'Idea "' + idea.topic.slice(0, 30) + '" has an invalid date.' };
    }
    if (!Array.isArray(idea.entries)) {
      return { ok: false, error: 'Idea "' + idea.topic.slice(0, 30) + '" has no entries list.' };
    }
    for (var k = 0; k < idea.entries.length; k++) {
      var en = idea.entries[k];
      if (!en || typeof en.text !== 'string' ||
          typeof en.createdAt !== 'string' || isNaN(Date.parse(en.createdAt))) {
        return { ok: false, error: 'An entry under "' + idea.topic.slice(0, 30) + '" is malformed.' };
      }
    }
  }
  return { ok: true };
}

/* ============ Helpers ============ */

function $(sel) { return document.querySelector(sel); }

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtDate(iso) {
  var d = new Date(iso);
  if (isNaN(d)) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function getCategory(id) {
  for (var i = 0; i < state.categories.length; i++) {
    if (state.categories[i].id === id) return state.categories[i];
  }
  return null;
}

function ideasInCategory(catId) {
  return state.ideas.filter(function (i) { return i.categoryId === catId; });
}

var toastTimer = null;
function showToast(msg) {
  var t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.hidden = true; }, 2400);
}

/* ============ Modal ============ */

function showModal(opts) {
  $('#modal-title').textContent = opts.title;
  var body = $('#modal-body');
  body.innerHTML = '';
  if (typeof opts.body === 'string') body.innerHTML = opts.body;
  else if (opts.body) body.appendChild(opts.body);

  var actions = $('#modal-actions');
  actions.innerHTML = '';
  opts.buttons.forEach(function (b) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn ' + (b.className || 'btn-quiet');
    btn.textContent = b.label;
    btn.addEventListener('click', function () {
      var keepOpen = b.onClick && b.onClick() === false;
      if (!keepOpen) closeModal();
    });
    actions.appendChild(btn);
  });
  $('#modal-overlay').hidden = false;
}

function closeModal() {
  $('#modal-overlay').hidden = true;
}

$('#modal-overlay').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

/* ============ Theme ============ */

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#1c1c1f' : '#2563eb');
}

function initTheme() {
  var saved = localStorage.getItem(THEME_KEY);
  if (saved !== 'light' && saved !== 'dark') {
    saved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  applyTheme(saved);
}

$('#theme-toggle').addEventListener('click', function () {
  var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
});

/* ============ Navigation ============ */

function switchView(name) {
  document.querySelectorAll('.view').forEach(function (v) {
    v.classList.toggle('is-active', v.id === 'view-' + name);
  });
  document.querySelectorAll('.tab').forEach(function (t) {
    t.classList.toggle('is-active', t.getAttribute('data-view') === name);
  });
  renderAll();
  window.scrollTo(0, 0);
}

document.querySelectorAll('.tab').forEach(function (t) {
  t.addEventListener('click', function () { switchView(t.getAttribute('data-view')); });
});

/* ============ Dashboard ============ */

function renderDashboard() {
  var sel = $('#idea-category');
  var prev = sel.value;
  sel.innerHTML = '';
  state.categories.forEach(function (c) {
    var opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    sel.appendChild(opt);
  });
  if (prev && getCategory(prev)) sel.value = prev;

  var n = state.ideas.length;
  $('#home-stats').textContent = n === 0
    ? 'No ideas yet — capture your first one above.'
    : n + (n === 1 ? ' idea' : ' ideas') + ' in your archive.';
}

$('#idea-form').addEventListener('submit', function (e) {
  e.preventDefault();
  var topic = $('#idea-topic').value.trim();
  var catId = $('#idea-category').value;
  if (!topic) return;
  if (!catId || !getCategory(catId)) {
    showToast('Add a category first');
    return;
  }
  state.ideas.push({
    id: uid(),
    topic: topic,
    categoryId: catId,
    createdAt: new Date().toISOString(),
    entries: []
  });
  saveState();
  $('#idea-topic').value = '';
  renderDashboard();
  showToast('Idea saved');
});

/* ============ Categories ============ */

function renderCategories() {
  var list = $('#categories-list');
  list.innerHTML = '';
  if (state.categories.length === 0) {
    list.innerHTML = '<li class="empty-note">No categories yet. Add one above.</li>';
    return;
  }
  state.categories.forEach(function (c) {
    var count = ideasInCategory(c.id).length;
    var li = document.createElement('li');
    li.className = 'category-row';
    li.innerHTML =
      '<span class="cat-name">' + esc(c.name) + '</span>' +
      '<span class="cat-count">' + count + (count === 1 ? ' idea' : ' ideas') + '</span>' +
      '<button class="mini-btn" type="button" data-act="rename" aria-label="Rename ' + esc(c.name) + '">' +
        '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 17.25V21h3.75l11-11.06-3.75-3.75L3 17.25ZM20.7 7.05a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83Z"/></svg>' +
      '</button>' +
      '<button class="mini-btn" type="button" data-act="delete" aria-label="Delete ' + esc(c.name) + '">' +
        '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6v12ZM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4Z"/></svg>' +
      '</button>';
    li.querySelector('[data-act="rename"]').addEventListener('click', function () { renameCategory(c.id); });
    li.querySelector('[data-act="delete"]').addEventListener('click', function () { deleteCategory(c.id); });
    list.appendChild(li);
  });
}

$('#category-form').addEventListener('submit', function (e) {
  e.preventDefault();
  var name = $('#category-name').value.trim();
  if (!name) return;
  var exists = state.categories.some(function (c) {
    return c.name.toLowerCase() === name.toLowerCase();
  });
  if (exists) {
    showToast('That category already exists');
    return;
  }
  state.categories.push({ id: uid(), name: name });
  saveState();
  $('#category-name').value = '';
  renderCategories();
  showToast('Category added');
});

function renameCategory(id) {
  var cat = getCategory(id);
  if (!cat) return;
  var input = document.createElement('input');
  input.type = 'text';
  input.className = 'text-input';
  input.maxLength = 60;
  input.value = cat.name;
  showModal({
    title: 'Rename category',
    body: input,
    buttons: [
      {
        label: 'Save', className: 'btn-primary',
        onClick: function () {
          var name = input.value.trim();
          if (!name) return false;
          cat.name = name;
          saveState();
          renderAll();
          showToast('Category renamed');
        }
      },
      { label: 'Cancel' }
    ]
  });
  setTimeout(function () { input.focus(); input.select(); }, 50);
}

function deleteCategory(id) {
  var cat = getCategory(id);
  if (!cat) return;
  var ideas = ideasInCategory(id);
  var others = state.categories.filter(function (c) { return c.id !== id; });

  if (ideas.length === 0) {
    showModal({
      title: 'Delete category?',
      body: '<p>Delete <strong>' + esc(cat.name) + '</strong>? It has no ideas in it.</p>',
      buttons: [
        {
          label: 'Delete', className: 'btn-primary',
          onClick: function () { doDeleteCategory(id, null, false); }
        },
        { label: 'Cancel' }
      ]
    });
    return;
  }

  var body = document.createElement('div');
  var p = document.createElement('p');
  p.innerHTML = '<strong>' + esc(cat.name) + '</strong> still contains ' +
    ideas.length + (ideas.length === 1 ? ' idea' : ' ideas') +
    '. What should happen to ' + (ideas.length === 1 ? 'it' : 'them') + '?';
  body.appendChild(p);

  var moveSelect = null;
  if (others.length > 0) {
    var lbl = document.createElement('p');
    lbl.className = 'warn';
    lbl.textContent = 'Move to:';
    body.appendChild(lbl);
    moveSelect = document.createElement('select');
    moveSelect.className = 'select-input';
    others.forEach(function (c) {
      var opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      moveSelect.appendChild(opt);
    });
    body.appendChild(moveSelect);
  } else {
    var warn = document.createElement('p');
    warn.className = 'warn';
    warn.textContent = 'There is no other category to move them to.';
    body.appendChild(warn);
  }

  var buttons = [];
  if (moveSelect) {
    buttons.push({
      label: 'Move ideas & delete category', className: 'btn-primary',
      onClick: function () { doDeleteCategory(id, moveSelect.value, false); }
    });
  }
  buttons.push({
    label: 'Delete category AND its ideas', className: 'btn-outline',
    onClick: function () { doDeleteCategory(id, null, true); }
  });
  buttons.push({ label: 'Cancel' });

  showModal({ title: 'Delete category?', body: body, buttons: buttons });
}

function doDeleteCategory(id, moveToId, deleteIdeas) {
  if (moveToId) {
    state.ideas.forEach(function (i) {
      if (i.categoryId === id) i.categoryId = moveToId;
    });
  } else if (deleteIdeas) {
    state.ideas = state.ideas.filter(function (i) { return i.categoryId !== id; });
  }
  state.categories = state.categories.filter(function (c) { return c.id !== id; });
  saveState();
  renderAll();
  showToast('Category deleted');
}

/* ============ Ideas ============ */

function renderIdeas() {
  var wrap = $('#ideas-list');
  wrap.innerHTML = '';

  if (state.ideas.length === 0) {
    wrap.innerHTML = '<p class="empty-note">No ideas yet. Add one from the Home tab.</p>';
    return;
  }

  state.categories.forEach(function (cat) {
    var ideas = ideasInCategory(cat.id);
    if (ideas.length === 0) return;

    var head = document.createElement('div');
    head.className = 'cat-heading';
    head.innerHTML = '<h3>' + esc(cat.name) + '</h3>' +
      '<button class="btn btn-small btn-outline" type="button">Export</button>';
    head.querySelector('button').addEventListener('click', function () {
      exportMarkdown(cat.id);
    });
    wrap.appendChild(head);

    ideas.forEach(function (idea) {
      wrap.appendChild(buildIdeaCard(idea));
    });
  });
}

function buildIdeaCard(idea) {
  var card = document.createElement('div');
  card.className = 'idea-card' + (expandedIdeas[idea.id] ? ' is-open' : '');

  var header = document.createElement('button');
  header.type = 'button';
  header.className = 'idea-header';
  header.innerHTML =
    '<span class="idea-topic">' + esc(idea.topic) + '</span>' +
    '<svg class="chevron" viewBox="0 0 24 24"><path fill="currentColor" d="M7.4 8.6 12 13.2l4.6-4.6L18 10l-6 6-6-6 1.4-1.4Z"/></svg>';
  header.addEventListener('click', function () {
    if (expandedIdeas[idea.id]) delete expandedIdeas[idea.id];
    else expandedIdeas[idea.id] = true;
    card.classList.toggle('is-open');
  });
  card.appendChild(header);

  var body = document.createElement('div');
  body.className = 'idea-body';

  var meta = document.createElement('div');
  meta.className = 'idea-meta';
  meta.innerHTML = '<span>Created ' + esc(fmtDate(idea.createdAt)) + '</span>';
  var del = document.createElement('button');
  del.type = 'button';
  del.className = 'link-danger';
  del.textContent = 'Delete idea';
  del.addEventListener('click', function () { deleteIdea(idea.id); });
  meta.appendChild(del);
  body.appendChild(meta);

  if (idea.entries.length > 0) {
    var log = document.createElement('ul');
    log.className = 'entry-log';
    idea.entries.forEach(function (en) {
      var li = document.createElement('li');
      li.innerHTML = '<span class="entry-date">' + esc(fmtDate(en.createdAt)) + '</span>' +
        '<p class="entry-text">' + esc(en.text) + '</p>';
      log.appendChild(li);
    });
    body.appendChild(log);
  }

  var form = document.createElement('form');
  form.className = 'entry-form';
  var ta = document.createElement('textarea');
  ta.className = 'entry-input';
  ta.placeholder = 'Add details to this idea…';
  ta.rows = 3;
  form.appendChild(ta);
  var addBtn = document.createElement('button');
  addBtn.type = 'submit';
  addBtn.className = 'btn btn-primary';
  addBtn.textContent = 'Add Entry';
  form.appendChild(addBtn);
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = ta.value.trim();
    if (!text) return;
    idea.entries.push({ id: uid(), text: text, createdAt: new Date().toISOString() });
    saveState();
    renderIdeas();
    showToast('Entry added');
  });
  body.appendChild(form);

  card.appendChild(body);
  return card;
}

function deleteIdea(id) {
  var idea = null;
  for (var i = 0; i < state.ideas.length; i++) {
    if (state.ideas[i].id === id) idea = state.ideas[i];
  }
  if (!idea) return;
  showModal({
    title: 'Delete idea?',
    body: '<p>Delete <strong>' + esc(idea.topic) + '</strong>' +
      (idea.entries.length ? ' and its ' + idea.entries.length + (idea.entries.length === 1 ? ' entry' : ' entries') : '') +
      '? This cannot be undone.</p>',
    buttons: [
      {
        label: 'Delete', className: 'btn-primary',
        onClick: function () {
          state.ideas = state.ideas.filter(function (x) { return x.id !== id; });
          delete expandedIdeas[id];
          saveState();
          renderIdeas();
          showToast('Idea deleted');
        }
      },
      { label: 'Cancel' }
    ]
  });
}

/* ============ Export (Markdown) ============ */

function mdForCategory(cat) {
  var lines = ['# ' + cat.name, ''];
  ideasInCategory(cat.id).forEach(function (idea) {
    lines.push('## ' + idea.topic);
    lines.push('*Created: ' + fmtDate(idea.createdAt) + '*');
    lines.push('');
    idea.entries.forEach(function (en) {
      lines.push('**' + fmtDate(en.createdAt) + '**');
      lines.push('');
      lines.push(en.text);
      lines.push('');
    });
    if (idea.entries.length === 0) lines.push('');
  });
  return lines.join('\n');
}

function exportMarkdown(catId) {
  var md, fname;
  var stamp = new Date().toISOString().slice(0, 10);
  if (catId) {
    var cat = getCategory(catId);
    if (!cat) return;
    md = mdForCategory(cat);
    fname = 'ideas-' + cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + stamp + '.md';
  } else {
    var parts = [];
    state.categories.forEach(function (c) {
      if (ideasInCategory(c.id).length > 0) parts.push(mdForCategory(c));
    });
    if (parts.length === 0) {
      showToast('Nothing to export yet');
      return;
    }
    md = parts.join('\n\n');
    fname = 'idea-archive-' + stamp + '.md';
  }
  downloadFile(fname, md, 'text/markdown');
}

$('#export-all-btn').addEventListener('click', function () { exportMarkdown(null); });

/* ============ Download / share helper ============ */

function downloadFile(filename, content, mime) {
  var blob = new Blob([content], { type: mime });

  /* iOS: use the share sheet when available (lets you save to Files, AirDrop, etc.) */
  if (navigator.canShare && window.File) {
    try {
      var file = new File([blob], filename, { type: mime });
      if (navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file] }).catch(function (err) {
          if (err && err.name !== 'AbortError') fallbackDownload(blob, filename);
        });
        return;
      }
    } catch (e) { /* fall through to plain download */ }
  }
  fallbackDownload(blob, filename);
}

function fallbackDownload(blob, filename) {
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
}

/* ============ Backup & Restore ============ */

function buildBackup() {
  return {
    app: 'Idea Archive',
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    data: {
      version: state.version || 1,
      categories: state.categories,
      ideas: state.ideas
    }
  };
}

$('#backup-btn').addEventListener('click', function () {
  var backup = buildBackup();
  var fname = 'idea-archive-backup-' + backup.exportedAt.slice(0, 10) + '.json';
  downloadFile(fname, JSON.stringify(backup, null, 2), 'application/json');
});

function validateBackup(obj) {
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'This is not a valid backup file.' };
  if (obj.app !== 'Idea Archive') return { ok: false, error: 'This file was not made by Idea Archive.' };
  if (!obj.data) return { ok: false, error: 'The backup contains no data.' };
  var check = validateData(obj.data);
  if (!check.ok) return { ok: false, error: 'Backup data is damaged: ' + check.error };
  return { ok: true };
}

function countEntries(data) {
  var n = 0;
  data.ideas.forEach(function (i) { n += i.entries.length; });
  return n;
}

$('#restore-btn').addEventListener('click', function () {
  $('#restore-file').click();
});

$('#restore-file').addEventListener('change', function () {
  var file = this.files && this.files[0];
  this.value = ''; // allow re-picking the same file later
  if (!file) return;

  var reader = new FileReader();
  reader.onload = function () {
    var obj;
    try {
      obj = JSON.parse(reader.result);
    } catch (e) {
      showModal({
        title: 'Cannot restore',
        body: '<p>That file is not readable as a backup (it is not valid JSON). Your current data has NOT been changed.</p>',
        buttons: [{ label: 'OK', className: 'btn-primary' }]
      });
      return;
    }
    var check = validateBackup(obj);
    if (!check.ok) {
      showModal({
        title: 'Cannot restore',
        body: '<p>' + esc(check.error) + '</p><p class="warn">Your current data has NOT been changed.</p>',
        buttons: [{ label: 'OK', className: 'btn-primary' }]
      });
      return;
    }
    confirmRestore(obj);
  };
  reader.onerror = function () {
    showToast('Could not read that file');
  };
  reader.readAsText(file);
});

function confirmRestore(obj) {
  var d = obj.data;
  var when = obj.exportedAt && !isNaN(Date.parse(obj.exportedAt))
    ? fmtDate(obj.exportedAt) : 'unknown date';
  var curIdeas = state.ideas.length;
  showModal({
    title: 'Restore this backup?',
    body:
      '<p>Backup made on <strong>' + esc(when) + '</strong>, containing <strong>' +
      d.categories.length + (d.categories.length === 1 ? ' category' : ' categories') + '</strong>, <strong>' +
      d.ideas.length + (d.ideas.length === 1 ? ' idea' : ' ideas') + '</strong> and <strong>' +
      countEntries(d) + (countEntries(d) === 1 ? ' detail entry' : ' detail entries') + '</strong>.</p>' +
      '<p class="warn">⚠️ Restoring will REPLACE everything currently in the app' +
      (curIdeas ? ' (' + curIdeas + (curIdeas === 1 ? ' idea' : ' ideas') + ' right now)' : '') +
      '. This cannot be undone.</p>',
    buttons: [
      {
        label: 'Replace my data with this backup', className: 'btn-primary',
        onClick: function () { applyRestore(obj); }
      },
      { label: 'Cancel' }
    ]
  });
}

function applyRestore(obj) {
  state = {
    version: 1,
    categories: obj.data.categories,
    ideas: obj.data.ideas
  };
  expandedIdeas = {};
  saveState();
  renderAll();
  showToast('Backup restored');
}

/* ============ Render all & init ============ */

function renderAll() {
  renderDashboard();
  renderIdeas();
  renderCategories();
}

initTheme();
renderAll();

/* ============ Service worker ============ */

if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function (err) {
      console.warn('Service worker registration failed:', err);
    });
  });
}
