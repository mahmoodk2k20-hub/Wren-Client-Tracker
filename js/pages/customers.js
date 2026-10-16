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
    <p class="swipe-hint">Swipe left: move to ${escapeHtml(SWIPE_LEFT_STAGE)} · Swipe right: delete</p>
    <div id="customer-list">${renderCustomerList()}</div>
    <p class="backup">
      <button class="btn-small" onclick="downloadBackup()">Download backup</button>
      <small>Saves all customers and daily stats to a file. Keep it private.</small>
    </p>
  `;
}

// The list itself (redrawn on its own while you type in the search box).
function renderCustomerList() {
  const search = state.search.toLowerCase();
  const matches = allCustomers()
    .filter(c => state.filter === "All" || c.stage === state.filter)
    .filter(c => !search || [c.name, c.phone, c.email, c.address].join(" ").toLowerCase().includes(search))
    .sort((a, b) => {
      // Plain character order (localeCompare put "~" before dates, so closed customers came first).
      const keyA = sortKey(a), keyB = sortKey(b);
      return keyA < keyB ? -1 : keyA > keyB ? 1 : 0;
    });

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
    <div class="crow" data-id="${c.id}" data-lost-label="${escapeHtml(SWIPE_LEFT_STAGE)}" onclick="openCustomer('${c.id}')">
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


/* ---------- Swiping a customer (phone) ----------
   Swipe a row left to move them to SWIPE_LEFT_STAGE (Lost), or right to
   delete them. The row follows your finger; let go past SWIPE_DISTANCE and
   the app asks you to confirm first.

   It uses "pointer" events (pointerdown / move / up), which fire for fingers,
   mice and pens. Only fingers count here. The row's CSS has
   touch-action: pan-y, so up-and-down still scrolls the list normally and
   only sideways movement reaches this code. */
const SWIPE_DISTANCE = 90;   // pixels you have to drag before it counts
let swipe = null;            // the row being dragged: { row, id, startX, dx }
let ignoreNextTap = false;   // a swipe shouldn't also open the customer

document.addEventListener("pointerdown", e => {
  const row = e.target.closest(".crow[data-id]");
  if (!row || e.pointerType !== "touch") return;
  swipe = { row, id: row.dataset.id, startX: e.clientX, dx: 0 };
  row.style.transition = "none";
});

document.addEventListener("pointermove", e => {
  if (!swipe) return;
  swipe.dx = e.clientX - swipe.startX;
  swipe.row.style.transform = `translateX(${swipe.dx}px)`;
  // data-swipe picks which coloured label shows behind the row (see app.css).
  swipe.row.dataset.swipe = swipe.dx < 0 ? "lost" : "delete";
});

document.addEventListener("pointerup", finishSwipe);
document.addEventListener("pointercancel", () => { if (swipe) slideBack(swipe.row); swipe = null; });

// Stops the tap that ends a swipe from opening the customer.
document.addEventListener("click", e => {
  if (!ignoreNextTap) return;
  e.stopPropagation();
  ignoreNextTap = false;
}, true);

function finishSwipe() {
  if (!swipe) return;
  const { row, id, dx } = swipe;
  swipe = null;
  if (Math.abs(dx) < 10) { row.style.transform = ""; return; }   // just a tap

  ignoreNextTap = true;
  swipeAction(row, id, dx);
  // Started after the confirm box closes (it pauses everything while it's open).
  setTimeout(() => ignoreNextTap = false, 400);
}

function swipeAction(row, id, dx) {
  const c = records[id];
  if (c && dx <= -SWIPE_DISTANCE) {
    if (c.stage !== SWIPE_LEFT_STAGE && confirm(`Move ${c.name} to ${SWIPE_LEFT_STAGE}?`)) {
      c.stage = SWIPE_LEFT_STAGE;
      addHistory(c, "Moved to " + SWIPE_LEFT_STAGE);
      saveRecord(c);
      render();
      return;
    }
  } else if (c && dx >= SWIPE_DISTANCE) {
    if (confirm(`Delete ${c.name}? This can't be undone.`)) {
      deleteRecord(id);
      render();
      return;
    }
  }
  slideBack(row);
}

function slideBack(row) {
  row.style.transition = "transform .2s";
  row.style.transform = "";
}
