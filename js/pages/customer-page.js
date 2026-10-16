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

  // Redrawing builds a brand-new panel, which starts at the top. Remember how far
  // down you'd scrolled (if it's the same customer) so we can put you back there.
  const oldPanel = $("#modal .drawer");
  const scrollBack = oldPanel && oldPanel.dataset.id === c.id ? oldPanel.scrollTop : 0;

  $("#modal").innerHTML = `
    <div class="overlay" onclick="if (event.target === this) closeCustomer()">
      <div class="drawer" data-id="${escapeHtml(c.id)}">
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
        ${portfolioSection(c)}
        ${historySection(c)}
        <div style="margin-top:24px">
          <button class="btn-small btn-danger" onclick="deleteCustomer(this)">
            ${state.confirmDelete ? "Click again to confirm delete" : "Delete customer"}
          </button>
        </div>
      </div>
    </div>`;
  document.querySelectorAll("#modal textarea[data-note]").forEach(fitHeight);
  $("#modal .drawer").scrollTop = scrollBack;
  showPhotos();   // portfolio photos load a moment later (see portfolio.js)
}

function stageSection(c) {
  const buttons = STAGES.map((s, i) =>
    `<button class="${c.stage === s.name ? "on" : ""}" onclick="setStage(${i})">${escapeHtml(s.name)}</button>`
  ).join("");
  return `<label class="label">Stage</label><div class="stage-buttons">${buttons}</div>`;
}

function tasksSection(c) {
  const sorted = c.tasks.slice().sort((a, b) => (a.done - b.done) || bySoonest(a, b));
  const rows = sorted.map(t => `
    <div class="row compact ${t.done ? "done" : ""}">
      <input type="checkbox" ${t.done ? "checked" : ""} onchange="toggleTask('${t.id}')">
      <div class="row-main"><b>${escapeHtml(t.text)}</b>
        ${t.step ? `<span>when done: ticks ${escapeHtml(t.step)}</span>` : ""}</div>
      <span class="due ${!t.done && t.due < today() ? "late" : ""}">${whenText(t)}</span>
      <button class="btn-small" onclick="deleteTask('${t.id}')">✕</button>
    </div>`).join("");

  // Tapping a quick task fills the box, and picks its journey step if it has one (TASK_STEPS).
  const taskChips = QUICK_TASKS.map(text =>
    `<button onclick="$('#new-task').value = this.textContent; $('#new-task-step').value = TASK_STEPS[this.textContent] || ''; $('#new-task').focus()">${escapeHtml(text)}</button>`
  ).join("");
  const dateChips = QUICK_DATES.map(([label, days]) =>
    `<button onclick="$('#new-task-date').value = '${addDays(days)}'">${label}</button>`
  ).join("");
  const stepOptions = journeyFor(c).flatMap(p => p.steps)
    .map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");

  return `
    <h2>Follow-ups &amp; tasks</h2>
    ${rows || `<div class="empty">No tasks yet</div>`}
    <div class="chips">${taskChips}</div>
    <div class="add-task">
      <input id="new-task" placeholder="What needs doing?" onkeydown="if (event.key === 'Enter') addTask()">
      <input id="new-task-date" type="date" value="${today()}">
      <input id="new-task-time" type="time" aria-label="Time (optional)">
      <button class="btn-primary" onclick="addTask()">Add</button>
    </div>
    <div class="chips">${dateChips}</div>
    <label class="label">When done, tick journey step (optional)</label>
    <select id="new-task-step"><option value="">Nothing</option>${stepOptions}</select>`;
}

