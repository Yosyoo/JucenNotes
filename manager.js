/* 句存 - 笔记与分类管理 */

const DEFAULT_CATEGORIES = [
  { id: 'work', name: '工作', color: '#5856d6' },
  { id: 'study', name: '学习', color: '#34c759' },
  { id: 'idea', name: '灵感', color: '#ff9f0a' },
  { id: 'life', name: '生活', color: '#ff375f' }
];

const CATEGORY_COLORS = ['#5856d6', '#34c759', '#ff9f0a', '#ff375f', '#0071e3', '#00a6a6', '#af52de', '#8e8e93'];
const NotesCore = globalThis.JucunNotes || (typeof require !== 'undefined' ? require('./notes-store.js') : null);

const state = {
  notes: [],
  categories: [],
  activeCategory: 'all',
  search: '',
  selectionMode: false,
  selectedNoteIds: new Set()
};

const DOM = {};
let toastTimer;
let exportPreviewTimer;
let storageRenderPending = false;
const exportState = { format: 'pdf', zoom: .75, preview: null, localFontsLoaded: false, notes: null, title: '' };

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheDom();
  renderColorOptions();
  bindEvents();
  bindStorageEvents();
  try {
    await loadData();
  } catch (error) {
    state.categories = DEFAULT_CATEGORIES.map(category => ({ ...category }));
    render();
    showOperationError('加载数据', error);
  }
}

function cacheDom() {
  Object.assign(DOM, {
    listEl: document.getElementById('note-list'),
    categoryList: document.getElementById('category-list'),
    categoryPills: document.getElementById('category-pills'),
    viewTitle: document.getElementById('view-title'),
    viewSubtitle: document.getElementById('view-subtitle'),
    searchInput: document.getElementById('search-input'),
    batchSelectBtn: document.getElementById('batch-select-btn'),
    batchActions: document.getElementById('batch-actions'),
    batchSelectedCount: document.getElementById('batch-selected-count'),
    batchSelectAll: document.getElementById('batch-select-all'),
    batchExport: document.getElementById('batch-export'),
    batchDelete: document.getElementById('batch-delete'),
    exportBtn: document.getElementById('export-btn'),
    exportDialog: document.getElementById('export-dialog'),
    exportDialogClose: document.getElementById('export-dialog-close'),
    exportCancel: document.getElementById('export-cancel'),
    exportConfirm: document.getElementById('export-confirm'),
    exportSummary: document.getElementById('export-summary'),
    exportPreviewCanvas: document.getElementById('export-preview-canvas'),
    exportNextPage: document.getElementById('export-next-page'),
    exportPaperSize: document.getElementById('export-paper-size'),
    exportMargin: document.getElementById('export-margin'),
    exportFontFamily: document.getElementById('export-font-family'),
    exportLocalFontList: document.getElementById('export-local-font-list'),
    exportLoadFonts: document.getElementById('export-load-fonts'),
    exportFontSize: document.getElementById('export-font-size'),
    exportLineHeight: document.getElementById('export-line-height'),
    previewZoomValue: document.getElementById('preview-zoom-value'),
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
    confirmDialog: document.getElementById('confirm-dialog'),
    confirmEyebrow: document.getElementById('confirm-eyebrow'),
    confirmTitle: document.getElementById('confirm-title'),
    confirmMessage: document.getElementById('confirm-message'),
    confirmCancel: document.getElementById('confirm-cancel'),
    confirmSubmit: document.getElementById('confirm-submit'),
    toast: document.getElementById('toast')
  });
}

function bindEvents() {
  DOM.batchSelectBtn.addEventListener('click', toggleSelectionMode);
  DOM.batchSelectAll.addEventListener('click', toggleSelectAllVisible);
  DOM.batchExport.addEventListener('click', openSelectedExportDialog);
  DOM.batchDelete.addEventListener('click', deleteSelectedNotes);
  DOM.exportBtn.addEventListener('click', () => openExportDialog());
  document.addEventListener('keydown', handleShortcuts);
  document.addEventListener('click', closeCategoryMenus);

  DOM.exportDialogClose.addEventListener('click', closeExportDialog);
  DOM.exportCancel.addEventListener('click', closeExportDialog);
  DOM.exportConfirm.addEventListener('click', confirmExport);
  DOM.exportDialog.addEventListener('click', event => {
    if (event.target === DOM.exportDialog) closeExportDialog();
  });
  document.querySelectorAll('[data-export-format]').forEach(button => button.addEventListener('click', () => setExportFormat(button.dataset.exportFormat)));
  document.querySelectorAll('[data-export-option]').forEach(button => button.addEventListener('click', () => selectExportOption(button)));
  [DOM.exportPaperSize, DOM.exportMargin, DOM.exportFontFamily, DOM.exportLineHeight].forEach(control => control.addEventListener('change', scheduleExportPreview));
  DOM.exportFontFamily.addEventListener('input', scheduleExportPreview);
  ['export-include-category', 'export-include-time', 'export-include-source', 'export-include-page-number'].forEach(id => document.getElementById(id).addEventListener('change', scheduleExportPreview));
  document.getElementById('export-font-decrease').addEventListener('click', () => changeExportFontSize(-1));
  document.getElementById('export-font-increase').addEventListener('click', () => changeExportFontSize(1));
  DOM.exportLoadFonts.addEventListener('click', loadLocalFonts);
  document.getElementById('export-reset').addEventListener('click', resetExportSettings);
  document.getElementById('preview-zoom-out').addEventListener('click', () => changePreviewZoom(-.1));
  document.getElementById('preview-zoom-in').addEventListener('click', () => changePreviewZoom(.1));

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

  document.querySelectorAll('[data-close-dialog]').forEach(button => {
    button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog).close());
  });

  document.querySelectorAll('.modal').forEach(dialog => {
    dialog.addEventListener('click', event => {
      if (event.target === dialog) dialog.close();
    });
  });

  DOM.confirmDialog.addEventListener('click', event => {
    if (event.target === DOM.confirmDialog) DOM.confirmDialog.close('cancel');
  });
}

