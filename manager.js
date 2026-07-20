/* 句存 - 笔记与分类管理 */

const DEFAULT_CATEGORIES = [
  { id: 'work', name: '工作', color: '#5856d6' },
  { id: 'study', name: '学习', color: '#34c759' },
  { id: 'idea', name: '灵感', color: '#ff9f0a' },
  { id: 'life', name: '生活', color: '#ff375f' }
];

const CATEGORY_COLORS = ['#5856d6', '#34c759', '#ff9f0a', '#ff375f', '#0071e3', '#00a6a6', '#af52de', '#8e8e93'];

const state = {
  notes: [],
  categories: [],
  activeCategory: 'all',
  search: '',
  recentOnly: false
};

const DOM = {};
let toastTimer;

document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheDom();
  renderColorOptions();
  bindEvents();
  await loadData();
}

function cacheDom() {
  Object.assign(DOM, {
    listEl: document.getElementById('note-list'),
    categoryList: document.getElementById('category-list'),
    categoryPills: document.getElementById('category-pills'),
    viewTitle: document.getElementById('view-title'),
    viewSubtitle: document.getElementById('view-subtitle'),
    searchInput: document.getElementById('search-input'),
    clearBtn: document.getElementById('clear-all'),
    exportBtn: document.getElementById('export-btn'),
    exportMenu: document.getElementById('export-menu'),
    addCategoryBtn: document.getElementById('add-category-btn'),
    categoryDialog: document.getElementById('category-dialog'),
    categoryForm: document.getElementById('category-form'),
    categoryName: document.getElementById('category-name'),
    categoryError: document.getElementById('category-error'),
    manageDialog: document.getElementById('manage-dialog'),
    manageList: document.getElementById('manage-category-list'),
    noteDialog: document.getElementById('note-dialog'),
    noteForm: document.getElementById('note-form'),
    noteContentInput: document.getElementById('note-content-input'),
    noteCategoryInput: document.getElementById('note-category-input'),
    noteSourceInput: document.getElementById('note-source-input'),
    recentFilter: document.getElementById('recent-filter'),
    toast: document.getElementById('toast')
  });
}

function bindEvents() {
  DOM.clearBtn.addEventListener('click', clearVisibleNotes);
  DOM.exportBtn.addEventListener('click', toggleExportMenu);
  document.querySelectorAll('.export-option').forEach(option => option.addEventListener('click', handleExport));
  document.addEventListener('click', closeFloatingMenus);
  document.addEventListener('keydown', handleShortcuts);

  DOM.searchInput.addEventListener('input', event => {
    state.search = event.target.value.trim().toLocaleLowerCase('zh-CN');
    render();
  });

  DOM.addCategoryBtn.addEventListener('click', openCategoryDialog);
  DOM.categoryForm.addEventListener('submit', createCategory);
  DOM.noteForm.addEventListener('submit', createNote);
  document.getElementById('new-note-btn').addEventListener('click', openNoteDialog);
  document.getElementById('manage-categories-btn').addEventListener('click', openManageDialog);
  document.getElementById('manage-categories-top').addEventListener('click', openManageDialog);
  document.getElementById('manage-add-category').addEventListener('click', () => {
    DOM.manageDialog.close();
    openCategoryDialog();
  });

  DOM.recentFilter.addEventListener('click', () => {
    state.recentOnly = !state.recentOnly;
    state.activeCategory = 'all';
    DOM.recentFilter.classList.toggle('selected', state.recentOnly);
    render();
  });

  document.querySelectorAll('[data-close-dialog]').forEach(button => {
    button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog).close());
  });

  document.querySelectorAll('.modal').forEach(dialog => {
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
  });
}

async function loadData() {
  const result = await storageGet({ notes: [], categories: null });
  state.notes = Array.isArray(result.notes) ? result.notes : [];
  state.categories = Array.isArray(result.categories) ? result.categories : DEFAULT_CATEGORIES.map(category => ({ ...category }));

  if (!Array.isArray(result.categories)) {
    await storageSet({ categories: state.categories });
  }

  render();
}

function render() {
  renderCategories();
  renderPills();
  renderNotes();
  populateCategorySelect(DOM.noteCategoryInput, DOM.noteCategoryInput.value || '');
}

