const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

let contextMenuHandler;
let injectionOptions;
let injectedText = '第一行\n第二行';
let savedNotes;

global.chrome = {
  runtime: {
    onInstalled: { addListener() {} }
  },
  contextMenus: {
    create() {},
    onClicked: {
      addListener(handler) {
        contextMenuHandler = handler;
      }
    }
  },
  action: {
    onClicked: { addListener() {} }
  },
  tabs: {
    create() {}
  },
  scripting: {
    async executeScript(options) {
      injectionOptions = options;
      if (injectedText instanceof Error) throw injectedText;
      return [{ result: injectedText }];
    }
  },
  storage: {
    local: {
      get(_defaults, callback) {
        callback({ notes: [] });
      },
      set(value, callback) {
        savedNotes = value.notes;
        if (callback) callback();
      }
    }
  }
};

require('../background.js');

test('injects only into the selected frame and saves formatted text', async () => {
  await contextMenuHandler(
    { menuItemId: 'save-to-note', selectionText: '纯文本', frameId: 7 },
    { id: 42, url: 'https://example.com', title: '示例网页' }
  );

  assert.deepEqual(injectionOptions, {
    target: { tabId: 42, frameIds: [7] },
    files: ['content.js']
  });
  assert.equal(savedNotes[0].content, '第一行\n第二行');
  assert.equal(savedNotes[0].sourceTitle, '示例网页');
});

test('falls back to context menu text on restricted pages', async () => {
  injectedText = new Error('Injection blocked');
  const originalDebug = console.debug;
  console.debug = () => {};

  try {
    await contextMenuHandler(
      { menuItemId: 'save-to-note', selectionText: '回退文本', frameId: 0 },
      { id: 9, url: 'chrome://extensions', title: '扩展程序' }
    );
  } finally {
    console.debug = originalDebug;
  }

  assert.equal(savedNotes[0].content, '回退文本');
});

test('manifest uses scoped, on-demand permissions', () => {
  const manifestPath = path.join(__dirname, '..', 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  assert.equal(manifest.content_scripts, undefined);
  assert.deepEqual(manifest.permissions, ['activeTab', 'contextMenus', 'scripting', 'storage']);
});