async function loadData() {
  const [result, notes] = await Promise.all([
    storageGet({ categories: null }),
    requestNoteMutation('get')
  ]);
  state.notes = notes;
  state.categories = Array.isArray(result.categories) ? result.categories : DEFAULT_CATEGORIES.map(category => ({ ...category }));

  if (!Array.isArray(result.categories)) {
    await storageSet({ categories: state.categories });
  }

  render();
}

function bindStorageEvents() {
  if (!globalThis.chrome?.storage?.onChanged) return;
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    let shouldRender = false;
    if (changes.notes && Array.isArray(changes.notes.newValue)) {
      state.notes = NotesCore.normalizeNotes(changes.notes.newValue).notes;
      shouldRender = true;
    }
    if (changes.categories && Array.isArray(changes.categories.newValue)) {
      state.categories = changes.categories.newValue;
      shouldRender = true;
    }
    if (!shouldRender) return;
    if (document.activeElement?.classList.contains('note-content')) {
      storageRenderPending = true;
      return;
    }
    render();
  });
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
  button.className = `category-item${state.activeCategory === id ? ' selected' : ''}`;
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
    button.className = `filter-pill${state.activeCategory === category.id ? ' active' : ''}`;
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
  pruneSelectedNotes();
  updatePageHeading(visibleNotes.length);
  updateBatchControls(visibleNotes);
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
  const noteId = NotesCore.noteIdKey(note.id);
  const isSelected = state.selectedNoteIds.has(noteId);
  card.className = `note-card${state.selectionMode ? ' selecting' : ''}${isSelected ? ' selected' : ''}`;
  card.dataset.noteId = noteId;
  card.style.setProperty('--category-color', categoryColor);

  const header = document.createElement('div');
  header.className = 'card-header';
  header.innerHTML = `<div class="card-header-main">
      ${state.selectionMode ? `<label class="note-select" title="选择笔记"><input type="checkbox" aria-label="选择这条笔记" ${isSelected ? 'checked' : ''}></label>` : ''}
      <span class="category-badge"><span class="category-dot"></span>${escapeHtml(categoryName)}</span>
    </div>
    <button class="delete-btn" type="button" title="删除笔记" aria-label="删除笔记">×</button>`;
  header.querySelector('.delete-btn').addEventListener('click', () => deleteNote(note.id));
  header.querySelector('.note-select input')?.addEventListener('input', event => {
    setNoteSelected(note, event.target.checked, card);
  });

  const content = document.createElement('div');
  content.className = 'note-content';
  content.contentEditable = String(!state.selectionMode);
  content.title = state.selectionMode ? '点击卡片选择笔记' : '点击即可编辑内容';
  content.textContent = note.content || '';
  if (!state.selectionMode) {
    content.addEventListener('focus', () => card.classList.add('editing'));
    content.addEventListener('blur', () => {
      card.classList.remove('editing');
      updateNoteContent(note.id, content.innerText.trim());
    });
    content.addEventListener('keydown', event => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') content.blur();
    });
  }

  const meta = document.createElement('div');
  meta.className = 'note-meta';
  const time = document.createElement('span');
  time.className = 'meta-time';
  time.textContent = note.timestamp || '时间未知';
  meta.appendChild(time);

  if (note.sourceUrl || note.sourceTitle) {
    meta.appendChild(separatorDot());
    const source = document.createElement('span');
    source.className = 'meta-source';
    source.append('来自：');
    const link = document.createElement('a');
    link.href = safeUrl(note.sourceUrl);
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = note.sourceTitle || note.sourceUrl || '未知来源';
    source.appendChild(link);
    meta.appendChild(source);

  }

  const picker = document.createElement('div');
  picker.className = 'category-picker';
  const pickerButton = document.createElement('button');
  pickerButton.type = 'button';
  pickerButton.className = 'category-picker-trigger';
  pickerButton.setAttribute('aria-label', `移动分类，当前为${categoryName}`);
  pickerButton.setAttribute('aria-haspopup', 'menu');
  pickerButton.setAttribute('aria-expanded', 'false');
  pickerButton.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7h6l2 2h10v10H3z"></path></svg><span>${escapeHtml(categoryName)}</span>`;

  const pickerMenu = document.createElement('div');
  pickerMenu.className = 'category-picker-menu';
  pickerMenu.setAttribute('role', 'menu');
  const choices = [{ id: '', name: '未分类', color: '#aeaeb2' }, ...state.categories];
  choices.forEach(choice => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = `category-picker-option${(note.categoryId || '') === choice.id ? ' selected' : ''}`;
    option.setAttribute('role', 'menuitemradio');
    option.setAttribute('aria-checked', String((note.categoryId || '') === choice.id));
    option.innerHTML = `<span class="category-option-dot" style="background:${choice.color}"></span><span>${escapeHtml(choice.name)}</span>`;
    option.addEventListener('click', event => {
      event.stopPropagation();
      closeCategoryMenus();
      if ((note.categoryId || '') !== choice.id) moveNoteToCategory(note.id, choice.id);
    });
    pickerMenu.appendChild(option);
  });

  pickerButton.addEventListener('click', event => {
    event.stopPropagation();
    const willOpen = !picker.classList.contains('open');
    closeCategoryMenus();
    picker.classList.toggle('open', willOpen);
    card.classList.toggle('menu-open', willOpen);
    pickerButton.setAttribute('aria-expanded', String(willOpen));
    if (willOpen) pickerMenu.querySelector('.selected')?.focus();
  });
  picker.append(pickerButton, pickerMenu);
  meta.appendChild(picker);

  card.append(header, content, meta);
  card.addEventListener('click', event => {
    if (!state.selectionMode || event.target.closest('a, button, input, label')) return;
    setNoteSelected(note, !state.selectedNoteIds.has(noteId), card);
  });
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
  render();
}

