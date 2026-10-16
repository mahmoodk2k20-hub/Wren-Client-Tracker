/* =====================================================================
   CUSTOMER PAGE  —  the side panel that opens when you click a
   customer, the "New customer" pop-up, and every action that changes
   a customer (tasks, journey, stage, notes, delete).
   ===================================================================== */


/* ---------- Open / close ---------- */

function openCustomer(id) {
  saveNow();   // finish saving anything typed into the previous customer first
  state.openId = id;
  state.confirmDelete = false;
  drawCustomerPage();
}

function closeCustomer() {
  saveNow();
  state.openId = null;
  $("#modal").innerHTML = "";
  render();
}

function currentCustomer() {
  return records[state.openId];
}

// Save a customer, refresh the page behind, and (optionally) redraw the panel.
function saveCustomer(c, redrawPanel = true) {
  saveRecord(c);
  render();
  if (redrawPanel && state.openId === c.id) drawCustomerPage();
}

function addHistory(c, text) {
  c.log.unshift({ date: today(), text });
}


/* ---------- Draw the panel ----------
   The panel is built from sections, top to bottom. Reorder the lines
   in the template below to change the order on screen. */

function drawCustomerPage() {
  saveNow();   // so the redrawn boxes show what you just typed
  const c = currentCustomer();
  if (!c) { state.openId = null; $("#modal").innerHTML = ""; return; }   // e.g. deleted on another device

  $("#modal").innerHTML = `
    <div class="overlay" onclick="if (event.target === this) closeCustomer()">
      <div class="drawer">
        <h1>
          <span><span id="drawer-name">${escapeHtml(c.name)}</span><br>
            <small>${escapeHtml(c.room)} · ${escapeHtml(c.service)}</small></span>
          <button class="btn-close" onclick="closeCustomer()">×</button>
        </h1>
        ${stageSection(c)}
        ${tasksSection(c)}
        ${journeySection(c)}
        ${notesSection(c)}
        ${detailsSection(c)}
        ${historySection(c)}
        <div style="margin-top:24px">
          <button class="btn-small btn-danger" onclick="deleteCustomer(this)">
            ${state.confirmDelete ? "Click again to confirm delete" : "Delete customer"}
          </button>
        </div>
      </div>
    </div>`;
}

function stageSection(c) {
  const buttons = STAGES.map((s, i) =>
    `<button class="${c.stage === s.name ? "on" : ""}" onclick="setStage(${i})">${escapeHtml(s.name)}</button>`
  ).join("");
  return `<label class="label">Stage</label><div class="stage-buttons">${buttons}</div>`;
}

function tasksSection(c) {
  const sorted = c.tasks.slice().sort((a, b) => (a.done - b.done) || (a.due < b.due ? -1 : 1));
  const rows = sorted.map(t => `
    <div class="row compact ${t.done ? "done" : ""}">
      <input type="checkbox" ${t.done ? "checked" : ""} onchange="toggleTask('${t.id}')">
      <div class="row-main"><b>${escapeHtml(t.text)}</b></div>
      <span class="due ${!t.done && t.due < today() ? "late" : ""}">${formatDate(t.due)}</span>
      <button class="btn-small" onclick="deleteTask('${t.id}')">✕</button>
    </div>`).join("");

  const taskChips = QUICK_TASKS.map(text =>
    `<button onclick="$('#new-task').value = this.textContent; $('#new-task').focus()">${escapeHtml(text)}</button>`
  ).join("");
  const dateChips = QUICK_DATES.map(([label, days]) =>
    `<button onclick="$('#new-task-date').value = '${addDays(days)}'">${label}</button>`
  ).join("");

  return `
    <h2>Follow-ups &amp; tasks</h2>
    ${rows || `<div class="empty">No tasks yet</div>`}
    <div class="chips">${taskChips}</div>
    <div class="add-task">
      <input id="new-task" placeholder="What needs doing?" onkeydown="if (event.key === 'Enter') addTask()">
      <input id="new-task-date" type="date" value="${today()}">
      <button class="btn-primary" onclick="addTask()">Add</button>
    </div>
    <div class="chips">${dateChips}</div>`;
}

