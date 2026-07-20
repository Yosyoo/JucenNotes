const assert = require('node:assert/strict');
const test = require('node:test');

class FakeContext {
  constructor() { this.text = []; }
  setTransform() {}
  fillRect() {}
  beginPath() {}
  arcTo() {}
  closePath() {}
  fill() {}
  stroke() {}
  arc() {}
  moveTo() {}
  measureText(value) { return { width: String(value).length * 7 }; }
  fillText(value, x, y) { this.text.push({ value: String(value), x, y }); }
}

class FakeCanvas {
  constructor() { this.context = new FakeContext(); }
  getContext() { return this.context; }
}

global.document = { createElement: () => new FakeCanvas() };
const { renderDocument } = require('../pdf-export.js');

test('a long note moved to a fresh page keeps its category and respects the content boundary', () => {
  const options = {
    paperSize: 'a5',
    orientation: 'portrait',
    margin: 'standard',
    pageNumber: true,
    fontFamily: 'sans',
    fontSize: 14,
    lineHeight: 'compact',
    template: 'minimal',
    category: true,
    time: true,
    source: false
  };
  const rendered = renderDocument({
    title: '分页测试',
    notes: [
      { content: 'a'.repeat(1320), timestamp: 't1', category: { name: 'A', color: '#0071e3' } },
      { content: 'x'.repeat(4000), timestamp: 't2', category: { name: 'B', color: '#ff0000' } }
    ]
  }, options, 1);
  const allText = rendered.canvases.flatMap((canvas, pageIndex) =>
    canvas.context.text.map(item => ({ ...item, page: pageIndex + 1 }))
  );
  const secondNoteLines = allText.filter(item => /^x+$/.test(item.value));

  assert.equal(allText.some(item => item.value === 'B'), true);
  assert.equal(secondNoteLines.every(item => item.y <= 716), true);
});
