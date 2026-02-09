/*
 * 句存 - 轻笔记管理脚本
 * 负责笔记的加载、编辑、删除、导出等功能
 */

// ==================== DOM 缓存 ====================
// 缓存常用的 DOM 元素，避免重复查询
const DOM = {
  listEl: document.getElementById('note-list'),           // 笔记列表容器
  clearBtn: document.getElementById('clear-all'),         // 清空全部按钮
  exportBtn: document.getElementById('export-btn'),       // 导出按钮
  exportMenu: document.getElementById('export-menu')      // 导出菜单
};

// ==================== 页面初始化 ====================
document.addEventListener('DOMContentLoaded', init);

/**
 * 初始化函数
 * 页面加载完成后执行
 */
function init() {
  loadNotes();
  bindEvents();
}

/**
 * 绑定所有事件监听器
 */
function bindEvents() {
  // 清空按钮事件
  DOM.clearBtn.addEventListener('click', clearAllNotes);

  // 导出按钮事件
  DOM.exportBtn.addEventListener('click', toggleExportMenu);

  // 导出选项事件
  const exportOptions = document.querySelectorAll('.export-option');
  exportOptions.forEach(option => {
    option.addEventListener('click', handleExport);
  });

  // 点击菜单外部关闭菜单
  document.addEventListener('click', closeExportMenuOnClickOutside);
}

// ==================== 笔记管理 ====================

/**
 * 从存储中加载笔记
 */
function loadNotes() {
  chrome.storage.local.get({ notes: [] }, (result) => {
    renderNotes(result.notes);
  });
}

/**
 * 渲染笔记列表到页面
 * @param {Array} notes - 笔记数组
 */
function renderNotes(notes) {
  DOM.listEl.innerHTML = '';

  // 如果没有笔记，显示空状态提示
  if (notes.length === 0) {
    DOM.listEl.innerHTML = `
      <div style="text-align:center; padding: 60px 0; color:#86868B;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#D1D1D6" stroke-width="1">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        <p>- 浮生暂寄梦中梦 -</p>
      </div>`;
    return;
  }

  // 创建并添加每条笔记的卡片
  notes.forEach((note) => {
    DOM.listEl.appendChild(createNoteCard(note));
  });

  // 为新创建的笔记卡片绑定交互事件
  bindNoteEvents();
}

/**
 * 创建单条笔记的卡片 DOM 元素
 * @param {Object} note - 笔记对象 { id, content, timestamp, sourceUrl, sourceTitle }
 * @returns {HTMLElement} 笔记卡片元素
 */
function createNoteCard(note) {
  const div = document.createElement('div');
  div.className = 'note-card';

  const pageTitle = note.sourceTitle || note.sourceUrl;
  const metaHtml = buildMetaHtml(note, pageTitle);

  div.innerHTML = `
    <div class="delete-btn" data-id="${note.id}" title="删除">×</div>
    <div class="note-content" 
         contenteditable="true" 
         data-id="${note.id}" 
         title="点击即可编辑内容">${escapeHtml(note.content)}</div>
    ${metaHtml}
  `;

  return div;
}

/**
 * 构建笔记的元数据 HTML（时间和来源信息）
 * @param {Object} note - 笔记对象
 * @param {string} pageTitle - 页面标题
 * @returns {string} 元数据 HTML 字符串
 */
function buildMetaHtml(note, pageTitle) {
  return `<div class="note-meta">
    <span class="meta-time">${note.timestamp}</span>
    <span class="meta-source screen-only">来自: <a href="${note.sourceUrl}" target="_blank">${escapeHtml(pageTitle)}</a></span>
    <span class="meta-source print-only" style="display:none">
      来自: <a href="${note.sourceUrl}">${escapeHtml(pageTitle)}</a>
    </span>
  </div>`;
}

/**
 * 绑定笔记卡片的交互事件（删除、编辑）
 */
