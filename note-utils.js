(function exposeNoteUtils(globalScope) {
  function filterNotes(notes, query) {
    const terms = String(query || '')
      .trim()
      .toLocaleLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    if (terms.length === 0) return notes;

    return notes.filter(note => {
      const searchableText = [
        note.content,
        note.sourceTitle,
        note.sourceUrl,
        note.timestamp
      ]
        .filter(Boolean)
        .join('\n')
        .toLocaleLowerCase();

      return terms.every(term => searchableText.includes(term));
    });
  }

  function escapeHtml(text) {
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function textToHtmlWithLineBreaks(text) {
    return escapeHtml(text).replace(/\r\n?|\n/g, '<br>');
  }

  function selectNotes(notes, selectedIds) {
    const selected = selectedIds instanceof Set ? selectedIds : new Set(selectedIds || []);
    return notes.filter(note => selected.has(note.id));
  }

  const api = { filterNotes, escapeHtml, textToHtmlWithLineBreaks, selectNotes };

  if (typeof module !== 'undefined') module.exports = api;
  globalScope.NoteUtils = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
