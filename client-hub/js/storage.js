/* =====================================================================
   STORAGE  —  saving and loading.
   Everything is kept in `records` (customers + daily stats), saved on
   this device straight away, and synced to your claude.ai account when
   the page is opened from Claude.
   ===================================================================== */

// All saved records, by id. Customers have no `kind`; daily stats have kind: "day".
let records = {};

// Link to your account's storage once connected (null until then).
let accountStorage = null;

const LOCAL_KEY = "hub2";


/* ---------- Status line under "Client Hub" ---------- */
function setStatus(message) {
  $("#status").textContent = message;
}


/* ---------- Saving ---------- */

function saveOnDevice() {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(records)); } catch (e) { /* storage blocked */ }
}

function sendToAccount(record) {
  if (!accountStorage) return;
  accountStorage.doc(record.id).set(deepCopy(record))
    .catch(e => setStatus("⚠ Not synced to account (" + ((e && e.code) || "error") + ") – saved on this device"));
}

// Call this whenever a record changes.
function saveRecord(record) {
  record.updatedAt = Date.now();
  records[record.id] = record;
  saveOnDevice();
  sendToAccount(record);
}

function deleteRecord(id) {
  delete records[id];
  saveOnDevice();
  if (accountStorage) accountStorage.doc(id).delete().catch(() => {});
}


/* ---------- Tidy up a record ----------
   Fills in anything missing and upgrades data saved by older versions. */
function normalise(r) {
  if (r.k && !r.kind) r.kind = r.k;              // older versions used k / j / n / upd
  if (r.upd && !r.updatedAt) r.updatedAt = r.upd;
  delete r.k; delete r.upd;
  if (r.kind === "day") {                        // daily stats
    if (r.apps && !r.appointments) r.appointments = r.apps;
    delete r.apps;
    r.appointments = (r.appointments || []).map(a => {
      if ("val" in a) { a.value = a.val; delete a.val; }
      return a;
    });
    return r;
  }

  if (r.j && !r.journey) r.journey = r.j;
  if (r.n && !r.notes) r.notes = r.n;
  delete r.j; delete r.n;

  if (!STAGES.some(s => s.name === r.stage)) r.stage = STAGES[0].name;
  r.room    = r.room    || ROOMS[0];
  r.service = r.service || SERVICES[0];
  r.journey = r.journey || {};   // { "Qualified": "2026-10-16", ... }  step -> date ticked
  r.notes   = r.notes   || {};   // account notes, by saved-key
  r.tasks   = r.tasks   || [];   // [{ id, text, due, done, doneOn }]
  r.log     = r.log     || [];   // history, newest first: [{ date, text }]
  r.log.forEach(entry => {       // older versions used d / t
    if (entry.d) { entry.date = entry.d; delete entry.d; }
    if (entry.t) { entry.text = entry.t; delete entry.t; }
  });
  return r;
}


/* ---------- Loading ---------- */

function loadFromDevice() {
  try { records = JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}"); } catch (e) { records = {}; }
  Object.values(records).forEach(normalise);
  setStatus("Saved on this device");
}

// Connects to your claude.ai account and keeps both copies in step.
// Whichever copy of a record was changed most recently wins.
async function connectToAccount() {
  try {
    const claude = window.claude;
    const db   = claude && await claude.use("db");
    const user = claude && await claude.use("user");
    if (!db || !user) { setStatus("Saved on this device only"); return; }

    const myStorage = db.collection("data/users/" + await user.id());
    let firstTime = true;

    myStorage.onSnapshot(snapshot => {
      const onServer = {};
      snapshot.docs.forEach(doc => {
        const remote = normalise(doc.data());
        const local = records[doc.id];
        onServer[doc.id] = remote.updatedAt || 0;
        if (!local || (remote.updatedAt || 0) >= (local.updatedAt || 0)) records[doc.id] = remote;
      });

      accountStorage = myStorage;
      if (firstTime) {
        // Upload anything made on this device that the account doesn't have yet.
        firstTime = false;
        Object.values(records).forEach(r => {
          if (!(r.id in onServer) || (r.updatedAt || 0) > onServer[r.id]) sendToAccount(r);
        });
      }

      saveOnDevice();
      setStatus("Synced to your account");
      const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
      if (!typing) render();
    }, () => setStatus("⚠ Account sync unavailable – saved on this device"));
  } catch (e) {
    setStatus("Saved on this device only");
  }
}
