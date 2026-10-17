/* =====================================================================
   MY COMMISSION  —  the card at the bottom of the Tracking page, and the
   slide-up panel it opens.

   Commission is worked out per sale from its room type:
     • a % paid at the sale (deposit), and
     • a % paid once delivered (when the DELIVERED_STEP journey step is ticked).
   Normal account: see your sales and commission for a time period.
   Developer mode: edit the rates for each room type.
   ===================================================================== */

const COMMISSION_PERIODS = [
  ["week", "This week"], ["month", "This month"], ["lastMonth", "Last month"], ["year", "This year"], ["all", "All time"],
];

// The rates for every room type: saved settings first, then config.js defaults, else 0%.
function commissionRates() {
  const saved = settingsRecord().commission || {};
  const rates = {};
  ROOMS.forEach(room => {
    rates[room] = { atSale: 0, onDelivery: 0, ...COMMISSION_DEFAULTS[room], ...saved[room] };
  });
  return rates;
}

// First and last date of a period.
function commissionRange(period) {
  const now = today();
  if (period === "week") return { start: mondayOf(now), end: addDays(6, mondayOf(now)) };
  if (period === "month") return periodOf("month", now);
  if (period === "lastMonth") return periodOf("month", addDays(-1, periodOf("month", now).start));
  if (period === "year") return { start: now.slice(0, 4) + "-01-01", end: now.slice(0, 4) + "-12-31" };
  return { start: "0000-01-01", end: "9999-12-31" };   // all time
}

// Every sale on the Tracking page in that period, with its commission.
function commissionSales(period) {
  const { start, end } = commissionRange(period);
  const rates = commissionRates();
  const sales = [];
  Object.values(records)
    .filter(r => r.kind === "day" && r.date >= start && r.date <= end)
    .forEach(day => {
      const sold = [...(day.appointments || []).filter(a => a.sold), ...(day.sales || [])];
      sold.forEach(s => {
        // Find the customer to get their room type and whether they've been delivered.
        const c = records[s.customerId] || allCustomers().find(c => c.name === s.name);
        const room = c ? c.room : ROOMS[0];
        const value = +s.value || 0;
        const rate = rates[room] || { atSale: 0, onDelivery: 0 };
        sales.push({
          date: day.date, name: s.name, room, value,
          delivered: !!(c && c.journey[DELIVERED_STEP]),
          atSale: value * rate.atSale / 100,
          onDelivery: value * rate.onDelivery / 100,
        });
      });
    });
  return sales.sort((a, b) => a.date < b.date ? 1 : -1);   // newest first
}

function commissionTotals(period) {
  const sales = commissionSales(period);
  const sum = list => list.reduce((total, n) => total + n, 0);
  const atSale = sum(sales.map(s => s.atSale));
  const deliveredPart = sum(sales.filter(s => s.delivered).map(s => s.onDelivery));
  const toCome = sum(sales.filter(s => !s.delivered).map(s => s.onDelivery));
  return { sales, value: sum(sales.map(s => s.value)), atSale, deliveredPart, earned: atSale + deliveredPart, toCome };
}

// £ with pence (commission is rarely a round number).
function pounds(amount) {
  return "£" + amount.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


/* ---------- The card at the bottom of the Tracking page ---------- */

function commissionCard() {
  const t = commissionTotals(state.commissionPeriod);
  const periodName = COMMISSION_PERIODS.find(([key]) => key === state.commissionPeriod)[1];
  return `
    <h2>My commission</h2>
    <button class="list panel commission-card" onclick="openCommission()">
      ${isDevMode()
        ? `<b>Commission rates</b><span>Tap to edit the % for each room type</span>`
        : `<b>${pounds(t.earned)}</b><span>earned · ${periodName.toLowerCase()} · from ${money(t.value)} of sales</span>`}
      <small>Tap to open ›</small>
    </button>`;
}


/* ---------- The slide-up panel ---------- */

function openCommission() {
  openSheet(isDevMode() ? ratesEditor() : commissionView());
}

// Normal account: totals and every sale for the chosen period.
function commissionView() {
  const t = commissionTotals(state.commissionPeriod);
  const chips = COMMISSION_PERIODS.map(([key, label]) =>
    `<button class="${state.commissionPeriod === key ? "on" : ""}" onclick="state.commissionPeriod = '${key}'; updateSheet(commissionView()); render()">${label}</button>`
  ).join("");
  const rows = t.sales.map(s => `
    <div class="row">
      <div class="row-main"><b>${escapeHtml(s.name)}</b>
        <span>${escapeHtml(s.room)} · ${formatDate(s.date)} · ${money(s.value)}</span></div>
      <div class="commission-cell">
        <b>${pounds(s.atSale + (s.delivered ? s.onDelivery : 0))}</b>
        <small>${s.delivered ? "✓ delivered" : `+${pounds(s.onDelivery)} on delivery`}</small>
      </div>
    </div>`).join("");
  const rates = commissionRates();
  const rateLine = ROOMS.filter(r => rates[r].atSale || rates[r].onDelivery)
    .map(r => `${r} ${rates[r].atSale}% + ${rates[r].onDelivery}% on delivery`).join(" · ") || "No rates set yet (Developer mode)";

  return `
    <h1 class="sheet-title">My commission</h1>
    <div class="chips filters">${chips}</div>
    <div class="stats">
      <div class="stat"><b>${money(t.value)}</b><span>Total sales value</span></div>
      <div class="stat"><b>${pounds(t.earned)}</b><span>Commission earned</span></div>
      <div class="stat"><b>${pounds(t.atSale)}</b><span>Paid at sale</span></div>
      <div class="stat"><b>${pounds(t.toCome)}</b><span>Still to come on delivery</span></div>
    </div>
    <h2>Sales<i>${t.sales.length}</i></h2>
    <div class="list">${rows || `<div class="empty">No sales in this period</div>`}</div>
    <p class="muted small">Rates: ${escapeHtml(rateLine)}</p>`;
}

// Developer mode: edit the two rates for each room type.
function ratesEditor() {
  const rates = commissionRates();
  const rows = ROOMS.map(room => `
    <div class="rate-row">
      <b>${escapeHtml(room)}</b>
      <label><span>At sale (%)</span><input type="number" inputmode="decimal" step="0.1" min="0" value="${rates[room].atSale}"
             onchange="setRate('${escapeHtml(room)}', 'atSale', this.value)"></label>
      <label><span>On delivery (%)</span><input type="number" inputmode="decimal" step="0.1" min="0" value="${rates[room].onDelivery}"
             onchange="setRate('${escapeHtml(room)}', 'onDelivery', this.value)"></label>
    </div>`).join("");
  return `
    <h1 class="sheet-title">Commission rates</h1>
    <p class="muted small">For each room type: the % of the sale paid at the deposit, and the % paid once it's delivered.
      These are used by your normal account.</p>
    <div class="list panel">${rows}</div>`;
}

function setRate(room, part, value) {
  const settings = settingsRecord();
  settings.commission = settings.commission || {};
  settings.commission[room] = { ...commissionRates()[room], [part]: Math.max(0, +value || 0) };
  saveRecord(settings);
}
