/* =====================================================================
   STORAGE  —  saving and loading.
   Everything is kept in `records` (customers + daily stats), saved on
   this device straight away, and synced to your Supabase database
   when you're signed in.
   ===================================================================== */

// All saved records, by id. Customers have no `kind`; daily stats have kind: "day".
let records = {};

// "checking" while starting up, then "signed-in" or "signed-out".
let authState = "checking";
let myUserId = null;

const LOCAL_KEY = "hub2";
const SEEN_KEY  = "hub2-seen";   // ids known to be online (spots deletions made on other devices)
const DEV_KEY   = "hub2-dev";    // "on" while signed in with Developer mode (shows the Refresh button)

// Ticked with the "Developer mode" button on the sign-in page, used when you sign in.
let devModeChosen = false;

function isDevMode() {
  try { return localStorage.getItem(DEV_KEY) === "on"; } catch (e) { return false; }
}


/* ---------- Status line under "Client Hub" ---------- */
function setStatus(message) {
  $("#status").textContent = message;
}


/* ---------- Saving ---------- */

function saveOnDevice() {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(records)); } catch (e) { /* storage blocked */ }
}

function loadSeen() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch (e) { return {}; }
}

function saveSeen(seen) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(seen)); } catch (e) {}
}

async function sendToAccount(record) {
  if (authState !== "signed-in") return;
  const { error } = await supa.from("records").upsert({
    user_id:    myUserId,
    id:         record.id,
    data:       deepCopy(record),
    updated_at: new Date(record.updatedAt || Date.now()).toISOString(),
  });
  if (error) { setStatus("⚠ Not saved online (" + error.message + ") – saved on this device"); return; }
  const seen = loadSeen();
  seen[record.id] = true;
  saveSeen(seen);
}

// Call this whenever a record changes.
function saveRecord(record) {
  record.updatedAt = Date.now();
  records[record.id] = record;
  saveOnDevice();
  sendToAccount(record);
}

/* Deleting.
   The id goes on a "to delete" list saved on this device first, then the app
   tells the database. If that fails (no signal), the id stays on the list:
   it's retried at the next sync, and until then the sync won't bring the
   customer back from the database. */
const DELETED_KEY = "hub2-deleted";   // ids deleted here but not yet online

function loadDeleted() {
  try { return JSON.parse(localStorage.getItem(DELETED_KEY) || "{}"); } catch (e) { return {}; }
}

function saveDeleted(list) {
  try { localStorage.setItem(DELETED_KEY, JSON.stringify(list)); } catch (e) {}
}

async function deleteRecord(id) {
  delete records[id];
  saveOnDevice();
  const toDelete = loadDeleted();
  toDelete[id] = true;
  saveDeleted(toDelete);
  await sendDeletes();
}

// Tells the database about every delete on the "to delete" list.
async function sendDeletes() {
  const ids = Object.keys(loadDeleted());
  if (authState !== "signed-in" || ids.length === 0) return;
  let error;
  try { ({ error } = await supa.from("records").delete().in("id", ids)); }
  catch (e) { error = e; }
  if (error) { setStatus("⚠ Delete not online yet – will retry"); return; }

  const toDelete = loadDeleted();   // re-read: something may have been deleted meanwhile
  const seen = loadSeen();
  ids.forEach(id => { delete toDelete[id]; delete seen[id]; });
  saveDeleted(toDelete);
  saveSeen(seen);
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
  r.journey = r.journey || {};
  r.notes   = r.notes   || {};
  r.tasks   = r.tasks   || [];
  r.log     = r.log     || [];
  r.log.forEach(entry => {
    if (entry.d) { entry.date = entry.d; delete entry.d; }
    if (entry.t) { entry.text = entry.t; delete entry.t; }
  });
  return r;
}


/* ---------- Loading & syncing ---------- */

function loadFromDevice() {
  try { records = JSON.parse(localStorage.getItem(LOCAL_KEY) || "{}"); } catch (e) { records = {}; }
  Object.values(records).forEach(normalise);
  setStatus("Saved on this device");
}

