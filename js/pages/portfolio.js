/* =====================================================================
   PORTFOLIO  —  for customers happy for you to use photos of their room.
   Tick the box on their panel, then add photos. Each photo is uploaded
   to Supabase Storage exactly as your phone hands it over: no resizing,
   no compression, so it stays at full quality.

   Photos live in a private storage "bucket" (a folder in the cloud) called
   PORTFOLIO_BUCKET, inside a folder named after your account, so only you
   can see them. The customer record just keeps a list of where each one is.
   ===================================================================== */

const PORTFOLIO_BUCKET = "portfolio";

// Temporary links to show the photos (a private bucket needs a signed link).
const photoLinks = {};   // path -> link

function portfolioSection(c) {
  const photos = c.photos || [];
  const tiles = photos.map((p, i) => `
    <div class="photo">
      <img data-photo="${escapeHtml(p.path)}" alt="${escapeHtml(p.name)}" onclick="openPhoto(this.dataset.photo)">
      <button class="btn-small" onclick="deletePhoto(${i})" aria-label="Delete photo">✕</button>
    </div>`).join("");

  return `
    <h2>Portfolio${photos.length ? `<i>${photos.length}</i>` : ""}</h2>
    <label class="step">
      <input type="checkbox" ${c.portfolio ? "checked" : ""} onchange="setPortfolio(this.checked)">
      <span>Happy for their photos to be used in my portfolio</span>
    </label>
    ${c.portfolio ? `
      ${tiles ? `<div class="photo-grid">${tiles}</div>` : ""}
      <label class="btn-secondary wide-button upload-button">
        + Add photos
        <input type="file" accept="image/*" multiple hidden onchange="uploadPhotos(this.files)">
      </label>
      <p class="muted small" id="photo-status">Saved at full quality, exactly as your phone sends them. Tap a photo to open the original.</p>` : ""}`;
}

function setPortfolio(allowed) {
  const c = currentCustomer();
  c.portfolio = allowed;
  addHistory(c, allowed ? "Agreed to portfolio photos" : "Portfolio photos turned off");
  saveCustomer(c);
}

async function uploadPhotos(files) {
  const c = currentCustomer();
  const status = msg => { const el = $("#photo-status"); if (el) el.textContent = msg; };
  if (authState !== "signed-in" || !navigator.onLine) { status("⚠ Photos need signal to upload. Try again when you're online."); return; }

  const list = [...files];
  for (let i = 0; i < list.length; i++) {
    const file = list[i];
    status(`Uploading ${i + 1} of ${list.length}…`);
    // e.g. "<your id>/<customer id>/1792185000000-IMG_1234.jpg"
    const path = `${myUserId}/${c.id}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    const { error } = await supa.storage.from(PORTFOLIO_BUCKET).upload(path, file, { contentType: file.type || undefined });
    if (error) { status("⚠ Upload failed: " + error.message); return; }
    c.photos = c.photos || [];
    c.photos.push({ path, name: file.name, size: file.size, added: today() });
    saveRecord(c);
  }
  addHistory(c, `Added ${list.length} portfolio photo${list.length > 1 ? "s" : ""}`);
  saveCustomer(c);
}

async function deletePhoto(i) {
  const c = currentCustomer();
  const photo = c.photos[i];
  if (!confirm("Delete this photo? This can't be undone.")) return;
  const { error } = await supa.storage.from(PORTFOLIO_BUCKET).remove([photo.path]);
  if (error) { alert("Couldn't delete: " + error.message); return; }
  c.photos.splice(i, 1);
  saveCustomer(c);
}

// Fills in the photo tiles after the panel is drawn (links are fetched, so it's a moment later).
async function showPhotos() {
  const imgs = [...document.querySelectorAll("img[data-photo]")];
  const missing = imgs.map(img => img.dataset.photo).filter(path => !photoLinks[path]);
  if (missing.length && authState === "signed-in") {
    const { data } = await supa.storage.from(PORTFOLIO_BUCKET).createSignedUrls(missing, 60 * 60);
    (data || []).forEach(link => { if (link.signedUrl) photoLinks[link.path] = link.signedUrl; });
  }
  imgs.forEach(img => { if (photoLinks[img.dataset.photo]) img.src = photoLinks[img.dataset.photo]; });
}

// Opens the full-size original (to view or save to your phone).
function openPhoto(path) {
  if (photoLinks[path]) window.open(photoLinks[path], "_blank");
}
