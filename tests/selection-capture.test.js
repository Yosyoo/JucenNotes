const assert = require('node:assert/strict');
const test = require('node:test');

const { serializeFragment } = require('../selection-capture.js');

function text(value) {
  return { nodeType: 3, nodeValue: value };
}

function element(tagName, children = [], display = '') {
  return { nodeType: 1, tagName, childNodes: children, display };
}

function fragment(children) {
  return { nodeType: 11, childNodes: children };
}

test('serializeFragment preserves paragraphs, br, lists and table cells', () => {
  const root = fragment([
    element('P', [text('第一段')], 'block'),
    element('P', [text('第二段'), element('BR'), text('段内换行')], 'block'),
    element('UL', [
      element('LI', [text('项目一')], 'list-item'),
      element('LI', [text('项目二')], 'list-item')
    ], 'block'),
    element('TABLE', [
      element('TR', [
        element('TD', [text('单元格一')], 'table-cell'),
        element('TD', [text('单元格二')], 'table-cell')
      ], 'table-row')
    ], 'table')
  ]);

  assert.equal(
    serializeFragment(root, node => node.display),
    '第一段\n第二段\n段内换行\n项目一\n项目二\n单元格一\t单元格二\n'
  );
});

test('serializeFragment uses computed display for custom block elements', () => {
  const root = fragment([
    element('SPAN', [text('自定义块一')], 'block'),
    element('SPAN', [text('自定义块二')], 'block')
  ]);
  assert.equal(serializeFragment(root, node => node.display), '自定义块一\n自定义块二\n');
});

test('serializeFragment keeps consecutive br as a blank line', () => {
  const root = fragment([text('上文'), element('BR'), element('BR'), text('下文')]);
  assert.equal(serializeFragment(root), '上文\n\n下文');
});
