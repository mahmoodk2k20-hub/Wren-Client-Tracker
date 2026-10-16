/* =====================================================================
   CUSTOMER RULES  —  how the app works things out about a customer:
   sold or not, active or not, next follow-up, journey progress.
   ===================================================================== */

// All customers (skips daily-stats records).
function allCustomers() {
  return Object.values(records).filter(r => !r.kind);
}

function isClosed(c) { return CLOSED_STAGES.includes(c.stage); }
function isSold(c)   { return SOLD_STAGES.includes(c.stage); }


/* ---------- Tasks ---------- */

function openTasks(c) {
  return c.tasks.filter(t => !t.done);
}

// The soonest unfinished task, or undefined.
function nextTask(c) {
  return openTasks(c).sort((a, b) => a.due < b.due ? -1 : 1)[0];
}

// Every unfinished task across all customers, soonest first. Each task carries its customer.
function allOpenTasks() {
  const list = [];
  allCustomers().forEach(c => openTasks(c).forEach(t => list.push({ ...t, customer: c })));
  return list.sort((a, b) => a.due < b.due ? -1 : 1);
}


/* ---------- Journey ---------- */

// The phases/steps that apply to this customer (Supply only hides install steps, etc.).
function journeyFor(c) {
  const hidden = [
    ...(SKIP_STEPS_FOR_SERVICE[c.service] || []),
    ...(SKIP_STEPS_FOR_ROOM[c.room] || []),
  ];
  return JOURNEY
    .map(p => ({ phase: p.phase, steps: p.steps.filter(s => !hidden.includes(s)) }))
    .filter(p => p.steps.length > 0);
}

// { done: 6, total: 15, next: "Deposit" }
function journeyProgress(c) {
  const steps = journeyFor(c).flatMap(p => p.steps);
  return {
    done:  steps.filter(s => c.journey[s]).length,
    total: steps.length,
    next:  steps.find(s => !c.journey[s]),
  };
}