// "10:30 · Fri 16 Oct", or just the date when there's no time.
function whenText(task) {
  return (task.time ? task.time + " · " : "") + formatDate(task.due);
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
      <textarea rows="1" data-note="${key}" oninput="fitHeight(this); saveSoon(this, setNote)" onchange="saveNow()">${escapeHtml(c.notes[key])}</textarea>
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
  state.addedInARow = 0;
  const options = list => list.map(x => `<option>${escapeHtml(x)}</option>`).join("");
  $("#modal").innerHTML = `
    <div class="overlay center" onclick="if (event.target === this) $('#modal').innerHTML = ''">
      <div class="dialog">
        <h1>New customer<button class="btn-close" onclick="$('#modal').innerHTML = ''">×</button></h1>
        <label class="label">Name</label>
        <input id="new-name" onkeydown="if (event.key === 'Enter') createCustomer()">
        <div class="field-grid" style="margin:6px 0 0">
          <div><label class="label">Room</label><select id="new-room">${options(ROOMS)}</select></div>
          <div><label class="label">Service</label><select id="new-service">${options(SERVICES)}</select></div>
        </div>
        <label class="label">${escapeHtml(APPOINTMENT_TASK)} (optional)</label>
        <div class="field-grid two-up" style="margin-bottom:14px">
          <input id="new-appt-date" type="date" aria-label="Appointment date">
          <input id="new-appt-time" type="time" aria-label="Appointment time">
        </div>
        <label class="switch-row">
          <span>Add several<small>After each one, start the next instead of opening their profile</small></span>
          <input type="checkbox" class="switch" ${state.addSeveral ? "checked" : ""} onchange="state.addSeveral = this.checked">
        </label>
        <p class="added-note" id="added-note"></p>
        <button class="btn-primary" style="width:100%" onclick="createCustomer()">Create customer</button>
      </div>
    </div>`;
  setTimeout(() => $("#new-name")?.focus(), 50);
}

function createCustomer() {
  const name = $("#new-name").value.trim();
  if (!name) { $("#new-name").focus(); return; }

  // A booked design appointment becomes the first task (it shows on Today on its date).
  // No appointment: the usual "Make first contact" task for today.
  const apptDate = $("#new-appt-date").value;
  const firstTask = apptDate
    ? { id: newId(), kind: "appointment", text: APPOINTMENT_TASK, due: apptDate, time: $("#new-appt-time").value, done: false }
    : { id: newId(), text: FIRST_TASK, due: today(), done: false };

  const c = normalise({
    id:      newId(),
    name,
    room:    $("#new-room").value,
    service: $("#new-service").value,
    stage:   STAGES[0].name,
    created: today(),
    tasks:   [firstTask],
  });
  saveRecord(c);
  addLead();   // counts as a lead on today's Tracking page

  // "Add several" is on: clear the form for the next customer and stay in the pop-up.
  // (Room and Service stay as you left them, handy when adding similar customers.)
  if (state.addSeveral) {
    state.addedInARow = (state.addedInARow || 0) + 1;
    ["#new-name", "#new-appt-date", "#new-appt-time"].forEach(box => $(box).value = "");
    $("#added-note").textContent = `✓ Added ${name} · ${state.addedInARow} added so far`;
    $("#new-name").focus();
    render();   // the page behind shows them straight away
    return;
  }

  state.view = "customers";
  state.filter = "All";
  state.search = "";
  render();
  openCustomer(c.id);
}


/* ---------- Tasks ---------- */

// Tick a task from the Today page.
// It stays on the page, crossed out with an Undo button, for UNDO_SECONDS.
const UNDO_SECONDS = 5;

function tickTask(customerId, taskId) {
  const c = records[customerId];
  const task = c.tasks.find(t => t.id === taskId);
  if (task.kind === "appointment") { appointmentOutcome(customerId, taskId); return; }

  const before = deepCopy(c);   // a copy to go back to if you press Undo
  completeTask(c, task);
  saveCustomer(c, false);
  state.recentlyDone[taskId] = { customerId, before };
  setTimeout(() => {
    delete state.recentlyDone[taskId];
    const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
    if (state.view === "today" && !typing) render();
  }, UNDO_SECONDS * 1000);
  render();
}

