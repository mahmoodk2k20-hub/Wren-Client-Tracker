/* =====================================================================
   TRACKING PAGE  —  daily stats (leads, appointments, sales) and the
   weekly overview built from them.
   ===================================================================== */

// The stats record for one day (a blank one if nothing has been entered yet).
function dayRecord(date) {
  return records["d_" + date] || { id: "d_" + date, kind: "day", date, leads: 0, appointments: [] };
}

function dayTotals(date) {
  const day = dayRecord(date);
  const appts = day.appointments || [];
  const sold = appts.filter(a => a.sold);
  return {
    leads:        +day.leads || 0,
    appointments: appts.length,
    sales:        sold.length,
    value:        sold.reduce((sum, a) => sum + (+a.value || 0), 0),
  };
}

function weekTotals(monday) {
  const total = { leads: 0, appointments: 0, sales: 0, value: 0 };
  for (let i = 0; i < 7; i++) {
    const day = dayTotals(addDays(i, monday));
    for (const key in total) total[key] += day[key];
  }
  return total;
}


/* ---------- The page ---------- */

function renderTracking() {
  const date   = state.trackDate;
  const monday = mondayOf(date);
  const day    = dayRecord(date);
  const dayT   = dayTotals(date);
  const weekT  = weekTotals(monday);
  const conversion = weekT.appointments ? Math.round((weekT.sales / weekT.appointments) * 100) : 0;

  return `
    <div class="date-nav">
      <button class="btn-small" onclick="moveTrackDate(-1)">‹</button>
      <input type="date" value="${date}" onchange="state.trackDate = this.value || today(); render()">
      <button class="btn-small" onclick="moveTrackDate(1)">›</button>
      <button class="btn-small" onclick="state.trackDate = today(); render()">Today</button>
    </div>

    <h2>${formatDate(date)} — daily stats</h2>
    <div class="list panel">
      <label class="label" style="margin-top:0">Leads taken</label>
      <input type="number" min="0" value="${day.leads || ""}" onchange="setLeads(this.value)" style="max-width:140px">

      <label class="label" style="margin-top:14px">Appointments (${(day.appointments || []).length})</label>
      <datalist id="customer-names">
        ${allCustomers().map(c => `<option value="${escapeHtml(c.name)}">`).join("")}
      </datalist>
      ${(day.appointments || []).map(appointmentRow).join("")}
      <button class="btn-small" onclick="addAppointment()">+ Add appointment</button>

      <p style="margin:12px 0 0">
        <b>${dayT.sales}</b> sold of <b>${dayT.appointments}</b> · sales <b>${money(dayT.value)}</b>
      </p>
    </div>

    <h2>Week of ${formatDate(monday)}</h2>
    <div class="stats">
      ${statCard(weekT.leads, "Leads taken")}
      ${statCard(weekT.appointments, "Appointments")}
      ${statCard(weekT.sales, "Sales (" + conversion + "% conversion)")}
      ${statCard(money(weekT.value), "Sales value")}
    </div>
    ${weekTable(monday)}
  `;
}

function appointmentRow(appt, i) {
  return `
    <div class="appt-row">
      <input list="customer-names" placeholder="Customer" value="${escapeHtml(appt.name)}"
             onchange="setAppointment(${i}, 'name', this.value)">
      <label><input type="checkbox" ${appt.sold ? "checked" : ""}
             onchange="setAppointment(${i}, 'sold', this.checked)"> Sold</label>
      <input type="number" placeholder="£ value" value="${appt.value || ""}" ${appt.sold ? "" : "disabled"}
             onchange="setAppointment(${i}, 'value', +this.value)">
      <button class="btn-small" onclick="deleteAppointment(${i})">✕</button>
    </div>`;
}

function weekTable(monday) {
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(i, monday));
  const biggest = Math.max(1, ...days.map(d => dayTotals(d).value));
  const rows = days.map(d => {
    const t = dayTotals(d);
    return `
      <tr class="${d === state.trackDate ? "selected" : ""}" onclick="state.trackDate = '${d}'; render()">
        <td>${formatDate(d)}</td><td>${t.leads}</td><td>${t.appointments}</td><td>${t.sales}</td>
        <td><span class="bar" style="width:${(t.value / biggest) * 60}px"></span>${money(t.value)}</td>
      </tr>`;
  }).join("");
  return `
    <div class="list" style="overflow-x:auto">
      <table class="table">
        <tr><th>Day</th><th>Leads</th><th>Appts</th><th>Sold</th><th>Value</th></tr>
        ${rows}
      </table>
    </div>`;
}


/* ---------- Actions ---------- */

function moveTrackDate(days) {
  state.trackDate = addDays(days, state.trackDate);
  render();
}

function saveDay(day) {
  saveRecord(day);
  render();
}

function setLeads(value) {
  const day = dayRecord(state.trackDate);
  day.leads = +value || 0;
  saveDay(day);
}

function addAppointment() {
  const day = dayRecord(state.trackDate);
  day.appointments = day.appointments || [];
  day.appointments.push({ id: newId(), name: "", sold: false, value: 0 });
  saveDay(day);
  const nameBoxes = document.querySelectorAll(".appt-row input[list]");
  nameBoxes[nameBoxes.length - 1]?.focus();
}

function setAppointment(i, field, value) {
  const day = dayRecord(state.trackDate);
  day.appointments[i][field] = value;
  if (field === "sold" && !value) day.appointments[i].value = 0;
  saveDay(day);
}

function deleteAppointment(i) {
  const day = dayRecord(state.trackDate);
  day.appointments.splice(i, 1);
  saveDay(day);
}
