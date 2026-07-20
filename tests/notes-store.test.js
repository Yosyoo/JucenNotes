const assert = require('node:assert/strict');
const test = require('node:test');

const { applyNoteMutation, normalizeNotes, noteIdKey } = require('../notes-store.js');

test('normalization assigns distinct stable ids to duplicate and missing ids', () => {
  const original = [
    { id: 1, content: '第一条' },
    { id: 1, content: '重复 ID' },
    { content: '缺少 ID' }
  ];
  const { notes, changed } = normalizeNotes(original);
  const ids = notes.map(note => noteIdKey(note.id));

  assert.equal(changed, true);
  assert.equal(new Set(ids).size, 3);
  assert.equal(ids[0], '1');
});

test('note mutations only affect the exact stable id', () => {
  const notes = [
    { id: 'one', content: '第一条' },
    { id: 'two', content: '第二条' }
  ];
  const updated = applyNoteMutation(notes, 'updateContent', { id: 'two', content: '已更新' });
  const deleted = applyNoteMutation(updated, 'delete', { ids: ['one'] });

  assert.deepEqual(updated.map(note => note.content), ['第一条', '已更新']);
  assert.deepEqual(deleted, [{ id: 'two', content: '已更新' }]);
});