// Puts the customer back exactly as they were before the tick
// (task unticked, and any journey step or stage it moved undone too).
function undoTask(taskId) {
  const undo = state.recentlyDone[taskId];
  if (!undo) return;
  delete state.recentlyDone[taskId];
  saveRecord(undo.before);
  render();
}

// Marks a task done and ticks its journey step, if it has one.
function completeTask(c, task) {
  task.done = true;
  task.doneOn = today();
  if (task.step) tickStep(c, task.step);
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
  const task = { id: newId(), text, due: $("#new-task-date").value || today(), done: false };
  if ($("#new-task-time").value) task.time = $("#new-task-time").value;
  if ($("#new-task-step").value) task.step = $("#new-task-step").value;
  if (text === APPOINTMENT_TASK) task.kind = "appointment";   // asks how it went when ticked
  c.tasks.push(task);
  saveCustomer(c);
  $("#new-task").focus();
}

// Tick or untick a task in the customer panel.
function toggleTask(taskId) {
  const c = currentCustomer();
  const task = c.tasks.find(t => t.id === taskId);
  if (!task.done && task.kind === "appointment") { appointmentOutcome(c.id, taskId); return; }
  if (task.done) {
    task.done = false;   // unticking only reopens the task
    task.doneOn = "";
  } else {
    completeTask(c, task);
  }
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
    delete c.journey[step];   // unticking only clears the step you tapped
  } else {
    tickStep(c, step);
  }
  saveCustomer(c);
}

// Ticks a journey step AND every unticked step above it, moves the stage on,
// and adds any automatic tasks for those steps (AUTO_TASKS in config.js).
// Used by the journey checkboxes, tasks with a step, and appointment results.
function tickStep(c, step, { autoTasks = true } = {}) {
  const allSteps = journeyFor(c).flatMap(p => p.steps);
  if (c.journey[step] || !allSteps.includes(step)) return;   // already ticked, or hidden for this customer
  const upToThisOne = allSteps.slice(0, allSteps.indexOf(step) + 1);
  const newlyTicked = upToThisOne.filter(s => !c.journey[s]);
  newlyTicked.forEach(s => c.journey[s] = today());

  const earlier = newlyTicked.length - 1;
  addHistory(c, "✓ " + step + (earlier > 0 ? ` (+ ${earlier} earlier step${earlier > 1 ? "s" : ""})` : ""));
  moveStageForSteps(c, newlyTicked);
  if (autoTasks) newlyTicked.forEach(s => addAutoTask(c, s));
}

// e.g. ticking "Quoted" adds "Chase decision" in 3 days, unless that task is already open.
function addAutoTask(c, step) {
  if (!AUTO_TASKS[step]) return;
  const [text, days] = AUTO_TASKS[step];
  if (openTasks(c).some(t => t.text === text)) return;
  c.tasks.push({ id: newId(), text, due: addDays(days), done: false });
}

// Moves the stage forward to the furthest stage these steps lead to
// (see STEP_MOVES_STAGE in config.js). Never moves backwards.
function moveStageForSteps(c, steps) {
  const names = STAGES.map(s => s.name);
  const furthest = steps
    .map(s => STEP_MOVES_STAGE[s])
    .filter(Boolean)
    .sort((a, b) => names.indexOf(b) - names.indexOf(a))[0];
  if (furthest && !isClosed(c) && names.indexOf(furthest) > names.indexOf(c.stage)) {
    changeStage(c, furthest);
  }
}

function setStage(index) {
  const c = currentCustomer();
  changeStage(c, STAGES[index].name);
  saveCustomer(c);
}

// Every stage change goes through here. When a customer becomes sold and the
// sale isn't on the Tracking page yet, it asks whether to add it.
function changeStage(c, name) {
  if (c.stage === name) return;
  const wasSold = isSold(c);
  c.stage = name;
  addHistory(c, "Moved to " + name);
  if (!wasSold && isSold(c) && !hasRecordedSale(c.id)) {
    setTimeout(() => saleDialog(c.id), 0);   // after the change has been saved
  }
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