function getVisibleNotes() {
  let notes = [...state.notes];
  if (state.activeCategory === 'uncategorized') notes = notes.filter(note => !note.categoryId || !findCategory(note.categoryId));
  else if (state.activeCategory !== 'all') notes = notes.filter(note => note.categoryId === state.activeCategory);

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
  if (state.activeCategory === 'uncategorized') title = '未分类';
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

  const nextCategories = [...state.categories, { id: `category-${Date.now()}`, name, color }];
  try {
    await storageSet({ categories: nextCategories });
    state.categories = nextCategories;
    DOM.categoryDialog.close();
    render();
    showToast(`已创建分类“${name}”`);
  } catch (error) {
    showOperationError('创建分类', error);
  }
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
  const nextCategories = state.categories.map(item => item.id === categoryId ? { ...item, ...changes } : item);
  try {
    await storageSet({ categories: nextCategories });
    state.categories = nextCategories;
    render();
    renderManageCategories();
  } catch (error) {
    showOperationError('更新分类', error);
    renderManageCategories();
  }
}

async function deleteCategory(categoryId) {
  const category = findCategory(categoryId);
  if (!category) return;
  const noteCount = countForCategory(categoryId);
  const confirmed = await showConfirm({
    eyebrow: '删除分类',
    title: `删除“${category.name}”？`,
    message: noteCount
      ? `分类中的 ${noteCount} 条笔记会移至“未分类”，笔记内容不会被删除。`
      : '这个分类中没有笔记。删除分类后无法撤销。',
    confirmLabel: '删除分类'
  });
  if (!confirmed) return;
  try {
    const result = await requestCategoryDeletion(categoryId);
    state.categories = result.categories;
    state.notes = result.notes;
    if (state.activeCategory === categoryId) state.activeCategory = 'uncategorized';
    render();
    renderManageCategories();
    showToast('分类已删除，笔记已移至“未分类”');
  } catch (error) {
    showOperationError('删除分类', error);
  }
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
    id: NotesCore.createNoteId(),
    content,
    categoryId: DOM.noteCategoryInput.value || null,
    sourceUrl,
    sourceTitle: sourceUrl ? getHostname(sourceUrl) : '',
    timestamp: new Date().toLocaleString('zh-CN', { hour12: false })
  };
  try {
    state.notes = await requestNoteMutation('create', { note });
    DOM.noteDialog.close();
    render();
    showToast('笔记已保存');
  } catch (error) {
    showOperationError('保存笔记', error);
  }
}

async function moveNoteToCategory(noteId, categoryId) {
  const note = state.notes.find(item => NotesCore.noteIdKey(item.id) === NotesCore.noteIdKey(noteId));
  if (!note) return;
  try {
    state.notes = await requestNoteMutation('moveCategory', { id: noteId, categoryId });
    render();
    showToast(`已移至“${findCategory(categoryId)?.name || '未分类'}”`);
  } catch (error) {
    showOperationError('移动笔记', error);
  }
}

