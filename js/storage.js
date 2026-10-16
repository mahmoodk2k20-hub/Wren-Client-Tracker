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

async function deleteRecord(id) {
  delete records[id];
  saveOnDevice();
  if (authState !== "signed-in") return;
  const { error } = await supa.from("records").delete().eq("id", id);
  if (error) { setStatus("⚠ Not deleted online (" + error.message + ")"); return; }
  const seen = loadSeen();
  delete seen[id];
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
  const { data, error } = await supa.from("records").select("id, data");
  if (error) {
    setStatus("⚠ Couldn't load online data (" + error.message + ")");
    render();
    return;
  }

  const onServer = {};
  data.forEach(row => {
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
  if (!typing) render();
}

// Watches for sign-in / sign-out (including when you come back from the email link).
function connectToAccount() {
  supa.auth.onAuthStateChange((event, session) => {
    if (session && authState !== "signed-in") {
      myUserId = session.user.id;
      authState = "signed-in";
      setTimeout(pullFromAccount, 0);
    } else if (!session) {
      authState = "signed-out";
      setStatus("Not signed in");
      render();
    }
  });
}

// Re-sync when you come back to the tab (picks up changes made on your phone, etc.).
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && authState === "signed-in" && !state.openId) pullFromAccount();
});


/* ---------- Sign in / out ---------- */

function signInScreen() {
  return `
    <div class="hero">
      <h2>Sign in</h2>
      <p>Enter your email and we'll send you a sign-in link.</p>
      <input id="signin-email" type="email" placeholder="you@example.com" style="max-width:320px"
             onkeydown="if (event.key === 'Enter') sendSignInLink()">
      <p><button class="btn-primary" onclick="sendSignInLink()">Email me a link</button></p>
      <p id="signin-msg"></p>
    </div>`;
}

async function sendSignInLink() {
  const email = $("#signin-email").value.trim();
  if (!email) return;
  $("#signin-msg").textContent = "Sending…";
  const { error } = await supa.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } });
  $("#signin-msg").textContent = error
    ? "⚠ " + error.message
    : "Check your email and open the link on this device.";
}

async function signOut() {
  await supa.auth.signOut();
  records = {};
  saveOnDevice();
  saveSeen({});
}