function bindNoteEvents() {
  // 删除按钮事件
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteNote(parseInt(e.target.dataset.id));
    });
  });

  // 笔记内容编辑事件
  document.querySelectorAll('.note-content').forEach(el => {
    el.addEventListener('focus', (e) => {
      // 进入编辑状态时添加编辑类
      e.target.closest('.note-card').classList.add('editing');
    });

    el.addEventListener('blur', (e) => {
      // 编辑完成后移除编辑类并保存
      e.target.closest('.note-card').classList.remove('editing');
      updateNoteContent(parseInt(e.target.dataset.id), e.target.innerText);
    });
  });

  // 为每个卡片添加鼠标移动监听，使光晕跟随鼠标
  document.querySelectorAll('.note-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      card.style.setProperty('--mouse-x', x + '%');
      card.style.setProperty('--mouse-y', y + '%');
    });

    card.addEventListener('mouseleave', () => {
      // 鼠标离开时重置到中心，视觉上渐隐
      card.style.setProperty('--mouse-x', '50%');
      card.style.setProperty('--mouse-y', '50%');
    });
  });
}

/**
 * 更新笔记内容到存储
 * @param {number} id - 笔记 ID
 * @param {string} newContent - 新内容
 */
function updateNoteContent(id, newContent) {
  chrome.storage.local.get({ notes: [] }, (result) => {
    const noteIndex = result.notes.findIndex(n => n.id === id);

    // 仅在内容确实改变时更新存储
    if (noteIndex !== -1 && result.notes[noteIndex].content !== newContent) {
      result.notes[noteIndex].content = newContent;
      chrome.storage.local.set({ notes: result.notes });
    }
  });
}

/**
 * 删除单条笔记
 * @param {number} id - 笔记 ID
 */
function deleteNote(id) {
  if (!confirm('确定删除这条笔记吗？')) return;

  chrome.storage.local.get({ notes: [] }, (result) => {
    const newNotes = result.notes.filter(n => n.id !== id);
    chrome.storage.local.set({ notes: newNotes }, loadNotes);
  });
}

/**
 * 清空所有笔记
 */
function clearAllNotes() {
  if (confirm('确定清空所有笔记吗？此操作不可恢复！')) {
    chrome.storage.local.set({ notes: [] }, loadNotes);
  }
}

// ==================== 导出菜单控制 ====================

/**
 * 切换导出菜单的显示/隐藏
 */
function toggleExportMenu() {
  DOM.exportMenu.classList.toggle('show');
}

/**
 * 点击菜单外部时关闭菜单
 * @param {Event} e - 点击事件
 */
function closeExportMenuOnClickOutside(e) {
  if (!e.target.closest('.export-menu-wrapper')) {
    DOM.exportMenu.classList.remove('show');
  }
}

/**
 * 处理导出选项的点击事件
 * @param {Event} e - 点击事件
 */
function handleExport(e) {
  const format = e.currentTarget.dataset.format;
  DOM.exportMenu.classList.remove('show');

  // 根据选择的格式调用对应的导出函数
  switch (format) {
    case 'txt':
      exportAsTxt();
      break;
    case 'word':
      exportAsWord();
      break;
    case 'pdf':
      exportAsPdf();
      break;
  }
}

// ==================== 导出功能 ====================

/**
 * 获取导出选项（是否包含时间和来源）
 * @returns {Object} { source: boolean, time: boolean }
 */
function getOptions() {
  return {
    source: document.getElementById('export-include-source').checked,
    time: document.getElementById('export-include-time').checked
  };
}

/**
 * 导出为纯文本格式 (TXT)
 */
function exportAsTxt() {
  chrome.storage.local.get({ notes: [] }, (result) => {
    const opts = getOptions();
    let text = "";

    result.notes.forEach(note => {
      text += note.content + "\n";
      if (opts.time) text += `时间: ${note.timestamp}\n`;
      if (opts.source) {
        const title = note.sourceTitle || "未知网页";
        text += `来源: ${title} (${note.sourceUrl})\n`;
      }
      text += "--------------------------------------------------\n\n";
    });

    downloadFile(new Blob([text], { type: "text/plain;charset=utf-8" }), "my-notes.txt");
  });
}

/**
 * 导出为 Microsoft Word 格式 (DOCX)
 */