async function updateNoteContent(noteId, newContent) {
  const note = state.notes.find(item => NotesCore.noteIdKey(item.id) === NotesCore.noteIdKey(noteId));
  if (!note) return;
  if (note.content === newContent) {
    flushPendingStorageRender();
    return;
  }
  let saved = false;
  try {
    state.notes = await requestNoteMutation('updateContent', { id: noteId, content: newContent });
    saved = true;
    showToast('内容已保存');
  } catch (error) {
    showOperationError('保存内容', error);
  } finally {
    if (!flushPendingStorageRender() && !saved) {
      renderNotes();
    }
  }
}

function flushPendingStorageRender() {
  if (!storageRenderPending) return false;
  storageRenderPending = false;
  render();
  return true;
}

async function deleteNote(noteId) {
  const note = state.notes.find(item => NotesCore.noteIdKey(item.id) === NotesCore.noteIdKey(noteId));
  if (!note) return;
  const confirmed = await showConfirm({
    eyebrow: '删除笔记',
    title: '删除这条笔记？',
    message: '笔记删除后无法恢复，请确认是否继续。',
    confirmLabel: '删除笔记'
  });
  if (!confirmed) return;
  try {
    state.notes = await requestNoteMutation('delete', { ids: [noteId] });
    render();
    showToast('笔记已删除');
  } catch (error) {
    showOperationError('删除笔记', error);
  }
}

function toggleSelectionMode() {
  if (!state.selectionMode && !getVisibleNotes().length) {
    showToast('当前视图没有可选择的笔记');
    return;
  }
  setSelectionMode(!state.selectionMode);
}

function setSelectionMode(enabled) {
  state.selectionMode = Boolean(enabled);
  state.selectedNoteIds.clear();
  closeCategoryMenus();
  renderNotes();
  if (!state.selectionMode) DOM.batchSelectBtn.focus();
}

function setNoteSelected(note, selected, card = null) {
  const noteId = NotesCore.noteIdKey(note.id);
  if (selected) state.selectedNoteIds.add(noteId);
  else state.selectedNoteIds.delete(noteId);

  const targetCard = card || [...DOM.listEl.querySelectorAll('.note-card')].find(item => item.dataset.noteId === noteId);
  targetCard?.classList.toggle('selected', selected);
  const checkbox = targetCard?.querySelector('.note-select input');
  if (checkbox) checkbox.checked = selected;
  updateBatchControls();
}

function toggleSelectAllVisible() {
  const visibleNotes = getVisibleNotes();
  if (!visibleNotes.length) return;
  const allSelected = visibleNotes.every(note => state.selectedNoteIds.has(NotesCore.noteIdKey(note.id)));
  visibleNotes.forEach(note => {
    const noteId = NotesCore.noteIdKey(note.id);
    if (allSelected) state.selectedNoteIds.delete(noteId);
    else state.selectedNoteIds.add(noteId);
  });
  DOM.listEl.querySelectorAll('.note-card').forEach(card => {
    const selected = state.selectedNoteIds.has(card.dataset.noteId);
    card.classList.toggle('selected', selected);
    const checkbox = card.querySelector('.note-select input');
    if (checkbox) checkbox.checked = selected;
  });
  updateBatchControls(visibleNotes);
}

function getSelectedNotes() {
  return filterSelectedNotes(state.notes, state.selectedNoteIds);
}

function filterSelectedNotes(notes, selectedNoteIds) {
  if (!(selectedNoteIds instanceof Set)) return [];
  return notes.filter(note => selectedNoteIds.has(NotesCore.noteIdKey(note.id)));
}

function reconcileVisibleSelection(selectedNoteIds, visibleSelections) {
  const reconciled = new Set(selectedNoteIds);
  visibleSelections.forEach(({ note, checked }) => {
    const noteId = NotesCore.noteIdKey(note.id);
    if (checked) reconciled.add(noteId);
    else reconciled.delete(noteId);
  });
  return reconciled;
}

function syncVisibleSelectionFromDom() {
  const visibleNotesById = new Map(getVisibleNotes().map(note => [NotesCore.noteIdKey(note.id), note]));
  const visibleSelections = [...DOM.listEl.querySelectorAll('.note-card')].map(card => ({
    note: visibleNotesById.get(card.dataset.noteId),
    checked: card.querySelector('.note-select input')?.checked === true
  })).filter(item => item.note);
  state.selectedNoteIds = reconcileVisibleSelection(state.selectedNoteIds, visibleSelections);
  updateBatchControls();
}

function pruneSelectedNotes() {
  const existingNoteIds = new Set(state.notes.map(note => NotesCore.noteIdKey(note.id)));
  [...state.selectedNoteIds].forEach(noteId => {
    if (!existingNoteIds.has(noteId)) state.selectedNoteIds.delete(noteId);
  });
}

