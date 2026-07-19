const assert = require('node:assert/strict');
const test = require('node:test');
const { selectionFragmentToText } = require('../content.js');

const text = value => ({ nodeType: 3, nodeValue: value });
const element = (tagName, childNodes = []) => ({ nodeType: 1, tagName, childNodes });
const fragment = childNodes => ({ nodeType: 11, childNodes });

test('preserves paragraph and explicit line breaks', () => {
  const selection = fragment([
    element('P', [text('第一行')]),
    element('P', [text('第二行'), element('BR'), text('第三行')])
  ]);

  assert.equal(selectionFragmentToText(selection), '第一行\n第二行\n第三行');
});

test('preserves list items and table layout', () => {
  const selection = fragment([
    element('UL', [element('LI', [text('甲')]), element('LI', [text('乙')])]),
    element('TABLE', [
      element('TR', [element('TD', [text('名称')]), element('TD', [text('数量')])]),
      element('TR', [element('TD', [text('苹果')]), element('TD', [text('2')])])
    ])
  ]);

  assert.equal(selectionFragmentToText(selection), '甲\n乙\n名称\t数量\n苹果\t2');
});

test('collapses source indentation but preserves preformatted text', () => {
  const selection = fragment([
    text('\n  '),
    element('DIV', [text('普通  文本')]),
    element('PRE', [text('a  b\n  c')])
  ]);

  assert.equal(selectionFragmentToText(selection), '普通 文本\na  b\n  c');
});
