/* =====================================================================
   TODAY PAGE  —  overdue, today, this week, next week, later,
   and customers with no follow-up booked.
   ===================================================================== */

function renderToday() {
  const now        = today();
  const thisMonday = mondayOf(now);
  const nextMonday = addDays(7, thisMonday);
  const weekAfter  = addDays(14, thisMonday);

  // Tasks ticked in the last few seconds stay on the page, crossed out, so you can Undo.
  const justDone = Object.entries(state.recentlyDone).flatMap(([taskId, { customerId }]) => {
    const c = records[customerId];
    const t = c && c.tasks.find(t => t.id === taskId);
    return t && t.done ? [{ ...t, customer: c }] : [];
  });
  const tasks = allOpenTasks().concat(justDone).sort(bySoonest);
  const overdue    = tasks.filter(t => t.due < now);
  const dueToday   = tasks.filter(t => t.due === now);
  const restOfWeek = tasks.filter(t => t.due > now && t.due < nextMonday);
  const nextWeek   = tasks.filter(t => t.due >= nextMonday && t.due < weekAfter);
  const later      = tasks.filter(t => t.due >= weekAfter);

  const openCustomers = allCustomers().filter(c => !isClosed(c));
  const noFollowUp    = openCustomers.filter(c => openTasks(c).length === 0);

  // Leads and Sales come from the Tracking page. Tapping a card switches it
  // between today and this week (see switchPeriod below).
  const leads = state.leadsPeriod === "day" ? dayTotals(now).leads : weekTotals(thisMonday).leads;
  const sales = state.salesPeriod === "day" ? dayTotals(now).value : weekTotals(thisMonday).value;

  return `
    <div class="stats">
      ${statCard(stillOpen(overdue), "Overdue", stillOpen(overdue) > 0)}
      ${statCard(stillOpen(dueToday), "Due today")}
      ${periodCard(leads, "Leads", "leadsPeriod")}
      ${periodCard(money(sales), "Sales", "salesPeriod")}
    </div>
    ${taskSection("Overdue", overdue, { warn: true, hideIfEmpty: true })}
    ${taskSection("Today", dueToday, { emptyText: "Nothing due today 🎉" })}
    ${taskSection("Rest of this week", restOfWeek, { hideIfEmpty: true })}
    ${taskSection("Next week", nextWeek, { hideIfEmpty: true })}
    ${taskSection("Later", later, { hideIfEmpty: true })}
    ${noFollowUpSection(noFollowUp)}
  `;
}


/* ---------- Pieces of the page ---------- */

// How many of these tasks aren't done (ticked ones waiting for Undo don't count).
function stillOpen(tasks) {
  return tasks.filter(t => !t.done).length;
}

function statCard(value, label, isBad = false) {
  return `<div class="stat ${isBad ? "bad" : ""}"><b>${value}</b><span>${label}</span></div>`;
}

// A stat card you can tap to switch between "today" and "this week".
// `setting` is the name of the state value that remembers which one is showing.
function periodCard(value, label, setting) {
  const period = state[setting] === "day" ? "today" : "this week";
  return `
    <button class="stat tappable" onclick="switchPeriod('${setting}')">
      <b>${value}</b><span>${label} ${period}</span><small>⇄ tap for ${period === "today" ? "week" : "today"}</small>
    </button>`;
}

function switchPeriod(setting) {
  state[setting] = state[setting] === "day" ? "week" : "day";
  render();
}

function taskSection(title, tasks, { warn = false, hideIfEmpty = false, emptyText = "" } = {}) {
  if (tasks.length === 0 && hideIfEmpty) return "";
  const rows = tasks.length ? tasks.map(taskRow).join("") : `<div class="empty">${emptyText}</div>`;
  return `
    <div class="${warn ? "overdue" : ""}">
      <h2>${title}<i>${stillOpen(tasks)}</i></h2>
      <div class="list">${rows}</div>
    </div>`;
}

function taskRow(task) {
  const c = task.customer;
  const late = task.due < today();
  if (task.done) {   // just ticked: crossed out with an Undo button for a few seconds
    return `
    <div class="row done">
      <input type="checkbox" checked disabled>
      <div class="row-main"><b>${escapeHtml(task.text)}</b><span>${escapeHtml(c.name)}</span></div>
      <button class="btn-small" onclick="undoTask('${task.id}')">Undo</button>
    </div>`;
  }
  return `
    <div class="row">
      <input type="checkbox" title="Mark done" onchange="tickTask('${c.id}','${task.id}')">
      <div class="row-main" onclick="openCustomer('${c.id}')">
        <b>${escapeHtml(task.text)}</b>
        <span>${escapeHtml(c.name)} · ${stagePill(c.stage)}</span>
      </div>
      <span class="due ${late ? "late" : ""}">${whenText(task)}</span>
      <button class="btn-small" title="Push to tomorrow" onclick="snoozeTask('${c.id}','${task.id}')">+1 day</button>
    </div>`;
}

function noFollowUpSection(list) {
  if (list.length === 0) return "";
  const rows = list.map(c => `
    <div class="row">
      <div class="row-main" onclick="openCustomer('${c.id}')">
        <b>${escapeHtml(c.name)}</b>
        <span>${stagePill(c.stage)} · no follow-up scheduled</span>
      </div>
      <button class="btn-small" onclick="openCustomer('${c.id}')">Add task</button>
    </div>`).join("");
  // An alert: every open customer should have a next step booked.
  return `<div class="overdue"><h2>⚠ No follow-up booked<i>${list.length}</i></h2><div class="list">${rows}</div></div>`;
}