function journeySection(c) {
  const p = journeyProgress(c);
  const percent = p.total ? (p.done / p.total) * 100 : 0;
  const phases = journeyFor(c).map(({ phase, steps }) => {
    const stepRows = steps.map(step => {
      const doneOn = c.journey[step];
      const isNext = step === p.next;
      return `
        <label class="step ${doneOn ? "ticked" : ""} ${isNext ? "next" : ""}">
          <input type="checkbox" ${doneOn ? "checked" : ""} data-step="${escapeHtml(step)}"
                 onchange="toggleJourneyStep(this.dataset.step)">
          <span>${escapeHtml(step)}</span>
          <small>${doneOn ? formatDate(doneOn) : isNext ? "Next" : ""}</small>
        </label>`;
    }).join("");
    return `<div class="phase">${escapeHtml(phase)}</div>${stepRows}`;
  }).join("");

  return `
    <h2>Customer journey<i>${p.done}/${p.total}</i></h2>
    <div class="progress"><i style="width:${percent}%"></i></div>
    ${phases}`;
}

function notesSection(c) {
  const boxes = list => list.map(([key, heading]) => `
    <div class="wide">
      <label class="label">${escapeHtml(heading)}</label>
      <textarea rows="1" data-note="${key}" oninput="saveSoon(this, setNote)" onchange="saveNow()">${escapeHtml(c.notes[key])}</textarea>
    </div>`).join("");
  return `
    <h2>Account notes</h2>
    <div class="field-grid">${boxes(ACCOUNT_NOTES)}</div>
    <div class="phase" style="margin-top:14px">Current kitchen</div>
    <div class="field-grid">${boxes(CURRENT_KITCHEN_NOTES)}</div>`;
}

function detailsSection(c) {
  const fields = DETAIL_FIELDS.map(([key, label, type]) => {
    const input = Array.isArray(type)
      ? `<select data-field="${key}" onchange="setField(this)">
           ${type.map(opt => `<option ${c[key] === opt ? "selected" : ""}>${escapeHtml(opt)}</option>`).join("")}
         </select>`
      : `<input type="${type}" data-field="${key}" value="${escapeHtml(c[key])}" oninput="saveSoon(this, setField)" onchange="saveNow()">`;
    return `<div><label class="label">${label}</label>${input}</div>`;
  }).join("");
  return `<h2>Details</h2><div class="field-grid">${fields}</div>`;
}

function historySection(c) {
  const entries = c.log.map(e => `<div class="log"><span>${formatDate(e.date)}</span>${escapeHtml(e.text)}</div>`).join("");
  return `
    <h2>History</h2>
    <textarea id="new-note" rows="2" placeholder="Log a call, meeting or decision…"></textarea>
    <div style="margin:8px 0"><button class="btn-small" onclick="addHistoryNote()">Add note</button></div>
    ${entries}`;
}


/* ---------- New customer pop-up ---------- */

function newCustomerDialog() {
  const options = list => list.map(x => `<option>${escapeHtml(x)}</option>`).join("");
  $("#modal").innerHTML = `
    <div class="overlay center" onclick="if (event.target === this) $('#modal').innerHTML = ''">
      <div class="dialog">
        <h1>New customer<button class="btn-close" onclick="$('#modal').innerHTML = ''">×</button></h1>
        <label class="label">Name</label>
        <input id="new-name" onkeydown="if (event.key === 'Enter') createCustomer()">
        <label class="label">Phone</label>
        <input id="new-phone" onkeydown="if (event.key === 'Enter') createCustomer()">
        <div class="field-grid" style="margin:6px 0 14px">
          <div><label class="label">Room</label><select id="new-room">${options(ROOMS)}</select></div>
          <div><label class="label">Service</label><select id="new-service">${options(SERVICES)}</select></div>
        </div>
        <button class="btn-primary" style="width:100%" onclick="createCustomer()">Create customer</button>
      </div>
    </div>`;
  setTimeout(() => $("#new-name").focus(), 50);
}

function createCustomer() {
  const name = $("#new-name").value.trim();
  if (!name) { $("#new-name").focus(); return; }

  const c = normalise({
    id:      newId(),
    name,
    phone:   $("#new-phone").value.trim(),
    room:    $("#new-room").value,
    service: $("#new-service").value,
    stage:   STAGES[0].name,
    created: today(),
    tasks:   [{ id: newId(), text: FIRST_TASK, due: today(), done: false }],
  });
  saveRecord(c);

  state.view = "customers";
  state.filter = "All";
  state.search = "";
  render();
  openCustomer(c.id);
}


