(function extractSelection() {
const BLOCK_TAGS = new Set([
  'ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'DD', 'DIV', 'DL', 'DT',
  'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3',
  'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE',
  'SECTION', 'TABLE', 'TBODY', 'TFOOT', 'THEAD', 'TR', 'UL'
]);

/**
 * 将选区克隆出的 DOM 转为纯文本，同时保留网页的语义换行。
 * @param {Node} root - Range.cloneContents() 返回的 DocumentFragment
 * @returns {string}
 */
function selectionFragmentToText(root) {
  let output = '';

  const trimTrailingHorizontalSpace = () => {
    output = output.replace(/[ \t]+$/g, '');
  };

  const ensureLineBreak = () => {
    trimTrailingHorizontalSpace();
    if (output && !output.endsWith('\n')) output += '\n';
  };

  const appendExplicitLineBreak = () => {
    trimTrailingHorizontalSpace();
    output += '\n';
  };

  const appendText = (value, preserveWhitespace) => {
    if (!value) return;

    if (preserveWhitespace) {
      output += value.replace(/\r\n?/g, '\n');
      return;
    }

    let normalized = value.replace(/\s+/g, ' ');
    if (output.endsWith('\n')) normalized = normalized.trimStart();
    if (output.endsWith(' ') && normalized.startsWith(' ')) normalized = normalized.slice(1);
    output += normalized;
  };

  const walk = (node, preserveWhitespace = false) => {
    if (node.nodeType === 3) {
      appendText(node.nodeValue, preserveWhitespace);
      return;
    }

    if (node.nodeType !== 1 && node.nodeType !== 11) return;

    const tagName = node.nodeType === 1 ? node.tagName : '';
    if (tagName === 'BR') {
      appendExplicitLineBreak();
      return;
    }

    const isBlock = BLOCK_TAGS.has(tagName);
    const isTableCell = tagName === 'TD' || tagName === 'TH';
    const shouldPreserveWhitespace = preserveWhitespace || tagName === 'PRE';

    if (isBlock) ensureLineBreak();
    Array.from(node.childNodes || []).forEach(child => walk(child, shouldPreserveWhitespace));

    if (isTableCell) {
      trimTrailingHorizontalSpace();
      if (output && !output.endsWith('\n')) output += '\t';
    }

    if (isBlock) ensureLineBreak();
  };

  walk(root);

  return output
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function getFormattedSelection() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return '';

  const parts = [];
  for (let index = 0; index < selection.rangeCount; index += 1) {
    const text = selectionFragmentToText(selection.getRangeAt(index).cloneContents());
    if (text) parts.push(text);
  }

  return parts.join('\n').trim() || selection.toString().trim();
}

if (typeof module !== 'undefined') {
  module.exports = { selectionFragmentToText };
}

if (typeof window !== 'undefined') return getFormattedSelection();
return '';
})();