function exportAsWord() {
  const opts = getOptions();

  chrome.storage.local.get({ notes: [] }, (result) => {
    let html = `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
  <style>
    /* 基础样式 */
    body { 
      font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      margin: 1in;
      color: #1D1D1F;
    }
    
    /* 笔记项目样式 */
    .note-item { 
      margin-bottom: 24pt; 
      page-break-inside: avoid;
    }
    
    /* 笔记标题（正文）样式 */
    .note-title { 
      font-weight: normal; 
      font-size: 12pt; 
      margin-bottom: 8pt;
      font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
      color: #000000;
    }
    
    /* 元数据（时间、来源）样式 */
    .note-meta { 
      font-size: 10pt; 
      color: #666666; 
      margin-bottom: 8pt;
      font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
    }
    
    /* 元数据行样式 */
    .note-meta-line { 
      margin-bottom: 4pt;
      display: block;
    }
    
    /* 链接样式 */
    .note-meta a {
      color: #0071E3;
      text-decoration: none;
    }
    
    /* 分隔线样式 */
    hr { 
      border: none; 
      border-top: 1px solid #dddddd; 
      margin: 16pt 0;
    }
    
    /* 文档标题样式 */
    h1 {
      text-align: left;
      font-size: 18pt;
      margin-bottom: 30pt;
      font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
      font-weight: normal;
      color: #000000;
    }
  </style>
</head>
<body>`;

    // 添加文档标题
    html += `<h1>全部笔记</h1>`;

    // 循环添加每条笔记
    result.notes.forEach(note => {
      html += `<div class="note-item">`;
      html += `<div class="note-title">${escapeHtml(note.content)}</div>`;

      // 根据用户选择添加元数据
      if (opts.time || opts.source) {
        html += `<div class="note-meta">`;
        if (opts.time) html += `<span class="note-meta-line">时间: ${note.timestamp}</span>`;
        if (opts.source) {
          const title = note.sourceTitle || note.sourceUrl;
          html += `<span class="note-meta-line">来源: <a href="${note.sourceUrl}">${escapeHtml(title)}</a></span>`;
        }
        html += `</div>`;
      }

      html += `<hr></div>`;
    });

    html += `</body></html>`;

    // 创建 Blob 并下载（使用标准 Office Open XML MIME 类型）
    const blob = new Blob([html], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    downloadFile(blob, "my-notes.docx");
  });
}

/**
 * 导出为 PDF 格式
 * 使用浏览器的打印功能生成 PDF
 */
function exportAsPdf() {
  const opts = getOptions();
  document.body.classList.add('printing-mode');

  // 当用户选择不包含来源时，通过添加类强制隐藏（覆盖 CSS 中的 !important）
  if (!opts.source) document.body.classList.add('hide-source');

  // 获取需要控制显示的元素（仍保留用于屏幕即时预览回退）
  const timeDoms = document.querySelectorAll('.meta-time');
  const sourceDoms = document.querySelectorAll('.meta-source');

  // 根据用户选择显示或隐藏元数据（用于屏幕预览）
  timeDoms.forEach(el => el.style.display = opts.time ? '' : 'none');
  sourceDoms.forEach(el => el.style.display = opts.source ? '' : 'none');

  // 打开打印对话框
  window.print();

  // 恢复页面状态
  document.body.classList.remove('printing-mode');
  if (!opts.source) document.body.classList.remove('hide-source');
  timeDoms.forEach(el => el.style.display = '');
  sourceDoms.forEach(el => el.style.display = '');
}

/**
 * 通过创建虚拟链接的方式下载文件
 * @param {Blob} blob - 文件内容
 * @param {string} filename - 文件名
 */
function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 转义 HTML 特殊字符
 * @param {string} text - 需要转义的文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")    // & → &amp;
    .replace(/</g, "&lt;")     // < → &lt;
    .replace(/>/g, "&gt;")     // > → &gt;
    .replace(/"/g, "&quot;")   // " → &quot;
    .replace(/'/g, "&#039;");  // ' → &#039;
}