/* ---------- Tasks ---------- */

// Tick a task from the Today page.
function tickTask(customerId, taskId) {
  const c = records[customerId];
  const task = c.tasks.find(t => t.id === taskId);
  task.done = true;
  task.doneOn = today();
  saveCustomer(c);
}

// Push a task to tomorrow (or one day later if it's already in the future).
function snoozeTask(customerId, taskId) {
  const c = records[customerId];
  const task = c.tasks.find(t => t.id === taskId);
  task.due = addDays(1, task.due < today() ? today() : task.due);
  saveCustomer(c);
}

function addTask() {
  const c = currentCustomer();
  const text = $("#new-task").value.trim();
  if (!text) return;
  c.tasks.push({ id: newId(), text, due: $("#new-task-date").value || today(), done: false });
  saveCustomer(c);
  $("#new-task").focus();
}

function toggleTask(taskId) {
  const c = currentCustomer();
  const task = c.tasks.find(t => t.id === taskId);
  task.done = !task.done;
  task.doneOn = task.done ? today() : "";
  saveCustomer(c);
}

function deleteTask(taskId) {
  const c = currentCustomer();
  c.tasks = c.tasks.filter(t => t.id !== taskId);
  saveCustomer(c);
}


/* ---------- Journey & stage ---------- */

function toggleJourneyStep(step) {
  const c = currentCustomer();
  if (c.journey[step]) {
    delete c.journey[step];
  } else {
    c.journey[step] = today();
    addHistory(c, "✓ " + step);
    moveStageForStep(c, step);
  }
  saveCustomer(c);
}

// Moves the stage forward if this step is listed in STEP_MOVES_STAGE (never backwards).
function moveStageForStep(c, step) {
  const target = STEP_MOVES_STAGE[step];
  const names = STAGES.map(s => s.name);
  if (target && !isClosed(c) && names.indexOf(target) > names.indexOf(c.stage)) {
    c.stage = target;
    addHistory(c, "Moved to " + target);
  }
}

function setStage(index) {
  const c = currentCustomer();
  const name = STAGES[index].name;
  if (c.stage === name) return;
  c.stage = name;
  addHistory(c, "Moved to " + name);
  saveCustomer(c);
}


/* ---------- Details & notes ---------- */

/* Saving while you type.
   Text boxes save a moment after you stop typing, and straight away if you
   leave the box, close the panel, or switch away from the app. Before this,
   a note only saved when you tapped out of the box, so switching apps on the
   iPhone mid-note could lose it. */
let pendingSave = null;   // { input, run, timer } — the box waiting to be saved

function saveSoon(input, saveFunction) {
  if (pendingSave && pendingSave.input !== input) saveNow();   // moved to another box: save the last one first
  clearTimeout(pendingSave?.timer);
  pendingSave = { input, run: () => saveFunction(input), timer: setTimeout(saveNow, 800) };
}

function saveNow() {
  if (!pendingSave) return;
  const { run, timer } = pendingSave;
  clearTimeout(timer);
  pendingSave = null;
  run();
}

// Leaving the app (switching apps, locking the phone, closing the tab) saves straight away.
document.addEventListener("visibilitychange", () => { if (document.hidden) saveNow(); });
window.addEventListener("pagehide", saveNow);

function setField(input) {
  const c = currentCustomer();
  const key = input.dataset.field;
  c[key] = input.type === "number" ? (+input.value || 0) : input.value;
  // Dropdowns change what's shown (e.g. Supply only hides steps), so redraw for those only.
  // Text boxes don't redraw, so clicking straight into the next box still works.
  saveCustomer(c, input.tagName === "SELECT");
  if (key === "name") $("#drawer-name").textContent = c.name;
}

function setNote(textarea) {
  const c = currentCustomer();
  c.notes[textarea.dataset.note] = textarea.value;
  saveCustomer(c, false);
}

function addHistoryNote() {
  const text = $("#new-note").value.trim();
  if (!text) return;
  const c = currentCustomer();
  addHistory(c, text);
  saveCustomer(c);
}


/* ---------- Delete ---------- */

function deleteCustomer(button) {
  if (!state.confirmDelete) {
    state.confirmDelete = true;
    button.textContent = "Click again to confirm delete";
    return;
  }
  deleteRecord(state.openId);
  closeCustomer();
}