function updateBatchControls(visibleNotes = getVisibleNotes()) {
  const selectedCount = state.selectedNoteIds.size;
  const allVisibleSelected = visibleNotes.length > 0
    && visibleNotes.every(note => state.selectedNoteIds.has(NotesCore.noteIdKey(note.id)));
  DOM.batchActions.hidden = !state.selectionMode;
  DOM.batchSelectedCount.textContent = `已选择 ${selectedCount} 条`;
  DOM.batchSelectAll.textContent = allVisibleSelected ? '取消全选' : '全选当前视图';
  DOM.batchSelectAll.disabled = !visibleNotes.length;
  DOM.batchExport.disabled = selectedCount === 0;
  DOM.batchDelete.disabled = selectedCount === 0;
  DOM.batchSelectBtn.classList.toggle('active', state.selectionMode);
  DOM.batchSelectBtn.setAttribute('aria-pressed', String(state.selectionMode));
  DOM.batchSelectBtn.querySelector('span').textContent = state.selectionMode ? '完成' : '批量选择';
}

async function deleteSelectedNotes() {
  const selectedNotes = getSelectedNotes();
  if (!selectedNotes.length) return;
  const confirmed = await showConfirm({
    eyebrow: '批量删除',
    title: `删除所选的 ${selectedNotes.length} 条笔记？`,
    message: '所选笔记删除后无法恢复，请确认是否继续。',
    confirmLabel: '删除所选'
  });
  if (!confirmed) return;
  try {
    state.notes = await requestNoteMutation('delete', { ids: selectedNotes.map(note => note.id) });
    state.selectionMode = false;
    state.selectedNoteIds.clear();
    render();
    DOM.batchSelectBtn.focus();
    showToast(`已删除 ${selectedNotes.length} 条笔记`);
  } catch (error) {
    showOperationError('批量删除', error);
  }
}

function handleShortcuts(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    DOM.searchInput.focus();
  }
  if (event.key === 'Escape') {
    if (state.selectionMode && !document.querySelector('dialog[open]')) {
      setSelectionMode(false);
      return;
    }
    const openPicker = document.querySelector('.category-picker.open');
    closeCategoryMenus();
    openPicker?.querySelector('.category-picker-trigger')?.focus();
  }
}

function closeCategoryMenus() {
  document.querySelectorAll('.category-picker.open').forEach(picker => {
    picker.classList.remove('open');
    picker.closest('.note-card')?.classList.remove('menu-open');
    picker.querySelector('.category-picker-trigger')?.setAttribute('aria-expanded', 'false');
  });
}

function openSelectedExportDialog() {
  syncVisibleSelectionFromDom();
  const selectedNotes = getSelectedNotes();
  if (!selectedNotes.length) return;
  openExportDialog(selectedNotes, '所选笔记');
}

function openExportDialog(notes = getVisibleNotes(), title = DOM.viewTitle.textContent || '句存笔记') {
  if (!notes.length) {
    showToast('当前视图没有可导出的笔记');
    return;
  }
  exportState.notes = createExportSnapshot(notes);
  exportState.title = title;
  setExportFormat('pdf');
  DOM.exportDialog.showModal();
  scheduleExportPreview();
}

function closeExportDialog() {
  clearTimeout(exportPreviewTimer);
  if (DOM.exportDialog.open) DOM.exportDialog.close();
  exportState.notes = null;
  exportState.title = '';
}

function setExportFormat(format) {
  exportState.format = format;
  document.querySelectorAll('[data-export-format]').forEach(button => {
    const active = button.dataset.exportFormat === format;
    button.classList.toggle('active', active);
    button.setAttribute('aria-selected', String(active));
  });
  const labels = { pdf: '导出 PDF', word: '导出 Word', txt: '导出 TXT' };
  DOM.exportConfirm.querySelector('span').textContent = labels[format];
}

function getExportOptions() {
  return {
    category: document.getElementById('export-include-category').checked,
    time: document.getElementById('export-include-time').checked,
    source: document.getElementById('export-include-source').checked,
    pageNumber: document.getElementById('export-include-page-number').checked,
    paperSize: DOM.exportPaperSize.value,
    orientation: document.querySelector('[data-export-option="orientation"].active')?.dataset.value || 'portrait',
    margin: DOM.exportMargin.value,
    template: document.querySelector('[data-export-option="template"].active')?.dataset.value || 'minimal',
    fontFamily: getExportFontSelection(),
    fontSize: Number(DOM.exportFontSize.value) || 14,
    lineHeight: DOM.exportLineHeight.value
  };
}

function selectExportOption(button) {
  const option = button.dataset.exportOption;
  document.querySelectorAll(`[data-export-option="${option}"]`).forEach(item => item.classList.toggle('active', item === button));
  scheduleExportPreview();
}

function changeExportFontSize(delta) {
  DOM.exportFontSize.value = Math.min(18, Math.max(11, Number(DOM.exportFontSize.value) + delta));
  scheduleExportPreview();
}

function resetExportSettings() {
  DOM.exportPaperSize.value = 'a4';
  DOM.exportMargin.value = 'standard';
  DOM.exportFontFamily.value = '系统字体';
  DOM.exportFontSize.value = 14;
  DOM.exportLineHeight.value = 'comfortable';
  document.querySelectorAll('[data-export-option="orientation"]').forEach(button => button.classList.toggle('active', button.dataset.value === 'portrait'));
  document.querySelectorAll('[data-export-option="template"]').forEach(button => button.classList.toggle('active', button.dataset.value === 'minimal'));
  ['export-include-category', 'export-include-time', 'export-include-source', 'export-include-page-number'].forEach(id => { document.getElementById(id).checked = true; });
  exportState.zoom = .75;
  scheduleExportPreview();
}

