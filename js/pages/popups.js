/* =====================================================================
   POP-UPS  —  small questions that appear on top of everything else:
   "How did the design appointment go?" and "Add this sale to Tracking?".
   They're drawn into <div id="popup"> (index.html), which sits above
   the customer panel, so they can appear while the panel is open.
   ===================================================================== */

function openPopup(html) {
  $("#popup").innerHTML = `
    <div class="overlay center popup" onclick="if (event.target === this) closePopup()">
      <div class="dialog">${html}</div>
    </div>`;
}

function closePopup() {
  $("#popup").innerHTML = "";
  render();                                        // e.g. untick a box if you cancelled
  if (state.openId) drawCustomerPage();
}


/* ---------- Design appointment result ----------
   Shown when you tick a design appointment task.
   Step 1: Sold or Not sold. Step 2: the amount (and a follow-up if not sold). */

function appointmentOutcome(customerId, taskId, result = "") {
  const c = records[customerId];
  const close = `<button class="btn-close" onclick="closePopup()">×</button>`;

  if (!result) {
    openPopup(`
      <h1>How did it go?${close}</h1>
      <p class="muted">${escapeHtml(c.name)} · ${escapeHtml(APPOINTMENT_TASK)}</p>
      <div class="two-buttons">
        <button class="btn-primary" onclick="appointmentOutcome('${customerId}','${taskId}','sold')">Sold</button>
        <button class="btn-secondary" onclick="appointmentOutcome('${customerId}','${taskId}','not-sold')">Not sold</button>
      </div>`);
    return;
  }

  if (result === "sold") {
    openPopup(`
      <h1>Sold${close}</h1>
      <label class="label">How much did ${escapeHtml(c.name)} buy for? (£)</label>
      <input id="outcome-value" type="number" inputmode="decimal" value="${c.value || ""}">
      <button class="btn-primary wide-button" onclick="saveOutcome('${customerId}','${taskId}', true)">Save sale</button>`);
  } else {
    const dateChips = QUICK_DATES.filter(([, days]) => days > 0).map(([label, days]) =>
      `<button onclick="$('#outcome-date').value = '${addDays(days)}'">${label}</button>`).join("");
    openPopup(`
      <h1>Not sold${close}</h1>
      <label class="label">How much was the quote? (£)</label>
      <input id="outcome-value" type="number" inputmode="decimal" value="${c.value || ""}">
      <label class="label">Follow-up</label>
      <input id="outcome-task" value="${escapeHtml(DEFAULT_FOLLOW_UP)}">
      <input id="outcome-date" type="date" value="${addDays(3)}" style="margin-top:8px">
      <div class="chips">${dateChips}</div>
      <button class="btn-primary wide-button" onclick="saveOutcome('${customerId}','${taskId}', false, true)">Save with follow-up</button>
      <button class="btn-secondary wide-button" onclick="saveOutcome('${customerId}','${taskId}', false, false)">No follow-up</button>
      <p class="muted small">No follow-up puts ${escapeHtml(c.name)} on the Today page's "No follow-up booked" alert.</p>`);
  }
  setTimeout(() => $("#outcome-value")?.focus(), 50);
}

function saveOutcome(customerId, taskId, sold, withFollowUp = false) {
  const c = records[customerId];
  const task = c.tasks.find(t => t.id === taskId);
  const amount = +$("#outcome-value").value || 0;

  task.done = true;
  task.doneOn = today();
  c.value = amount;
  tickStep(c, APPOINTMENT_TICKS_STEP, { autoTasks: false });   // you choose the follow-up here instead
  // Recorded on Tracking for the appointment's date (before changing stage, so it isn't asked twice).
  recordAppointment(c, task.due, sold, amount);

  if (sold) {
    addHistory(c, `${APPOINTMENT_TASK}: sold for ${money(amount)}`);
    changeStage(c, SOLD_STAGE);
  } else {
    addHistory(c, `${APPOINTMENT_TASK}: not sold, quoted ${money(amount)}`);
    const text = $("#outcome-task")?.value.trim();
    if (withFollowUp && text) c.tasks.push({ id: newId(), text, due: $("#outcome-date").value || addDays(3), done: false });
  }
  saveRecord(c);
  closePopup();
}


/* ---------- A sale made later (not at the appointment) ----------
   Shown when a customer moves to a sold stage and the sale isn't on the
   Tracking page yet. It adds the sale to today's Tracking. */

function saleDialog(customerId) {
  const c = records[customerId];
  if (!c) return;
  openPopup(`
    <h1>Add sale to Tracking?<button class="btn-close" onclick="closePopup()">×</button></h1>
    <label class="label">${escapeHtml(c.name)} sold for (£)</label>
    <input id="sale-value" type="number" inputmode="decimal" value="${c.value || ""}">
    <button class="btn-primary wide-button" onclick="saveSale('${customerId}')">Add to today's sales</button>
    <button class="btn-secondary wide-button" onclick="closePopup()">Not now</button>`);
  setTimeout(() => $("#sale-value")?.focus(), 50);
}

function saveSale(customerId) {
  const c = records[customerId];
  const amount = +$("#sale-value").value || 0;
  c.value = amount;
  saveRecord(c);
  recordSale(c, amount);
  closePopup();
}
