(() => {
  const BLOCK_TAGS = new Set([
    'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DETAILS', 'DIALOG', 'DIV',
    'DL', 'DT', 'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2',
    'H3', 'H4', 'H5', 'H6', 'HEADER', 'HGROUP', 'HR', 'LI', 'MAIN', 'NAV', 'OL',
    'P', 'PRE', 'SECTION', 'SUMMARY', 'TABLE', 'TBODY', 'TFOOT', 'THEAD', 'TR', 'UL'
  ]);
  const BLOCK_DISPLAYS = new Set([
    'block', 'flow-root', 'flex', 'grid', 'list-item', 'table', 'table-caption',
    'table-header-group', 'table-footer-group', 'table-row-group', 'table-row'
  ]);
  const MAX_SNAPSHOT_AGE = 2 * 60 * 1000;
  let latestSnapshot = null;

  function serializeFragment(root, displayFor = () => '') {
    let output = '';

    const trimLineEnd = () => { output = output.replace(/[\t ]+$/g, ''); };
    const ensureBreak = () => {
      trimLineEnd();
      if (output && !output.endsWith('\n')) output += '\n';
    };
    const appendHardBreak = () => {
      trimLineEnd();
      output += '\n';
    };

    function visit(node) {
      if (node.nodeType === 3) {
        output += node.nodeValue || '';
        return;
      }
      if (node.nodeType !== 1 && node.nodeType !== 11) return;

      const tagName = node.nodeType === 1 ? node.tagName : '';
      if (tagName === 'BR') {
        appendHardBreak();
        return;
      }

      const display = node.nodeType === 1 ? displayFor(node) : '';
      if (display === 'none') return;
      const isCell = tagName === 'TD' || tagName === 'TH' || display === 'table-cell';
      const isBlock = BLOCK_TAGS.has(tagName) || BLOCK_DISPLAYS.has(display);
      if (isBlock && !isCell) ensureBreak();

      for (const child of node.childNodes || []) visit(child);

      if (isCell) output += '\t';
      else if (isBlock) ensureBreak();
    }

    visit(root);
    return output.replace(/[\t ]+\n/g, '\n').replace(/[\t ]+$/g, '');
  }

  function getStructuredSelectionText(selection) {
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return '';

    const container = document.createElement('div');
    Object.assign(container.style, {
      position: 'fixed',
      left: '-100000px',
      top: '0',
      width: '10000px',
      visibility: 'hidden',
      pointerEvents: 'none'
    });

    for (let index = 0; index < selection.rangeCount; index += 1) {
      if (index) container.appendChild(document.createElement('br'));
      container.appendChild(selection.getRangeAt(index).cloneContents());
    }

    (document.body || document.documentElement).appendChild(container);
    try {
      return serializeFragment(container, element => getComputedStyle(element).display);
    } finally {
      container.remove();
    }
  }

  function getControlSelection(event) {
    const target = event.composedPath?.().find(node =>
      node && (node.tagName === 'TEXTAREA' || node.tagName === 'INPUT')
    );
    if (!target || typeof target.selectionStart !== 'number' || target.selectionStart === target.selectionEnd) return '';
    return String(target.value || '').slice(target.selectionStart, target.selectionEnd);
  }

  function captureSelection(event) {
    const controlText = getControlSelection(event);
    const selection = window.getSelection();
    const plainText = controlText || selection?.toString() || '';
    const structuredText = controlText || getStructuredSelectionText(selection);
    if (!plainText && !structuredText) {
      latestSnapshot = null;
      return;
    }
    latestSnapshot = { plainText, structuredText, capturedAt: Date.now() };
  }

  const api = { serializeFragment, getStructuredSelectionText };
  globalThis.JucunSelectionCapture = api;
  if (typeof module !== 'undefined') module.exports = api;

  if (typeof document === 'undefined' || typeof chrome === 'undefined') return;
  // 在事件路径最前端保存快照，避免网页自己的右键处理先清空 Selection。
  window.addEventListener('contextmenu', captureSelection, true);
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'JUCUN_GET_SELECTION_SNAPSHOT') return;
    if (!latestSnapshot || Date.now() - latestSnapshot.capturedAt > MAX_SNAPSHOT_AGE) {
      sendResponse(null);
      return;
    }
    sendResponse(latestSnapshot);
  });
})();
