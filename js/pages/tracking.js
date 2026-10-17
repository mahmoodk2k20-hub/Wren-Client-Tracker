/* =====================================================================
   TRACKING PAGE  —  daily stats (leads, appointments, sales), the
   weekly overview, and weekly / monthly reviews.
   Most of it fills itself in: new customers add a lead, design
   appointment results add an appointment, and later sales add a sale.
   ===================================================================== */

// The stats record for one day (a blank one if nothing has been entered yet).
function dayRecord(date) {
  const id = idPrefix() + "d_" + date;   // "dev:d_…" in Developer mode
  return records[id] || { id, kind: "day", date, leads: 0, appointments: [], sales: [] };
}

// Totals for one day. Sales = appointments marked sold + sales made later after a follow-up.
function dayTotals(date) {
  const day = dayRecord(date);
  const appts = day.appointments || [];
  const sold = appts.filter(a => a.sold);
  const later = day.sales || [];
  return {
    leads:        +day.leads || 0,
    appointments: appts.length,
    sales:        sold.length + later.length,
    value:        sold.reduce((sum, a) => sum + (+a.value || 0), 0) + later.reduce((sum, s) => sum + (+s.value || 0), 0),
  };
}

// Totals for every day from `start` to `end` (both included).
function rangeTotals(start, end) {
  const total = { leads: 0, appointments: 0, sales: 0, value: 0 };
  for (let date = start; date <= end; date = addDays(1, date)) {
    const day = dayTotals(date);
    for (const key in total) total[key] += day[key];
  }
  return total;
}

function weekTotals(monday) {
  return rangeTotals(monday, addDays(6, monday));
}


/* ---------- Filled in automatically ---------- */

// A new customer = one more lead today.
function addLead(date = today()) {
  const day = dayRecord(date);
  day.leads = (+day.leads || 0) + 1;
  saveRecord(day);
}

// A design appointment result, on the appointment's date.
function recordAppointment(c, date, sold, value) {
  if (c.past) return;   // past clients never count towards Tracking
  const day = dayRecord(date);
  day.appointments = day.appointments || [];
  day.appointments.push({ id: newId(), customerId: c.id, name: c.name, sold, value: sold ? value : 0 });
  saveRecord(day);
}

// A sale made later (after a follow-up), on today's date.
function recordSale(c, value, date = today()) {
  if (c.past) return;   // past clients never count towards Tracking
  const day = dayRecord(date);
  day.sales = day.sales || [];
  day.sales.push({ id: newId(), customerId: c.id, name: c.name, value });
  saveRecord(day);
}

// Is this customer's sale already on the Tracking page? (So it's never counted twice.)
function hasRecordedSale(customerId) {
  return Object.values(records).some(r => r.kind === "day" && (
    (r.appointments || []).some(a => a.customerId === customerId && a.sold) ||
    (r.sales || []).some(s => s.customerId === customerId)));
}


/* ---------- The page ---------- */

function renderTracking() {
  const modes = [["daily", "Daily"], ["week", "Week review"], ["month", "Month review"]].map(([mode, label]) =>
    `<button class="${state.trackMode === mode ? "on" : ""}" onclick="state.trackMode = '${mode}'; render()">${label}</button>`
  ).join("");
  const body = state.trackMode === "daily" ? renderDaily() : renderReview(state.trackMode);
  return `<div class="chips filters">${modes}</div>${body}${commissionCard()}`;
}

