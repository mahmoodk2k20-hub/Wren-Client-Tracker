/* =====================================================================
   TODAY PAGE  —  overdue, today, this week, next week, later,
   and customers with no follow-up booked.
   ===================================================================== */

function renderToday() {
  const now        = today();
  const thisMonday = mondayOf(now);
  const nextMonday = addDays(7, thisMonday);
  const weekAfter  = addDays(14, thisMonday);

  const tasks = allOpenTasks();
  const overdue    = tasks.filter(t => t.due < now);
  const dueToday   = tasks.filter(t => t.due === now);
  const restOfWeek = tasks.filter(t => t.due > now && t.due < nextMonday);
  const nextWeek   = tasks.filter(t => t.due >= nextMonday && t.due < weekAfter);
  const later      = tasks.filter(t => t.due >= weekAfter);

  const openCustomers = allCustomers().filter(c => !isClosed(c));
  const noFollowUp    = openCustomers.filter(c => openTasks(c).length === 0);
  const quotesOut     = openCustomers
    .filter(c => QUOTE_STAGES.includes(c.stage))
    .reduce((sum, c) => sum + (+c.value || 0), 0);

  return `
    <div class="stats">
      ${statCard(overdue.length, "Overdue", overdue.length > 0)}
      ${statCard(dueToday.length, "Due today")}
      ${statCard(money(quotesOut), "Quotes out (" + QUOTE_STAGES.join(" / ") + ")")}
      ${statCard(money(weekTotals(thisMonday).value), "Sales this week")}
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

function statCard(value, label, isBad = false) {
  return `<div class="stat ${isBad ? "bad" : ""}"><b>${value}</b><span>${label}</span></div>`;
}

function taskSection(title, tasks, { warn = false, hideIfEmpty = false, emptyText = "" } = {}) {
  if (tasks.length === 0 && hideIfEmpty) return "";
  const rows = tasks.length ? tasks.map(taskRow).join("") : `<div class="empty">${emptyText}</div>`;
  return `
    <div class="${warn ? "overdue" : ""}">
      <h2>${title}<i>${tasks.length}</i></h2>
      <div class="list">${rows}</div>
    </div>`;
}

function taskRow(task) {
  const c = task.customer;
  const late = task.due < today();
  return `
    <div class="row">
      <input type="checkbox" title="Mark done" onchange="tickTask('${c.id}','${task.id}')">
      <div class="row-main" onclick="openCustomer('${c.id}')">
        <b>${escapeHtml(task.text)}</b>
        <span>${escapeHtml(c.name)} · ${stagePill(c.stage)}</span>
      </div>
      <span class="due ${late ? "late" : ""}">${formatDate(task.due)}</span>
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
  return `<h2>Needs a follow-up<i>${list.length}</i></h2><div class="list">${rows}</div>`;
}
