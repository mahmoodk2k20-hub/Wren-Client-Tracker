/* =====================================================================
   HELPERS  —  small tools used everywhere (dates, money, safe text).
   You shouldn't normally need to change anything here.
   ===================================================================== */

// Shortcut for finding one element on the page, e.g. $("#app").
const $ = selector => document.querySelector(selector);

// Makes text safe to put on the page (stops names like <b>Tom</b> breaking the layout).
function escapeHtml(text) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(text ?? "").replace(/[&<>"']/g, ch => map[ch]);
}


/* ---------- Dates ----------
   Dates are stored as text like "2026-10-16" so they sort correctly. */

function toISO(date) {
  const pad = n => String(n).padStart(2, "0");
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

function today() {
  return toISO(new Date());
}

// addDays(7) = a week from today;  addDays(1, "2026-10-16") = "2026-10-17"
function addDays(days, from) {
  const date = from ? new Date(from + "T12:00") : new Date();
  date.setDate(date.getDate() + days);
  return toISO(date);
}

// The Monday of the week a date falls in.
function mondayOf(isoDate) {
  const date = new Date(isoDate + "T12:00");
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return toISO(date);
}

// "2026-10-16" -> "Fri, 16 Oct"
function formatDate(isoDate) {
  if (!isoDate) return "";
  return new Date(isoDate + "T12:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}


/* ---------- Other ---------- */

function money(amount) {
  return "£" + Number(amount || 0).toLocaleString("en-GB");
}

function newId() {
  return "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

// Grows a text box to fit everything written in it (so long notes aren't hidden).
function fitHeight(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = (textarea.scrollHeight + 2) + "px";   // +2 for the border
}


/* ---------- Stage pills ---------- */

function stageColour(stageName) {
  const stage = STAGES.find(s => s.name === stageName);
  return stage ? stage.colour : 0;
}

function stageDot(stageName) {
  return `<span class="dot" style="background:hsl(${stageColour(stageName)} 55% 50%)"></span>`;
}

function stagePill(stageName) {
  return `<span class="pill">${stageDot(stageName)}${escapeHtml(stageName)}</span>`;
}