function getExportFontSelection() {
  const value = DOM.exportFontFamily.value.trim();
  if (!value || value === '系统字体') return 'sans';
  if (value === '宋体') return 'serif';
  return `local:${value}`;
}

async function loadLocalFonts() {
  if (exportState.localFontsLoaded) {
    DOM.exportFontFamily.focus();
    showToast('本机字体列表已载入');
    return;
  }
  if (typeof window.queryLocalFonts !== 'function') {
    DOM.exportFontFamily.focus();
    showToast('当前浏览器不支持读取字体列表，可直接输入字体名称');
    return;
  }

  DOM.exportLoadFonts.disabled = true;
  DOM.exportLoadFonts.textContent = '读取中';
  try {
    const fonts = await window.queryLocalFonts();
    const families = [...new Set(fonts
      .map(font => String(font.family || font.fullName || '').trim())
      .filter(Boolean))]
      .filter(name => !['系统字体', '宋体'].includes(name))
      .sort((left, right) => left.localeCompare(right, 'zh-CN'));
    const fragment = document.createDocumentFragment();
    ['系统字体', '宋体', ...families].forEach(name => {
      const option = document.createElement('option');
      option.value = name;
      fragment.appendChild(option);
    });
    DOM.exportLocalFontList.replaceChildren(fragment);
    exportState.localFontsLoaded = true;
    document.getElementById('export-font-hint').textContent = `已载入 ${families.length} 种本机字体，可输入名称筛选`;
    DOM.exportFontFamily.focus();
    showToast(`已载入 ${families.length} 种本机字体`);
  } catch (error) {
    if (error?.name !== 'NotAllowedError') console.warn('读取本机字体失败', error);
    DOM.exportFontFamily.focus();
    showToast('未获得字体权限，可直接输入字体名称');
  } finally {
    DOM.exportLoadFonts.disabled = false;
    DOM.exportLoadFonts.textContent = '字体库';
  }
}

function changePreviewZoom(delta) {
  exportState.zoom = Math.min(1.15, Math.max(.45, Math.round((exportState.zoom + delta) * 100) / 100));
  applyPreviewZoom();
}

function scheduleExportPreview() {
  clearTimeout(exportPreviewTimer);
  exportPreviewTimer = setTimeout(updateExportPreview, 80);
}

function updateExportPreview() {
  if (!DOM.exportDialog.open) return;
  const model = getExportModel();
  const rendered = window.JucunPdf.renderDocument(model, getExportOptions(), 1);
  exportState.preview = rendered;
  const firstPage = rendered.canvases[0];
  DOM.exportPreviewCanvas.width = firstPage.width;
  DOM.exportPreviewCanvas.height = firstPage.height;
  DOM.exportPreviewCanvas.getContext('2d').drawImage(firstPage, 0, 0);
  DOM.exportNextPage.hidden = rendered.canvases.length < 2;
  DOM.exportSummary.textContent = `将导出 ${model.notes.length} 条笔记 · 预计 ${rendered.canvases.length} 页`;
  applyPreviewZoom();
}

function applyPreviewZoom() {
  if (!exportState.preview) return;
  const { width, height } = exportState.preview.page;
  const displayWidth = Math.round(width * exportState.zoom);
  const displayHeight = Math.round(height * exportState.zoom);
  DOM.exportPreviewCanvas.style.width = `${displayWidth}px`;
  DOM.exportPreviewCanvas.style.height = `${displayHeight}px`;
  DOM.exportNextPage.style.width = `${displayWidth}px`;
  DOM.exportNextPage.style.height = `${displayHeight}px`;
  DOM.previewZoomValue.value = `${Math.round(exportState.zoom * 100)}%`;
}

function getExportModel() {
  return {
    title: exportState.title || DOM.viewTitle.textContent || '句存笔记',
    notes: getNotesForExport().map(note => {
      const category = findCategory(note.categoryId);
      return {
        content: note.content || '',
        timestamp: note.timestamp || '',
        sourceTitle: note.sourceTitle || '',
        sourceUrl: note.sourceUrl || '',
        category: category ? { name: category.name, color: category.color } : { name: '未分类', color: '#8e8e93' }
      };
    })
  };
}

function getNotesForExport() {
  return Array.isArray(exportState.notes) ? exportState.notes : getVisibleNotes();
}

function createExportSnapshot(notes) {
  return notes.map(note => ({ ...note }));
}

async function confirmExport() {
  DOM.exportConfirm.classList.add('busy');
  DOM.exportConfirm.disabled = true;
  try {
    if (exportState.format === 'txt') exportAsTxt();
    else if (exportState.format === 'word') exportAsWord();
    else await exportAsPdf();
    closeExportDialog();
    showToast('导出完成');
  } catch (error) {
    console.error(error);
    showToast('导出失败，请重试');
  } finally {
    DOM.exportConfirm.classList.remove('busy');
    DOM.exportConfirm.disabled = false;
  }
}

