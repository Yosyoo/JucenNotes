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

// 处理右键点击事件
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-to-note") {
    const note = {
      id: Date.now(), // 唯一ID
      content: info.selectionText,
      sourceUrl: tab.url,
      sourceTitle: tab.title, // 部分浏览器可能取不到，作为备用
      timestamp: new Date().toLocaleString('zh-CN', { hour12: false })
    };

    // 保存到 storage
    chrome.storage.local.get({ notes: [] }, (result) => {
      const notes = result.notes;
      notes.unshift(note); // 新笔记插在最前面
      chrome.storage.local.set({ notes: notes }, () => {
        // 可选：发送通知确认保存成功（这里为了简洁省略）
        console.log("笔记已保存");
      });
    });
  }
});