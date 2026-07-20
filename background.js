// 初始化：安装后创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-to-note",
    title: "保存到句存",
    contexts: ["selection"] // 只有选中文字时才显示
  });
});

// 点击图标打开管理页面
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'manager.html' });
});

function normalizeSelectionText(text) {
  return String(text || '')
    .replace(/\r\n?|\u2028|\u2029/g, '\n')
    .replace(/[\t\f\v ]+\n/g, '\n')
    .replace(/\n[\t\f\v ]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function chooseBestSelectionText(...texts) {
  const candidates = [...new Set(texts.map(normalizeSelectionText).filter(Boolean))];
  return candidates.sort((left, right) => {
    const lineDifference = (right.match(/\n/g) || []).length - (left.match(/\n/g) || []).length;
    return lineDifference || right.length - left.length;
  })[0] || '';
}

async function getSelectedText(info, tab) {
  if (!tab || typeof tab.id !== 'number') return normalizeSelectionText(info.selectionText);

  try {
    const snapshot = await chrome.tabs.sendMessage(
      tab.id,
      { type: 'JUCUN_GET_SELECTION_SNAPSHOT' },
      { frameId: typeof info.frameId === 'number' ? info.frameId : 0 }
    );
    return chooseBestSelectionText(
      snapshot?.structuredText,
      snapshot?.plainText,
      info.selectionText
    );
  } catch (error) {
    // chrome://、扩展商店及尚未刷新的旧标签页没有内容脚本，使用浏览器文本回退。
    console.warn('无法读取划选快照，已使用浏览器选区文本', error);
    return normalizeSelectionText(info.selectionText);
  }
}

async function saveSelectedText(info, tab) {
  const content = await getSelectedText(info, tab);
  if (!content) return;

  const note = {
    id: Date.now(), // 唯一ID
    content,
    categoryId: null, // 新笔记默认进入“未分类”
    sourceUrl: info.pageUrl || tab?.url || '',
    sourceTitle: tab?.title || '', // 部分浏览器可能取不到，作为备用
    timestamp: new Date().toLocaleString('zh-CN', { hour12: false })
  };

  const result = await chrome.storage.local.get({ notes: [] });
  const notes = Array.isArray(result.notes) ? result.notes : [];
  notes.unshift(note); // 新笔记插在最前面
  await chrome.storage.local.set({ notes });
  console.log('笔记已保存');
}

// 处理右键点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'save-to-note') return;
  saveSelectedText(info, tab).catch(error => console.error('保存笔记失败', error));
});

if (typeof module !== 'undefined') {
  module.exports = { normalizeSelectionText, chooseBestSelectionText, getSelectedText, saveSelectedText };
}
