// 初始化：安装后创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "save-to-note",
    title: "保存到 LightNote",
    contexts: ["selection"] // 只有选中文字时才显示
  });
});

// 点击图标打开管理页面
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: 'manager.html' });
});

async function getFormattedSelection(info, tab) {
  if (!tab?.id) return info.selectionText || '';

  try {
    const [injection] = await chrome.scripting.executeScript({
      target: {
        tabId: tab.id,
        frameIds: [info.frameId || 0]
      },
      files: ['content.js']
    });
    return injection?.result || info.selectionText || '';
  } catch (error) {
    // Chrome 内置页面等不允许注入脚本，回退到右键菜单提供的文本。
    console.debug('无法读取页面选区格式，已使用纯文本回退。', error);
    return info.selectionText || '';
  }
}

// 处理右键点击事件
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "save-to-note") return;

  const content = await getFormattedSelection(info, tab);
  if (!content) return;

  const note = {
    id: Date.now(), // 唯一ID
    content,
    sourceUrl: tab.url,
    sourceTitle: tab.title, // 部分浏览器可能取不到，作为备用
    timestamp: new Date().toLocaleString('zh-CN', { hour12: false })
  };

  // 保存到 storage
  chrome.storage.local.get({ notes: [] }, (result) => {
    const notes = result.notes;
    notes.unshift(note); // 新笔记插在最前面
    chrome.storage.local.set({ notes: notes }, () => {
      console.log("笔记已保存");
    });
  });
});
