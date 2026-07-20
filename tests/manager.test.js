const assert = require('node:assert/strict');
const test = require('node:test');

const { filterSelectedNotes, reconcileVisibleSelection, createExportSnapshot } = require('../manager.js');

test('selection distinguishes notes that have duplicate ids', () => {
  const first = { id: 1, content: '第一条' };
  const duplicate = { id: 1, content: '重复 ID 的第二条' };
  const notes = [first, duplicate, { id: 3, content: '第三条' }];

  assert.deepEqual(filterSelectedNotes(notes, new Set([duplicate])), [duplicate]);
  assert.deepEqual(filterSelectedNotes(notes, new Set()), []);
});

test('export snapshot contains only selected notes and is isolated from later changes', () => {
  const selected = { id: 7, content: '需要导出的内容' };
  const unselected = { id: 7, content: '不应导出的内容' };
  const snapshot = createExportSnapshot(filterSelectedNotes([selected, unselected], new Set([selected])));

  selected.content = '导出窗口打开后的修改';
  assert.deepEqual(snapshot, [{ id: 7, content: '需要导出的内容' }]);
});

test('selected export follows the changed selection after a previous export', () => {
  const notes = [1, 2, 3, 4].map(id => ({ id, content: `笔记 ${id}` }));
  const selectedNotes = new Set([notes[0], notes[1]]);

  assert.deepEqual(filterSelectedNotes(notes, selectedNotes), [notes[0], notes[1]]);

  selectedNotes.delete(notes[0]);
  selectedNotes.add(notes[3]);
  assert.deepEqual(filterSelectedNotes(notes, selectedNotes), [notes[1], notes[3]]);
});

test('live checkbox state wins when exporting immediately after unchecking', () => {
  const notes = [1, 2, 3, 4].map(id => ({ id, content: `笔记 ${id}` }));
  const staleSelection = new Set(notes);
  const reconciled = reconcileVisibleSelection(staleSelection, [
    { note: notes[0], checked: false },
    { note: notes[1], checked: true },
    { note: notes[2], checked: false },
    { note: notes[3], checked: true }
  ]);

  assert.deepEqual(filterSelectedNotes(notes, reconciled), [notes[1], notes[3]]);
});
