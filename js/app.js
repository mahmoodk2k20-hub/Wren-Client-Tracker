/* =====================================================================
   APP  —  starts everything and switches between pages.
   To add a new page: write a renderXxx() function in js/pages/,
   add it to PAGES below, and add a button in index.html.
   ===================================================================== */

// Things the app remembers while it's open (not saved).
const state = {
  view:          "today",   // which page is showing
  openId:        null,      // customer open in the side panel
  search:        "",        // Customers page search box
  filter:        "All",     // Customers page stage filter
  trackDate:     today(),   // Tracking page date
  confirmDelete: false,
  leadsPeriod:   "day",     // Today page Leads card: "day" or "week" (tap to switch)
  salesPeriod:   "week",    // Today page Sales card: "day" or "week"
  recentlyDone:  {},        // tasks just ticked on Today, kept for Undo: { taskId: { customerId, before } }
  customerView:  "list",    // Customers page: "list" or "board"
  trackMode:     "daily",   // Tracking page: "daily", "week" or "month"
  reviewDate:    today(),   // any date inside the week/month being reviewed
};

// Page name -> function that draws it.
const PAGES = {
  today:     renderToday,
  customers: renderCustomers,
  tracking:  renderTracking,
};

// Pages that still make sense with no customers yet.
const PAGES_WITHOUT_CUSTOMERS = ["tracking"];

function showPage(view) {
  state.view = view;
  render();
}

// Redraws the current page. Called after every change.
function render() {
  document.querySelectorAll("nav button").forEach(b => b.classList.toggle("on", b.dataset.view === state.view));
  $("#dev-refresh").hidden = !(authState === "signed-in" && isDevMode());
  $("#fab").hidden = authState !== "signed-in";
    if (authState === "checking")   { $("#app").innerHTML = `<div class="hero"><p>Loading…</p></div>`; return; }
  if (authState === "signed-out") { $("#app").innerHTML = signInScreen(); return; }
  const noCustomers = allCustomers().length === 0;
  $("#app").innerHTML = noCustomers && !PAGES_WITHOUT_CUSTOMERS.includes(state.view)
    ? welcomeScreen()
    : PAGES[state.view]();
}

function welcomeScreen() {
  return `
    <div class="hero">
      <h2>Welcome</h2>
      <button class="btn-primary" onclick="newCustomerDialog()">+ Add Client</button>
    </div>`;
}


/* ---------- Keyboard & tab focus ---------- */

document.addEventListener("keydown", e => {
  if (e.key === "Escape" && state.openId) closeCustomer();
});

// Coming back to the tab the next day? Redraw so "Today" is actually today.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && !state.openId) render();
});


/* ---------- Start ---------- */

// Opened from the iPhone Home Screen? Mark the page so app.css can fix the screen height.
if (navigator.standalone) document.documentElement.classList.add("standalone");

// Start the service worker (sw.js), which lets the app open with no signal.
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

loadFromDevice();
render();
connectToAccount();

// Block pinch-zoom on iPhone (Safari sometimes ignores the viewport setting).
document.addEventListener("gesturestart", e => e.preventDefault());