function exportAsTxt() {
  const options = getExportOptions();
  const text = getNotesForExport().map(note => {
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
  const model = getExportModel();
  const html = buildWordDocument(model, options);
  downloadFile(new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' }), `${model.title}.doc`);
}

function buildWordDocument(model, options) {
  const fontFamily = getWordFontFamily(options.fontFamily);
  const fontSize = Math.max(9, Math.round(options.fontSize * .82));
  const lineHeight = { compact: 1.5, comfortable: 1.72, relaxed: 1.95 }[options.lineHeight] || 1.72;
  const margin = { compact: '1.35cm', standard: '1.9cm', wide: '2.55cm' }[options.margin] || '1.9cm';
  const paper = {
    a4: ['21cm', '29.7cm'],
    letter: ['21.59cm', '27.94cm'],
    a5: ['14.8cm', '21cm']
  }[options.paperSize] || ['21cm', '29.7cm'];
  const paperSize = options.orientation === 'landscape' ? `${paper[1]} ${paper[0]}` : `${paper[0]} ${paper[1]}`;
  const templateClass = ['minimal', 'manuscript', 'cards'].includes(options.template) ? options.template : 'minimal';

  const notesHtml = model.notes.map(note => {
    const category = note.category;
    const categoryName = category?.name || '未分类';
    const categoryColor = /^#[0-9a-f]{6}$/i.test(category?.color || '') ? category.color : '#8e8e93';
    const sourceUrl = safeUrl(note.sourceUrl);
    const sourceText = escapeHtml(note.sourceTitle || note.sourceUrl || '未知来源');
    const sourceHtml = sourceUrl !== '#'
      ? `<a href="${escapeHtml(sourceUrl)}">${sourceText}</a>`
      : sourceText;
    const meta = [];
    if (options.time) meta.push(`<span>${escapeHtml(note.timestamp || '时间未知')}</span>`);
    if (options.source && (note.sourceTitle || note.sourceUrl)) meta.push(`<span>来自：${sourceHtml}</span>`);
    const categoryHtml = options.category
      ? `<div class="category" style="color:${categoryColor};background:${hexToWordTint(categoryColor)}"><b style="background:${categoryColor}"></b>${escapeHtml(categoryName)}</div>`
      : '';
    return `<div class="note ${templateClass}" style="border-left-color:${categoryColor}">
      ${categoryHtml}
      <div class="content">${escapeHtml(note.content || '').replace(/\r?\n/g, '<br>')}</div>
      ${meta.length ? `<div class="meta">${meta.join('<span class="dot">·</span>')}</div>` : ''}
    </div>`;
  }).join('');

  const title = escapeHtml(model.title || '句存笔记');
  const date = new Date();
  const exportedAt = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  return `<!doctype html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" lang="zh-CN">
<head><meta charset="UTF-8"><title>${title}</title><style>
@page WordSection1{size:${paperSize};margin:${margin}}
body{margin:0;color:#1d1d1f;background:#fff;font-family:${fontFamily}}
.WordSection1{page:WordSection1}
.document-header{margin:0 0 26pt;padding:0 0 17pt;border-bottom:2pt solid #0071e3}
.brandline{margin:0 0 8pt;color:#0071e3;font-size:8.5pt;font-weight:700;letter-spacing:.7pt}
h1{margin:0 0 7pt;font-size:25pt;line-height:1.15;letter-spacing:-.5pt}
.summary{margin:0;color:#8e8e93;font-size:9pt}
.note{margin:0 0 17pt;page-break-inside:avoid}
.note.minimal{padding:4pt 0 16pt;border-bottom:1pt solid #e8e8eb}
.note.manuscript{padding:10pt 12pt 12pt 15pt;border-left:3pt solid #0071e3;background:#fbfbfc}
.note.cards{padding:15pt;border:1pt solid #e5e5e8;border-left:3pt solid #0071e3;background:#f8f9fb}
.category{display:inline-block;margin:0 0 9pt;padding:3pt 8pt;font-size:8.5pt;font-weight:700}
.category b{display:inline-block;width:5pt;height:5pt;margin-right:5pt}
.content{font-size:${fontSize}pt;line-height:${lineHeight};color:#2c2c2e}
.meta{margin-top:11pt;padding-top:8pt;border-top:1pt solid #ececef;color:#8e8e93;font-size:8.5pt;line-height:1.5}
.meta .dot{padding:0 7pt;color:#c7c7cc}
a{color:#176fc1;text-decoration:underline}
.document-footer{margin-top:20pt;padding-top:10pt;border-top:1pt solid #ececef;color:#aeaeb2;font-size:8pt;text-align:right}
</style></head>
<body><div class="WordSection1">
  <div class="document-header"><p class="brandline">句存 · 笔记导出</p><h1>${title}</h1><p class="summary">共 ${model.notes.length} 条笔记 · 导出于 ${exportedAt}</p></div>
  ${notesHtml}
  <div class="document-footer">由句存在本地生成</div>
</div></body></html>`;
}

function hexToWordTint(hex) {
  const number = Number.parseInt(hex.slice(1), 16);
  const channels = [(number >> 16) & 255, (number >> 8) & 255, number & 255];
  return `rgb(${channels.map(channel => Math.round(channel + (255 - channel) * .9)).join(',')})`;
}

function getWordFontFamily(selection) {
  if (selection === 'serif') return 'SimSun, "Songti SC", serif';
  if (!selection?.startsWith('local:')) return '"Microsoft YaHei", "Segoe UI", sans-serif';
  const family = sanitizeLocalFontName(selection.slice(6));
  return family ? `"${family}", "Microsoft YaHei", sans-serif` : '"Microsoft YaHei", "Segoe UI", sans-serif';
}

function sanitizeLocalFontName(value) {
  return String(value || '').replace(/[\r\n\f"\\;{}<>]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function exportAsPdf() {
  const model = getExportModel();
  const rendered = window.JucunPdf.renderDocument(model, getExportOptions(), 1.5);
  const blob = await window.JucunPdf.buildPdf(rendered.canvases, rendered.page, rendered.links);
  downloadFile(blob, `${model.title}.pdf`);
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

function showOperationError(action, error) {
  console.error(`${action}失败`, error);
  showToast(`${action}失败，请重试`);
}

function showConfirm({ eyebrow = '操作确认', title, message, confirmLabel = '确认' }) {
  if (DOM.confirmDialog.open) return Promise.resolve(false);

  const previousFocus = document.activeElement;
  DOM.confirmEyebrow.textContent = eyebrow;
  DOM.confirmTitle.textContent = title;
  DOM.confirmMessage.textContent = message;
  DOM.confirmSubmit.textContent = confirmLabel;
  DOM.confirmDialog.returnValue = 'cancel';
  DOM.confirmDialog.showModal();
  requestAnimationFrame(() => DOM.confirmCancel.focus());

  return new Promise(resolve => {
    DOM.confirmDialog.addEventListener('close', () => {
      const confirmed = DOM.confirmDialog.returnValue === 'confirm';
      if (previousFocus instanceof HTMLElement) {
        requestAnimationFrame(() => {
          if (previousFocus.isConnected) previousFocus.focus();
        });
      }
      resolve(confirmed);
    }, { once: true });
  });
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

async function requestNoteMutation(action, payload = {}) {
  if (globalThis.chrome?.runtime?.sendMessage) {
    const response = await chrome.runtime.sendMessage({
      type: 'JUCUN_MUTATE_NOTES',
      action,
      payload
    });
    if (!response?.ok || !Array.isArray(response.notes)) {
      throw new Error(response?.error || '后台未返回有效的笔记数据');
    }
    return NotesCore.normalizeNotes(response.notes).notes;
  }

  const result = await storageGet({ notes: [] });
  const normalized = NotesCore.normalizeNotes(result.notes);
  const notes = action === 'get'
    ? normalized.notes
    : NotesCore.applyNoteMutation(normalized.notes, action, payload);
  if (action !== 'get' || normalized.changed) await storageSet({ notes });
  return notes;
}

async function requestCategoryDeletion(categoryId) {
  if (globalThis.chrome?.runtime?.sendMessage) {
    const response = await chrome.runtime.sendMessage({
      type: 'JUCUN_DELETE_CATEGORY',
      categoryId
    });
    if (!response?.ok || !Array.isArray(response.notes) || !Array.isArray(response.categories)) {
      throw new Error(response?.error || '后台未返回有效的分类数据');
    }
    return {
      notes: NotesCore.normalizeNotes(response.notes).notes,
      categories: response.categories
    };
  }

  const result = await storageGet({ notes: [], categories: [] });
  const notes = NotesCore.applyNoteMutation(result.notes, 'reassignCategory', {
    categoryId,
    replacementCategoryId: null
  });
  const categories = (Array.isArray(result.categories) ? result.categories : [])
    .filter(category => category.id !== categoryId);
  await storageSet({ notes, categories });
  return { notes, categories };
}

function storageGet(defaults) {
  if (!globalThis.chrome?.storage?.local) {
    const stored = JSON.parse(localStorage.getItem('jucun-preview-data') || '{}');
    return Promise.resolve({ ...defaults, ...stored });
  }
  return new Promise(resolve => chrome.storage.local.get(defaults, resolve));
}

function storageSet(values) {
  if (!globalThis.chrome?.storage?.local) {
    const stored = JSON.parse(localStorage.getItem('jucun-preview-data') || '{}');
    localStorage.setItem('jucun-preview-data', JSON.stringify({ ...stored, ...values }));
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(values, () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve();
    });
  });
}

if (typeof module !== 'undefined') module.exports = { filterSelectedNotes, reconcileVisibleSelection, createExportSnapshot };