function renderDaily() {
  const date   = state.trackDate;
  const monday = mondayOf(date);
  const day    = dayRecord(date);
  const dayT   = dayTotals(date);
  const weekT  = weekTotals(monday);
  const conversion = weekT.appointments ? Math.round((weekT.sales / weekT.appointments) * 100) : 0;
  const laterSales = day.sales || [];

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
      <div class="counter">
        <button onclick="changeLeads(-1)" aria-label="One less lead">−</button>
        <b>${+day.leads || 0}</b>
        <button onclick="changeLeads(1)" aria-label="One more lead">+</button>
      </div>

      <label class="label" style="margin-top:14px">Appointments (${(day.appointments || []).length})</label>
      <datalist id="customer-names">
        ${allCustomers().map(c => `<option value="${escapeHtml(c.name)}">`).join("")}
      </datalist>
      ${(day.appointments || []).map(appointmentRow).join("")}
      <button class="btn-small" onclick="addAppointment()">+ Add appointment</button>

      ${laterSales.length ? `
        <label class="label" style="margin-top:14px">Sales after a follow-up (${laterSales.length})</label>
        ${laterSales.map(laterSaleRow).join("")}` : ""}

      <p style="margin:12px 0 0">
        <b>${dayT.sales}</b> sold of <b>${dayT.appointments}</b> appointments · sales <b>${money(dayT.value)}</b>
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

function laterSaleRow(sale, i) {
  return `
    <div class="appt-row">
      <input value="${escapeHtml(sale.name)}" disabled>
      <span></span>
      <input type="number" placeholder="£ value" value="${sale.value || ""}" onchange="setLaterSale(${i}, +this.value)">
      <button class="btn-small" onclick="deleteLaterSale(${i})">✕</button>
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


/* ---------- Weekly and monthly reviews ---------- */

// The first and last date of the week (Mon–Sun) or month that `anyDate` falls in.
function periodOf(kind, anyDate) {
  if (kind === "week") {
    const start = mondayOf(anyDate);
    return { start, end: addDays(6, start), name: "Week of " + formatDate(start) };
  }
  const start = anyDate.slice(0, 8) + "01";                 // "2026-10-16" -> "2026-10-01"
  const lastDay = new Date(start + "T12:00");
  lastDay.setMonth(lastDay.getMonth() + 1);
  lastDay.setDate(0);                                        // day 0 of next month = last day of this one
  const name = lastDay.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return { start, end: toISO(lastDay), name };
}

// Everything the review shows, for one period.
function reviewNumbers(kind, anyDate) {
  const { start, end, name } = periodOf(kind, anyDate);
  const inPeriod = date => date && date >= start && date <= end;
  const t = rangeTotals(start, end);

  const sales = [];
  Object.values(records).filter(r => r.kind === "day" && inPeriod(r.date)).forEach(day => {
    (day.appointments || []).filter(a => a.sold).forEach(a => sales.push({ date: day.date, name: a.name, value: +a.value || 0 }));
    (day.sales || []).forEach(s => sales.push({ date: day.date, name: s.name, value: +s.value || 0 }));
  });
  sales.sort((a, b) => a.date < b.date ? -1 : 1);

  const customers = allCustomers().filter(c => !c.past);   // reviews are about current clients only
  const quoted = customers.filter(c => inPeriod(c.journey[APPOINTMENT_TICKS_STEP]));
  const lost = customers.filter(c => c.log.some(e => e.text === "Moved to " + LOST_STAGE && inPeriod(e.date)));

  return {
    start, end, name, sales, quoted, lost,
    leads: t.leads,
    appointments: t.appointments,
    salesCount: t.sales,
    value: t.value,
    conversion: t.appointments ? Math.round((t.sales / t.appointments) * 100) : 0,
    average: t.sales ? Math.round(t.value / t.sales) : 0,
    newCustomers: customers.filter(c => inPeriod(c.created)).length,
    quotedValue: quoted.reduce((sum, c) => sum + (+c.value || 0), 0),
    lostCount: lost.length,
  };
}

function renderReview(kind) {
  const now = reviewNumbers(kind, state.reviewDate);
  const before = reviewNumbers(kind, addDays(-1, now.start));   // the period just before
  const unit = kind === "week" ? "week" : "month";
  const openQuotes = allCustomers().filter(c => c.stage === QUOTE_STAGE);

  const card = (label, key, show = v => v) => {
    const diff = now[key] - before[key];
    const arrow = diff > 0 ? `<em class="up">▲ ${show(diff)}</em>` : diff < 0 ? `<em class="down">▼ ${show(-diff)}</em>` : `<em>same</em>`;
    return `<div class="stat"><b>${show(now[key])}</b><span>${label}</span><small>${arrow} vs last ${unit}</small></div>`;
  };
  const pct = v => v + "%";
  const list = (title, rows, empty) => `
    <h2>${title}<i>${rows.length}</i></h2>
    <div class="list">${rows.join("") || `<div class="empty">${empty}</div>`}</div>`;

  return `
    <div class="date-nav">
      <button class="btn-small" onclick="moveReview(-1)">‹</button>
      <b class="period-name">${escapeHtml(now.name)}</b>
      <button class="btn-small" onclick="moveReview(1)">›</button>
      <button class="btn-small" onclick="state.reviewDate = today(); render()">This ${unit}</button>
    </div>

    <p class="review-summary">
      ${now.leads} leads, ${now.appointments} appointments, ${now.salesCount} sales worth <b>${money(now.value)}</b>
      (${now.conversion}% conversion).
    </p>

    <div class="stats">
      ${card("Leads", "leads")}
      ${card("Appointments", "appointments")}
      ${card("Sales", "salesCount")}
      ${card("Sales value", "value", money)}
      ${card("Conversion", "conversion", pct)}
      ${card("Average sale", "average", money)}
      ${card("New customers", "newCustomers")}
      ${card("Lost", "lostCount")}
    </div>

    ${list("Sales", now.sales.map(s => `
      <div class="row"><div class="row-main"><b>${escapeHtml(s.name)}</b><span>${formatDate(s.date)}</span></div>
      <span class="value-cell">${money(s.value)}</span></div>`), "No sales in this " + unit)}

    ${list(`Quotes given · ${money(now.quotedValue)}`, now.quoted.map(c => `
      <div class="row" onclick="openCustomer('${c.id}')"><div class="row-main"><b>${escapeHtml(c.name)}</b>
      <span>${stagePill(c.stage)}</span></div><span class="value-cell">${money(c.value)}</span></div>`), "No quotes given")}

    ${list("Lost", now.lost.map(c => `
      <div class="row" onclick="openCustomer('${c.id}')"><div class="row-main"><b>${escapeHtml(c.name)}</b></div>
      <span class="value-cell">${c.value ? money(c.value) : "–"}</span></div>`), "Nobody lost")}

    ${reviewChart(now.start, now.end, kind)}

    <p class="muted small" style="margin-top:16px">
      Right now: ${openQuotes.length} open quotes worth ${money(openQuotes.reduce((s, c) => s + (+c.value || 0), 0))}.
    </p>`;
}

/* ---------- Review chart ----------
   Leads (top) and sales value (bottom) for each day of the period, on one
   shared timeline. Two panels rather than two lines in one box: leads are
   single numbers and value is thousands of pounds, so on one scale the leads
   line would lie flat along the bottom. Tap or hover to read a day. */
let chartDays = [];   // the days drawn, for the tap / hover read-out
const CHART = { width: 340, side: 10, panel: 64, gap: 40, top: 26 };

function reviewChart(start, end, kind) {
  chartDays = [];
  for (let d = start; d <= end; d = addDays(1, d)) {
    const t = dayTotals(d);
    chartDays.push({ date: d, leads: t.leads, value: t.value });
  }
  const { width, side, panel, gap, top } = CHART;
  const n = chartDays.length;
  const x = i => side + i * (width - 2 * side) / (n - 1);
  const height = top + panel + gap + panel + 26;

  // One panel: its name + peak, a baseline, the line, and dots when there's room.
  const drawPanel = (key, y0, colour, name, show) => {
    const peak = Math.max(1, ...chartDays.map(d => d[key]));
    const y = v => y0 + panel - (v / peak) * panel;
    const points = chartDays.map((d, i) => `${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");
    const dots = n <= 10 ? chartDays.map((d, i) =>
      `<circle cx="${x(i)}" cy="${y(d[key])}" r="4" fill="${colour}" stroke="var(--card)" stroke-width="2"/>`).join("") : "";
    return `
      <circle cx="${side + 4}" cy="${y0 - 14}" r="4" fill="${colour}"/>
      <text x="${side + 14}" y="${y0 - 10}" class="chart-name">${name}</text>
      <text x="${width - side}" y="${y0 - 10}" class="chart-note" text-anchor="end">peak ${show(peak)}</text>
      <line x1="${side}" x2="${width - side}" y1="${y0 + panel}" y2="${y0 + panel}" class="chart-base"/>
      <polyline points="${points}" fill="none" stroke="${colour}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
      ${dots}`;
  };

  // Day labels along the bottom: every day for a week, every 7th day for a month.
  const ticks = chartDays.map((d, i) => {
    if (kind === "month" && i % 7 !== 0) return "";
    const label = kind === "week" ? formatDate(d.date).slice(0, 3) : String(Number(d.date.slice(8)));
    return `<text x="${x(i)}" y="${height - 6}" class="chart-note" text-anchor="middle">${label}</text>`;
  }).join("");

  return `
    <h2>Leads and sales over time</h2>
    <div class="list panel chart">
      <p class="chart-readout" id="chart-readout">Tap the chart to see a day</p>
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Leads and sales value by day"
           onpointermove="chartPoint(event, this)" onpointerdown="chartPoint(event, this)">
        ${drawPanel("leads", top, "var(--chart-1)", "Leads", v => v)}
        ${drawPanel("value", top + panel + gap, "var(--chart-2)", "Sales value", money)}
        ${ticks}
        <line id="chart-cross" x1="0" x2="0" y1="${top - 4}" y2="${top + 2 * panel + gap}" class="chart-cross" visibility="hidden"/>
      </svg>
    </div>`;
}

// Tap / hover: snap to the nearest day, draw a line there and show its numbers.
function chartPoint(event, svg) {
  const box = svg.getBoundingClientRect();
  const along = (event.clientX - box.left) / box.width * CHART.width;
  const n = chartDays.length;
  const i = Math.max(0, Math.min(n - 1, Math.round((along - CHART.side) / ((CHART.width - 2 * CHART.side) / (n - 1)))));
  const day = chartDays[i];
  const cross = svg.querySelector("#chart-cross");
  const cx = CHART.side + i * (CHART.width - 2 * CHART.side) / (n - 1);
  cross.setAttribute("x1", cx); cross.setAttribute("x2", cx); cross.setAttribute("visibility", "visible");
  $("#chart-readout").textContent = `${formatDate(day.date)} · ${day.leads} lead${day.leads === 1 ? "" : "s"} · ${money(day.value)} sales`;
}

// ‹ and › on a review: back or forward one week / month.
function moveReview(direction) {
  const { start, end } = periodOf(state.trackMode, state.reviewDate);
  state.reviewDate = direction < 0 ? addDays(-1, start) : addDays(1, end);
  render();
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

// The − and + buttons either side of the leads number (never below 0).
function changeLeads(by) {
  const day = dayRecord(state.trackDate);
  day.leads = Math.max(0, (+day.leads || 0) + by);
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

function setLaterSale(i, value) {
  const day = dayRecord(state.trackDate);
  day.sales[i].value = value;
  saveDay(day);
}

function deleteLaterSale(i) {
  const day = dayRecord(state.trackDate);
  day.sales.splice(i, 1);
  saveDay(day);
}
