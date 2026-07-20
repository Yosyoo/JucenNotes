const assert = require('node:assert/strict');
const test = require('node:test');

const { filterSelectedNotes, reconcileVisibleSelection, createExportSnapshot } = require('../manager.js');

test('selection survives refreshed note objects by using stable ids', () => {
  const first = { id: 1, content: '第一条' };
  const second = { id: 2, content: '第二条' };
  const refreshedNotes = [{ ...first }, { ...second }, { id: 3, content: '第三条' }];

  assert.deepEqual(filterSelectedNotes(refreshedNotes, new Set(['2'])), [refreshedNotes[1]]);
  assert.deepEqual(filterSelectedNotes(refreshedNotes, new Set()), []);
});

test('export snapshot contains only selected notes and is isolated from later changes', () => {
  const selected = { id: 7, content: '需要导出的内容' };
  const unselected = { id: 8, content: '不应导出的内容' };
  const snapshot = createExportSnapshot(filterSelectedNotes([selected, unselected], new Set(['7'])));

  selected.content = '导出窗口打开后的修改';
  assert.deepEqual(snapshot, [{ id: 7, content: '需要导出的内容' }]);
});

test('selected export follows the changed selection after a previous export', () => {
  const notes = [1, 2, 3, 4].map(id => ({ id, content: `笔记 ${id}` }));
  const selectedNotes = new Set(['1', '2']);

  assert.deepEqual(filterSelectedNotes(notes, selectedNotes), [notes[0], notes[1]]);

  selectedNotes.delete('1');
  selectedNotes.add('4');
  assert.deepEqual(filterSelectedNotes(notes, selectedNotes), [notes[1], notes[3]]);
});

test('live checkbox state wins when exporting immediately after unchecking', () => {
  const notes = [1, 2, 3, 4].map(id => ({ id, content: `笔记 ${id}` }));
  const staleSelection = new Set(['1', '2', '3', '4']);
  const reconciled = reconcileVisibleSelection(staleSelection, [
    { note: notes[0], checked: false },
    { note: notes[1], checked: true },
    { note: notes[2], checked: false },
    { note: notes[3], checked: true }
  ]);

  assert.deepEqual(filterSelectedNotes(notes, reconciled), [notes[1], notes[3]]);
});
