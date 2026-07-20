const assert = require('node:assert/strict');
const test = require('node:test');

function loadBackground({ sendMessage, notes = [] } = {}) {
  const writes = [];
  global.chrome = {
    runtime: { onInstalled: { addListener() {} } },
    contextMenus: {
      create() {},
      onClicked: { addListener() {} }
    },
    action: { onClicked: { addListener() {} } },
    tabs: {
      create() {},
      sendMessage: sendMessage || (async () => null)
    },
    storage: {
      local: {
        async get() { return { notes: [...notes] }; },
        async set(value) { writes.push(value); }
      }
    }
  };

  const modulePath = require.resolve('../background.js');
  delete require.cache[modulePath];
  return { background: require(modulePath), writes };
}

test('normalizeSelectionText unifies browser newline characters', () => {
  const { background } = loadBackground();
  assert.equal(
    background.normalizeSelectionText('  第一段\r\n第二段\u2028第三段\u2029\n\n\n第四段  '),
    '第一段\n第二段\n第三段\n\n第四段'
  );
});

test('getSelectedText prefers DOM text and targets the selected frame', async () => {
  let request;
  const { background } = loadBackground({
    sendMessage: async (tabId, message, options) => {
      request = { tabId, message, options };
      return { structuredText: '段落一\r\n段落二', plainText: '段落一段落二' };
    }
  });

  const text = await background.getSelectedText(
    { selectionText: '缺少换行的文本', frameId: 7 },
    { id: 42 }
  );

  assert.equal(text, '段落一\n段落二');
  assert.deepEqual(request, {
    tabId: 42,
    message: { type: 'JUCUN_GET_SELECTION_SNAPSHOT' },
    options: { frameId: 7 }
  });
});

test('getSelectedText falls back when the page has no capture script', async () => {
  const { background } = loadBackground({
    sendMessage: async () => { throw new Error('restricted page'); }
  });
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    const text = await background.getSelectedText(
      { selectionText: '第一段\u2028第二段' },
      { id: 10 }
    );
    assert.equal(text, '第一段\n第二段');
  } finally {
    console.warn = originalWarn;
  }
});

test('saveSelectedText stores normalized multi-paragraph content', async () => {
  const { background, writes } = loadBackground({
    notes: [{ id: 1, content: '旧笔记' }],
    sendMessage: async () => ({
      structuredText: '新笔记第一段\n\n新笔记第二段',
      plainText: '新笔记第一段新笔记第二段'
    })
  });

  await background.saveSelectedText(
    { selectionText: '回退文本', pageUrl: 'https://example.com/article' },
    { id: 3, title: '示例文章' }
  );

  assert.equal(writes.length, 1);
  assert.equal(writes[0].notes[0].content, '新笔记第一段\n\n新笔记第二段');
  assert.equal(writes[0].notes[0].sourceUrl, 'https://example.com/article');
  assert.equal(writes[0].notes[1].content, '旧笔记');
});

test('chooseBestSelectionText never replaces a richer browser result with flattened text', () => {
  const { background } = loadBackground();
  assert.equal(
    background.chooseBestSelectionText('第一段第二段', '第一段\n第二段'),
    '第一段\n第二段'
  );
});