// Merges the database with this device. Whichever copy changed most recently wins.
async function pullFromAccount() {
  setStatus("Syncing…");
  await sendDeletes();   // first, send any deletes made while there was no signal
  const { data, error } = await supa.from("records").select("id, data");
  if (error) {
    setStatus("⚠ Couldn't load online data (" + error.message + ")");
    render();
    return;
  }

  const onServer = {};
  const deletedHere = loadDeleted();
  data.forEach(row => {
    if (deletedHere[row.id]) return;   // deleted on this device – don't bring it back
    const remote = normalise(row.data);
    const local = records[row.id];
    onServer[row.id] = remote.updatedAt || 0;
    if (!local || (remote.updatedAt || 0) >= (local.updatedAt || 0)) records[row.id] = remote;
  });

  const seen = loadSeen();
  Object.values(records).forEach(r => {
    if (r.id in onServer) {
      if ((r.updatedAt || 0) > onServer[r.id]) sendToAccount(r);   // changed here more recently
    } else if (seen[r.id]) {
      delete records[r.id];                                       // deleted on another device
    } else {
      sendToAccount(r);                                           // new on this device
    }
  });
  const nowSeen = {};
  Object.keys(onServer).forEach(id => nowSeen[id] = true);
  saveSeen(nowSeen);

  saveOnDevice();
  setStatus("Synced online");
  const typing = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "");
  if (!typing) {
    render();
    if (state.openId) drawCustomerPage();   // show the newest copy of the open customer too
  }
}

// Watches for sign-in / sign-out (including when you come back from the email link).
function connectToAccount() {
  supa.auth.onAuthStateChange((event, session) => {
    if (session && authState !== "signed-in") {
      myUserId = session.user.id;
      authState = "signed-in";
      // Go straight to the Today page. Drawing it now also removes the sign-in
      // boxes; before, the cursor stayed in the password box, so the sync below
      // thought you were typing and never swapped the screen over.
      state.view = "today";
      setTimeout(() => { document.activeElement?.blur(); render(); pullFromAccount(); }, 0);
    } else if (!session) {
      authState = "signed-out";
      setStatus("Not signed in");
      render();
    }
  });
}

// Re-sync when you come back to the tab (picks up changes made on your phone, etc.).
// This also runs while a customer's panel is open. Otherwise a panel left open
// on one device could save its old copy over changes made on another device.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && authState === "signed-in") pullFromAccount();
});


/* ---------- Backup ----------
   Downloads everything (customers + daily stats) as one file you keep yourself,
   in case anything ever goes wrong with the online database.
   ⚠ It holds customers' personal details: keep it private, and never put it
   in this project folder (the GitHub repo is public). */
function downloadBackup() {
  const file = new Blob([JSON.stringify(records, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = "client-tracker-backup-" + today() + ".json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}


/* ---------- Sign in / out ---------- */

function signInScreen() {
  return `
    <div class="hero">
      <h2>Sign in</h2>
      <form onsubmit="event.preventDefault(); signIn()" style="max-width:320px; margin:0 auto">
        <input id="signin-email" type="email" placeholder="Email" autocomplete="username" required>
        <input id="signin-password" type="password" placeholder="Password" autocomplete="current-password" required style="margin-top:8px">
        <p><button class="btn-primary" type="submit">Sign in</button></p>
      </form>
      <p id="signin-msg"></p>
      <p style="margin-top:40px">
        <button class="btn-small ${devModeChosen ? "on" : ""}" onclick="toggleDevModeChoice(this)">
          ${devModeChosen ? "Developer mode ✓" : "Developer mode"}
        </button>
      </p>
    </div>`;
}

// Developer mode button on the sign-in page. Updates just the button, so your
// typed email and password stay put.
function toggleDevModeChoice(button) {
  devModeChosen = !devModeChosen;
  button.classList.toggle("on", devModeChosen);
  button.textContent = devModeChosen ? "Developer mode ✓" : "Developer mode";
}

async function signIn() {
  $("#signin-msg").textContent = "Signing in…";
  // Set before signing in, so the very first screen after sign-in already shows Refresh.
  try { devModeChosen ? localStorage.setItem(DEV_KEY, "on") : localStorage.removeItem(DEV_KEY); } catch (e) {}
  const { error } = await supa.auth.signInWithPassword({
    email: $("#signin-email").value.trim(),
    password: $("#signin-password").value,
  });
  if (error) try { localStorage.removeItem(DEV_KEY); } catch (e) {}
  $("#signin-msg").textContent = error ? "⚠ " + error.message : "";
}

async function signOut() {
  devModeChosen = false;
  try { localStorage.removeItem(DEV_KEY); } catch (e) {}   // signing out always leaves Developer mode
  await supa.auth.signOut();
  records = {};
  saveOnDevice();
  saveSeen({});
}