function renderCategories() {
  const items = [
    categoryButton('all', '全部笔记', state.notes.length, null, true),
    ...state.categories.map(category => categoryButton(category.id, category.name, countForCategory(category.id), category.color)),
    categoryButton('uncategorized', '未分类', countForCategory(null), '#aeaeb2')
  ];
  DOM.categoryList.replaceChildren(...items);
}

function categoryButton(id, label, count, color, isAll = false) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `category-item${!state.recentOnly && state.activeCategory === id ? ' selected' : ''}`;
  button.dataset.categoryId = id;

  if (isAll) {
    button.innerHTML = '<svg class="category-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>';
  } else {
    const dot = document.createElement('span');
    dot.className = 'category-dot';
    dot.style.background = color;
    button.appendChild(dot);
  }

  button.append(document.createTextNode(label));
  const countEl = document.createElement('span');
  countEl.className = 'category-count';
  countEl.textContent = count;
  button.appendChild(countEl);
  button.addEventListener('click', () => selectCategory(id));
  return button;
}

function renderPills() {
  const categories = [{ id: 'all', name: '全部' }, ...state.categories];
  const fragment = document.createDocumentFragment();
  categories.forEach(category => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `filter-pill${!state.recentOnly && state.activeCategory === category.id ? ' active' : ''}`;
    const count = category.id === 'all' ? state.notes.length : countForCategory(category.id);
    button.append(document.createTextNode(category.name));
    const number = document.createElement('b');
    number.textContent = count;
    button.appendChild(number);
    button.addEventListener('click', () => selectCategory(category.id));
    fragment.appendChild(button);
  });
  DOM.categoryPills.replaceChildren(fragment);
}

