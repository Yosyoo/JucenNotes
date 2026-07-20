/* 句存 - 笔记数据模型与纯函数操作 */

(function (root, factory) {
  const api = factory();
  root.JucunNotes = api;
  if (typeof module !== 'undefined') module.exports = api;
}(globalThis, () => {
  'use strict';

  function createNoteId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function noteIdKey(value) {
    return value == null ? '' : String(value);
  }

  function normalizeNotes(value) {
    const source = Array.isArray(value) ? value : [];
    const seen = new Set();
    let changed = !Array.isArray(value);
    const notes = source.map(item => {
      const note = item && typeof item === 'object' ? item : { content: String(item ?? '') };
      let id = note.id;
      let key = noteIdKey(id);
      if (!key || seen.has(key)) {
        do {
          id = createNoteId();
          key = noteIdKey(id);
        } while (seen.has(key));
        changed = true;
      }
      seen.add(key);
      if (note !== item || id !== note.id) return { ...note, id };
      return note;
    });
    return { notes, changed };
  }

  function applyNoteMutation(value, action, payload = {}) {
    const notes = normalizeNotes(value).notes;
    if (action === 'get') return notes;

    if (action === 'create') {
      const usedIds = new Set(notes.map(note => noteIdKey(note.id)));
      const note = { ...(payload.note || {}) };
      let key = noteIdKey(note.id);
      if (!key || usedIds.has(key)) {
        do {
          note.id = createNoteId();
          key = noteIdKey(note.id);
        } while (usedIds.has(key));
      }
      return [note, ...notes];
    }

    if (action === 'updateContent') {
      const targetId = noteIdKey(payload.id);
      return notes.map(note => noteIdKey(note.id) === targetId
        ? { ...note, content: String(payload.content ?? '') }
        : note);
    }

    if (action === 'moveCategory') {
      const targetId = noteIdKey(payload.id);
      return notes.map(note => noteIdKey(note.id) === targetId
        ? { ...note, categoryId: payload.categoryId || null }
        : note);
    }

    if (action === 'delete') {
      const targetIds = new Set((payload.ids || []).map(noteIdKey).filter(Boolean));
      return notes.filter(note => !targetIds.has(noteIdKey(note.id)));
    }

    if (action === 'reassignCategory') {
      return notes.map(note => note.categoryId === payload.categoryId
        ? { ...note, categoryId: payload.replacementCategoryId || null }
        : note);
    }

    throw new Error(`未知的笔记操作：${action}`);
  }

  return { createNoteId, noteIdKey, normalizeNotes, applyNoteMutation };
}));
