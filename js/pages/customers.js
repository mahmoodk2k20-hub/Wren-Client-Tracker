/* =====================================================================
   CUSTOMERS PAGE  —  searchable list with stage, progress, sold /
   active status, next follow-up and quote value.
   ===================================================================== */

function renderCustomers() {
  const everyone = allCustomers();
  const filterButtons = ["All", ...STAGES.map(s => s.name)].map(name => {
    const count = name === "All" ? everyone.length : everyone.filter(c => c.stage === name).length;
    return `<button class="${state.filter === name ? "on" : ""}" data-stage="${escapeHtml(name)}"
              onclick="state.filter = this.dataset.stage; render()">${escapeHtml(name)} (${count})</button>`;
  }).join("");

  return `
    <input class="search" placeholder="Search name, phone, address…" value="${escapeHtml(state.search)}"
           oninput="state.search = this.value; $('#customer-list').innerHTML = renderCustomerList()">
    <div class="chips filters">${filterButtons}</div>
    <div id="customer-list">${renderCustomerList()}</div>
  `;
}

// The list itself (redrawn on its own while you type in the search box).
function renderCustomerList() {
  const search = state.search.toLowerCase();
  const matches = allCustomers()
    .filter(c => state.filter === "All" || c.stage === state.filter)
    .filter(c => !search || [c.name, c.phone, c.email, c.address].join(" ").toLowerCase().includes(search))
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  const header = `
    <div class="crow head">
      <div>Customer</div><div>Stage / progress</div><div>Status</div><div>Next follow-up</div><div class="value">Quote</div>
    </div>`;
  const rows = matches.map(customerRow).join("") || `<div class="empty">No customers found</div>`;
  return `<div class="list">${header}${rows}</div>`;
}

// Order: soonest follow-up first, then no follow-up, then closed customers last.
function sortKey(c) {
  if (isClosed(c)) return "~";
  const next = nextTask(c);
  return next ? next.due : "}";
}

function customerRow(c) {
  const next = nextTask(c);
  const progress = journeyProgress(c);
  const percent = progress.total ? (progress.done / progress.total) * 100 : 0;
  const activeLabel = isClosed(c) ? "Closed" : next ? "Active" : "No follow-up";

  return `
    <div class="crow" onclick="openCustomer('${c.id}')">
      <div>
        <b>${escapeHtml(c.name)}</b>
        <span>${escapeHtml(c.room)} · ${escapeHtml(c.service)}${c.phone ? " · " + escapeHtml(c.phone) : ""}</span>
      </div>
      <div>
        ${stagePill(c.stage)}
        <div class="progress"><i style="width:${percent}%"></i></div>
        <small>${progress.done}/${progress.total} steps</small>
      </div>
      <div>
        <span class="badge ${isSold(c) ? "green" : ""}">${isSold(c) ? "Sold" : "Not sold"}</span>
        <span class="badge ${activeLabel === "Active" ? "amber" : ""}">${activeLabel}</span>
      </div>
      <div class="due ${next && next.due < today() ? "late" : ""}">
        ${next ? escapeHtml(next.text) + "<br>" + formatDate(next.due) : "–"}
      </div>
      <div class="value">${c.value ? money(c.value) : "–"}</div>
    </div>`;
}