function renderNotes() {
  const visibleNotes = getVisibleNotes();
  updatePageHeading(visibleNotes.length);
  DOM.listEl.replaceChildren();

  if (!visibleNotes.length) {
    DOM.listEl.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><path d="M14 2v6h6M8 13h8M8 17h5"></path></svg>
      <h3>${state.search ? '没有找到匹配的笔记' : '这里还没有笔记'}</h3>
      <p>${state.search ? '换个关键词，或选择其他分类试试。' : '通过右键保存网页文字，或点击右上角新建笔记。'}</p>
    </div>`;
    return;
  }

  visibleNotes.forEach(note => DOM.listEl.appendChild(createNoteCard(note)));
}

function createNoteCard(note) {
  const card = document.createElement('article');
  const category = findCategory(note.categoryId);
  const categoryName = category ? category.name : '未分类';
  const categoryColor = category ? category.color : '#aeaeb2';
  card.className = 'note-card';
  card.style.setProperty('--category-color', categoryColor);

  const header = document.createElement('div');
  header.className = 'card-header';
  header.innerHTML = `<span class="category-badge"><span class="category-dot"></span>${escapeHtml(categoryName)}</span>
    <button class="delete-btn" type="button" title="删除笔记" aria-label="删除笔记">×</button>`;
  header.querySelector('.delete-btn').addEventListener('click', () => deleteNote(note.id));

  const content = document.createElement('div');
  content.className = 'note-content';
  content.contentEditable = 'true';
  content.title = '点击即可编辑内容';
  content.textContent = note.content || '';
  content.addEventListener('focus', () => card.classList.add('editing'));
  content.addEventListener('blur', () => {
    card.classList.remove('editing');
    updateNoteContent(note.id, content.innerText.trim());
  });
  content.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') content.blur();
  });

  const meta = document.createElement('div');
  meta.className = 'note-meta';
  const time = document.createElement('span');
  time.className = 'meta-time';
  time.textContent = note.timestamp || '时间未知';
  meta.appendChild(time);

  if (note.sourceUrl || note.sourceTitle) {
    meta.appendChild(separatorDot());
    const source = document.createElement('span');
    source.className = 'meta-source screen-only';
    source.append('来自：');
    const link = document.createElement('a');
    link.href = safeUrl(note.sourceUrl);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = note.sourceTitle || note.sourceUrl || '未知来源';
    source.appendChild(link);
    meta.appendChild(source);

    const printSource = document.createElement('span');
    printSource.className = 'meta-source print-only';
    printSource.textContent = `来源：${note.sourceTitle || note.sourceUrl || '未知来源'}`;
    meta.appendChild(printSource);
  }

  const picker = document.createElement('label');
  picker.className = 'category-picker';
  picker.title = '移动分类';
  picker.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h6l2 2h10v10H3z"></path></svg>';
  const select = document.createElement('select');
  select.setAttribute('aria-label', '移动分类');
  populateCategorySelect(select, note.categoryId || '');
  select.addEventListener('change', () => moveNoteToCategory(note.id, select.value));
  picker.appendChild(select);
  meta.appendChild(picker);

  card.append(header, content, meta);
  return card;
}

function separatorDot() {
  const dot = document.createElement('span');
  dot.className = 'meta-separator';
  return dot;
}

function populateCategorySelect(select, selectedValue) {
  select.replaceChildren();
  select.add(new Option('未分类', '', false, selectedValue === '' || selectedValue == null));
  state.categories.forEach(category => select.add(new Option(category.name, category.id, false, category.id === selectedValue)));
}

function selectCategory(categoryId) {
  state.activeCategory = categoryId;
  state.recentOnly = false;
  DOM.recentFilter.classList.remove('selected');
  render();
}

function getVisibleNotes() {
  let notes = [...state.notes];
  if (state.activeCategory === 'uncategorized') notes = notes.filter(note => !note.categoryId || !findCategory(note.categoryId));
  else if (state.activeCategory !== 'all') notes = notes.filter(note => note.categoryId === state.activeCategory);

  if (state.recentOnly) notes = notes.slice(0, 10);
  if (state.search) {
    notes = notes.filter(note => {
      const category = findCategory(note.categoryId);
      const haystack = [note.content, note.sourceTitle, note.sourceUrl, category?.name].filter(Boolean).join(' ').toLocaleLowerCase('zh-CN');
      return haystack.includes(state.search);
    });
  }
  return notes;
}

function updatePageHeading(visibleCount) {
  let title = '全部笔记';
  if (state.recentOnly) title = '最近添加';
  else if (state.activeCategory === 'uncategorized') title = '未分类';
  else if (state.activeCategory !== 'all') title = findCategory(state.activeCategory)?.name || '全部笔记';

  DOM.viewTitle.textContent = title;
  const organizedCount = state.notes.filter(note => Boolean(findCategory(note.categoryId))).length;
  const searchText = state.search ? ` · 找到 ${visibleCount} 条` : '';
  DOM.viewSubtitle.textContent = `共 ${state.notes.length} 条笔记 · 已整理 ${organizedCount} 条${searchText}`;
}

function countForCategory(categoryId) {
  if (categoryId == null) return state.notes.filter(note => !note.categoryId || !findCategory(note.categoryId)).length;
  return state.notes.filter(note => note.categoryId === categoryId).length;
}

function findCategory(categoryId) {
  return state.categories.find(category => category.id === categoryId);
}

function renderColorOptions() {
  const container = document.getElementById('color-options');
  CATEGORY_COLORS.forEach((color, index) => {
    const label = document.createElement('label');
    label.className = 'color-option';
    label.style.setProperty('--swatch', color);
    label.innerHTML = `<input type="radio" name="category-color" value="${color}" ${index === 0 ? 'checked' : ''}><span title="${color}"></span>`;
    container.appendChild(label);
  });
}

function openCategoryDialog() {
  DOM.categoryForm.reset();
  DOM.categoryError.textContent = '';
  DOM.categoryDialog.showModal();
  requestAnimationFrame(() => DOM.categoryName.focus());
}

async function createCategory(event) {
  event.preventDefault();
  const name = DOM.categoryName.value.trim();
  const color = DOM.categoryForm.elements['category-color'].value;
  if (!name) return;
  if (state.categories.some(category => category.name.toLocaleLowerCase('zh-CN') === name.toLocaleLowerCase('zh-CN'))) {
    DOM.categoryError.textContent = '已经有同名分类了。';
    return;
  }

  state.categories.push({ id: `category-${Date.now()}`, name, color });
  await storageSet({ categories: state.categories });
  DOM.categoryDialog.close();
  render();
  showToast(`已创建分类“${name}”`);
}

function openManageDialog() {
  renderManageCategories();
  DOM.manageDialog.showModal();
}

function renderManageCategories() {
  DOM.manageList.replaceChildren();
  if (!state.categories.length) {
    DOM.manageList.innerHTML = '<div class="manage-empty">还没有自定义分类</div>';
    return;
  }

  state.categories.forEach(category => {
    const row = document.createElement('div');
    row.className = 'manage-row';

    const color = document.createElement('input');
    color.className = 'manage-color';
    color.type = 'color';
    color.value = category.color;
    color.title = '修改颜色';
    color.addEventListener('change', () => updateCategory(category.id, { color: color.value }));

    const name = document.createElement('input');
    name.className = 'manage-name';
    name.value = category.name;
    name.maxLength = 16;
    name.setAttribute('aria-label', `修改“${category.name}”分类名称`);
    name.addEventListener('change', () => {
      const newName = name.value.trim();
      if (!newName || state.categories.some(item => item.id !== category.id && item.name.toLocaleLowerCase('zh-CN') === newName.toLocaleLowerCase('zh-CN'))) {
        name.value = category.name;
        showToast('分类名称不能为空或重复');
        return;
      }
      updateCategory(category.id, { name: newName });
    });

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'manage-delete';
    remove.textContent = '删除';
    remove.addEventListener('click', () => deleteCategory(category.id));
    row.append(color, name, remove);
    DOM.manageList.appendChild(row);
  });
}

async function updateCategory(categoryId, changes) {
  const category = findCategory(categoryId);
  if (!category) return;
  Object.assign(category, changes);
  await storageSet({ categories: state.categories });
  render();
  renderManageCategories();
}

async function deleteCategory(categoryId) {
  const category = findCategory(categoryId);
  if (!category || !confirm(`确定删除分类“${category.name}”吗？其中的笔记会移至“未分类”。`)) return;
  state.categories = state.categories.filter(item => item.id !== categoryId);
  state.notes = state.notes.map(note => note.categoryId === categoryId ? { ...note, categoryId: null } : note);
  if (state.activeCategory === categoryId) state.activeCategory = 'uncategorized';
  await storageSet({ categories: state.categories, notes: state.notes });
  render();
  renderManageCategories();
  showToast('分类已删除，笔记已移至“未分类”');
}

function openNoteDialog() {
  DOM.noteForm.reset();
  const initialCategory = state.activeCategory !== 'all' && state.activeCategory !== 'uncategorized' ? state.activeCategory : '';
  populateCategorySelect(DOM.noteCategoryInput, initialCategory);
  DOM.noteDialog.showModal();
  requestAnimationFrame(() => DOM.noteContentInput.focus());
}

async function createNote(event) {
  event.preventDefault();
  const content = DOM.noteContentInput.value.trim();
  if (!content) return;
  const sourceUrl = DOM.noteSourceInput.value.trim();
  const note = {
    id: Date.now(),
    content,
    categoryId: DOM.noteCategoryInput.value || null,
    sourceUrl,
    sourceTitle: sourceUrl ? getHostname(sourceUrl) : '',
    timestamp: new Date().toLocaleString('zh-CN', { hour12: false })
  };
  state.notes.unshift(note);
  await storageSet({ notes: state.notes });
  DOM.noteDialog.close();
  render();
  showToast('笔记已保存');
}

async function moveNoteToCategory(noteId, categoryId) {
  const note = state.notes.find(item => String(item.id) === String(noteId));
  if (!note) return;
  note.categoryId = categoryId || null;
  await storageSet({ notes: state.notes });
  render();
  showToast(`已移至“${findCategory(categoryId)?.name || '未分类'}”`);
}

async function updateNoteContent(noteId, newContent) {
  const note = state.notes.find(item => String(item.id) === String(noteId));
  if (!note || note.content === newContent) return;
  note.content = newContent;
  await storageSet({ notes: state.notes });
  showToast('内容已保存');
}

async function deleteNote(noteId) {
  if (!confirm('确定删除这条笔记吗？')) return;
  state.notes = state.notes.filter(note => String(note.id) !== String(noteId));
  await storageSet({ notes: state.notes });
  render();
  showToast('笔记已删除');
}

async function clearVisibleNotes() {
  const visibleNotes = getVisibleNotes();
  if (!visibleNotes.length) return;
  const scope = state.activeCategory === 'all' && !state.search && !state.recentOnly ? '所有笔记' : `当前视图中的 ${visibleNotes.length} 条笔记`;
  if (!confirm(`确定清空${scope}吗？此操作不可恢复。`)) return;
  const visibleIds = new Set(visibleNotes.map(note => String(note.id)));
  state.notes = state.notes.filter(note => !visibleIds.has(String(note.id)));
  await storageSet({ notes: state.notes });
  render();
  showToast('已完成清空');
}

function handleShortcuts(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    DOM.searchInput.focus();
  }
  if (event.key === 'Escape') DOM.exportMenu.classList.remove('show');
}

function toggleExportMenu(event) {
  event.stopPropagation();
  const isOpen = DOM.exportMenu.classList.toggle('show');
  DOM.exportBtn.setAttribute('aria-expanded', String(isOpen));
}

function closeFloatingMenus(event) {
  if (!event.target.closest('.export-menu-wrapper')) {
    DOM.exportMenu.classList.remove('show');
    DOM.exportBtn.setAttribute('aria-expanded', 'false');
  }
}

function handleExport(event) {
  DOM.exportMenu.classList.remove('show');
  const format = event.currentTarget.dataset.format;
  if (format === 'txt') exportAsTxt();
  if (format === 'word') exportAsWord();
  if (format === 'pdf') exportAsPdf();
}

function getExportOptions() {
  return {
    category: document.getElementById('export-include-category').checked,
    time: document.getElementById('export-include-time').checked,
    source: document.getElementById('export-include-source').checked
  };
}

function exportAsTxt() {
  const options = getExportOptions();
  const text = getVisibleNotes().map(note => {
    const lines = [note.content || ''];
    if (options.category) lines.push(`分类：${findCategory(note.categoryId)?.name || '未分类'}`);
    if (options.time) lines.push(`时间：${note.timestamp || ''}`);
    if (options.source && (note.sourceTitle || note.sourceUrl)) lines.push(`来源：${note.sourceTitle || '未知网页'}${note.sourceUrl ? ` (${note.sourceUrl})` : ''}`);
    return lines.join('\n');
  }).join('\n--------------------------------------------------\n\n');
  downloadFile(new Blob([text], { type: 'text/plain;charset=utf-8' }), '句存笔记.txt');
}

function exportAsWord() {
  const options = getExportOptions();
  const notesHtml = getVisibleNotes().map(note => {
    const meta = [];
    if (options.category) meta.push(`分类：${escapeHtml(findCategory(note.categoryId)?.name || '未分类')}`);
    if (options.time) meta.push(`时间：${escapeHtml(note.timestamp || '')}`);
    if (options.source && (note.sourceTitle || note.sourceUrl)) meta.push(`来源：${escapeHtml(note.sourceTitle || note.sourceUrl)}`);
    return `<article><div class="content">${escapeHtml(note.content || '').replace(/\n/g, '<br>')}</div><div class="meta">${meta.join('<br>')}</div></article>`;
  }).join('');
  const html = `<!doctype html><html><head><meta charset="UTF-8"><style>body{font-family:"Microsoft YaHei","Segoe UI",sans-serif;margin:1in;color:#1d1d1f}h1{font-size:20pt}article{margin:0 0 24pt;page-break-inside:avoid}.content{font-size:12pt;line-height:1.7}.meta{margin-top:7pt;color:#666;font-size:9pt;line-height:1.6}</style></head><body><h1>${escapeHtml(DOM.viewTitle.textContent)}</h1>${notesHtml}</body></html>`;
  downloadFile(new Blob([html], { type: 'application/msword;charset=utf-8' }), '句存笔记.doc');
}

function exportAsPdf() {
  const options = getExportOptions();
  document.body.classList.add('printing-mode');
  document.body.classList.toggle('hide-category', !options.category);
  document.body.classList.toggle('hide-time', !options.time);
  document.body.classList.toggle('hide-source', !options.source);
  window.print();
  document.body.classList.remove('printing-mode', 'hide-category', 'hide-time', 'hide-source');
}

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function showToast(message) {
  clearTimeout(toastTimer);
  DOM.toast.textContent = message;
  DOM.toast.classList.add('show');
  toastTimer = setTimeout(() => DOM.toast.classList.remove('show'), 1800);
}

function safeUrl(url) {
  if (!url) return '#';
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '#';
  } catch {
    return '#';
  }
}

function getHostname(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function storageGet(defaults) {
  return new Promise(resolve => chrome.storage.local.get(defaults, resolve));
}

function storageSet(values) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve();
    });
  });
}
