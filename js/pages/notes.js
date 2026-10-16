/* =====================================================================
   NOTES PAGE (Developer mode only)  —  a to-do list of changes you want
   to make to the app, laid out like Apple Reminders.
   Type and press return to add one. Tick it: it greys out, then slides
   away. Only the KEEP_COMPLETED most recent ticked notes are kept.
   The list is one record (kind: "notes"), so it syncs between devices.
   ===================================================================== */

const KEEP_COMPLETED = 5;
const FADE_SECONDS = 1.5;   // how long a ticked note stays (greyed out) before it goes

function notesRecord() {
  const id = idPrefix() + "notes";
  return records[id] || { id, kind: "notes", items: [] };
}

function renderNotes() {
  const list = notesRecord();
  // A note ticked in the last moment stays in the list, greyed out, before it goes.
  const showing = list.items.filter(n => !n.done || state.fadingNotes[n.id]);
  const completed = list.items.filter(n => n.done && !state.fadingNotes[n.id]);
  const toDo = list.items.filter(n => !n.done).length;

  return `
    <h1 class="reminders-title">Changes to make<span>${toDo}</span></h1>
    <div class="reminders">
      ${showing.map(reminderRow).join("")}
      <label class="reminder">
        <span class="circle add">+</span>
        <input id="new-reminder" class="reminder-text" placeholder="New Reminder" enterkeyhint="done"
               onkeydown="if (event.key === 'Enter') addReminder(this.value)">
      </label>
    </div>
    ${completed.length ? `
      <button class="btn-small show-completed" onclick="state.showCompleted = !state.showCompleted; render()">
        ${state.showCompleted ? "Hide" : "Show"} completed (${completed.length})
      </button>` : ""}
    ${state.showCompleted && completed.length ? `<div class="reminders">${completed.map(reminderRow).join("")}</div>` : ""}`;
}

function reminderRow(note) {
  return `
    <div class="reminder ${note.done ? "done" : ""}">
      <button class="circle" aria-label="${note.done ? "Mark not done" : "Mark done"}" onclick="toggleReminder('${note.id}')"></button>
      <input class="reminder-text" value="${escapeHtml(note.text)}" onchange="editReminder('${note.id}', this.value)">
    </div>`;
}

function saveNotes(list) {
  saveRecord(list);
  render();
}

function addReminder(text) {
  text = text.trim();
  if (!text) return;
  const list = notesRecord();
  list.items.push({ id: newId(), text, done: false });
  saveNotes(list);
  $("#new-reminder").focus();   // ready for the next one
}

function editReminder(id, text) {
  const list = notesRecord();
  const note = list.items.find(n => n.id === id);
  if (!note) return;
  if (text.trim()) note.text = text.trim();
  else list.items = list.items.filter(n => n.id !== id);   // emptied = deleted
  saveNotes(list);
}

function toggleReminder(id) {
  const list = notesRecord();
  const note = list.items.find(n => n.id === id);
  note.done = !note.done;
  note.doneAt = note.done ? Date.now() : null;

  if (note.done) {
    state.fadingNotes[id] = true;
    setTimeout(() => { delete state.fadingNotes[id]; if (state.view === "notes") render(); }, FADE_SECONDS * 1000);
    // More than KEEP_COMPLETED ticked? Delete the oldest ticked ones.
    const ticked = list.items.filter(n => n.done).sort((a, b) => b.doneAt - a.doneAt);
    const tooOld = new Set(ticked.slice(KEEP_COMPLETED).map(n => n.id));
    list.items = list.items.filter(n => !tooOld.has(n.id));
  }
  saveNotes(list);
}
