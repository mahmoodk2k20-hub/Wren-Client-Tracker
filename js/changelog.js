/* =====================================================================
   CHANGELOG  —  what's new, in plain English.
   Shown in a pop-up when you tap ↻ Refresh in Developer mode: it lists
   every update you haven't seen yet on this device.

   To add an update: put a new block at the TOP, with a version number
   one higher than the last, today's date, and a short line per change.
   ===================================================================== */

const CHANGELOG = [
  {
    version: 4,
    date: "2026-10-17",
    changes: [
      "Notes (Developer mode): long notes now wrap onto new lines so you can read all of them.",
    ],
  },
  {
    version: 3,
    date: "2026-10-17",
    changes: [
      "Tracking: new My commission section at the bottom. Tap it to slide up your sales and commission for a time period.",
      "Developer mode: My commission lets you set the % at sale and % on delivery for each room type.",
      "Today: ticked tasks stay for the rest of the day, greyed out at the bottom. Tap the tick again to undo.",
      "Today: the \"No follow-up booked\" list now opens and closes when you tap its heading.",
      "Customers: new Sort menu (next follow-up, name, newest, value, stage).",
      "Tracking: leads now use a − and + counter.",
      "Week and month reviews: a chart of leads and sales value by day. Tap it to read a day.",
    ],
  },
  {
    version: 2,
    date: "2026-10-17",
    changes: [
      "New customer pop-up: switch on \"Past client\" to add old customers with their stage and value.",
      "Past clients never add leads or sales to Tracking, and stay out of your weekly and monthly reviews.",
      "Past clients show a \"Past\" label, there's a \"Past\" filter on the Customers list, and each customer's Details has a Past client switch.",
    ],
  },
  {
    version: 1,
    date: "2026-10-16",
    changes: [
      "Developer mode now has its own test customers and stats, kept apart from your real ones.",
      "Tapping Refresh in Developer mode shows this list of what's changed.",
      "New customer pop-up: switch on \"Add several\" to add customers one after another.",
      "New Notes tab in Developer mode for jotting down changes you want, like Apple Reminders.",
    ],
  },
];


/* ---------- The pop-up ---------- */

const CHANGELOG_SEEN_KEY = "hub2-changelog-seen";   // newest version shown on this device

// Refresh button (Developer mode): reload the app, then show what's new.
function refreshApp() {
  try { sessionStorage.setItem("hub2-refreshed", "yes"); } catch (e) {}
  location.reload();
}

function showWhatsNew() {
  let lastSeen = 0;
  try { lastSeen = +localStorage.getItem(CHANGELOG_SEEN_KEY) || 0; } catch (e) {}
  // First time on this device: just the latest update, not the whole history.
  const fresh = lastSeen ? CHANGELOG.filter(u => u.version > lastSeen) : CHANGELOG.slice(0, 1);
  try { localStorage.setItem(CHANGELOG_SEEN_KEY, CHANGELOG[0].version); } catch (e) {}

  const body = fresh.length
    ? fresh.map(u => `
        <p class="muted small">${formatDate(u.date)}</p>
        <ul class="changes">${u.changes.map(line => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`).join("")
    : `<p>You're up to date. Nothing has changed since your last refresh.</p>`;
  openPopup(`
    <h1>${fresh.length ? "What's new" : "No new changes"}<button class="btn-close" onclick="closePopup()">×</button></h1>
    ${body}
    <button class="btn-primary wide-button" onclick="closePopup()">OK</button>`);
}

// Just reloaded from the Refresh button? Show the pop-up once the app has drawn.
(function () {
  let refreshed = false;
  try { refreshed = sessionStorage.getItem("hub2-refreshed") === "yes"; sessionStorage.removeItem("hub2-refreshed"); } catch (e) {}
  if (refreshed) setTimeout(showWhatsNew, 700);
})();
