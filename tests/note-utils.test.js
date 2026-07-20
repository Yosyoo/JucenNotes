const assert = require('node:assert/strict');
const test = require('node:test');
const { filterNotes, textToHtmlWithLineBreaks, selectNotes } = require('../note-utils.js');

const notes = [
  { content: '第一行\n第二行', sourceTitle: '示例网页', sourceUrl: 'https://example.com', timestamp: '2026/7/19 10:00:00' },
  { content: '购物清单', sourceTitle: '生活记录', sourceUrl: 'https://notes.example', timestamp: '2026/7/18 09:00:00' }
];

test('searches content and metadata case-insensitively', () => {
  assert.equal(filterNotes(notes, '第二行').length, 1);
  assert.equal(filterNotes(notes, 'EXAMPLE').length, 2);
  assert.equal(filterNotes(notes, 'EXAMPLE.COM').length, 1);
  assert.equal(filterNotes(notes, '生活 购物').length, 1);
  assert.equal(filterNotes(notes, '不存在').length, 0);
});

test('keeps all notes for an empty query', () => {
  assert.equal(filterNotes(notes, '   '), notes);
});

test('escapes markup and converts newlines for Word export', () => {
  assert.equal(textToHtmlWithLineBreaks('<第一行>\n第二行 &'), '&lt;第一行&gt;<br>第二行 &amp;');
});

test('selects export notes in their original order', () => {
  const notesWithIds = notes.map((note, index) => ({ ...note, id: index + 1 }));
  assert.deepEqual(
    selectNotes(notesWithIds, new Set([2])),
    [notesWithIds[1]]
  );
  assert.deepEqual(selectNotes(notesWithIds, []), []);
});
