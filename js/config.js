/* =====================================================================
   SETTINGS  —  the file you'll edit most.
   Change the lists below and the whole app updates. You don't need to
   touch any other file to rename stages, add journey steps, add note
   headings, etc.

   Rules for editing lists:
     • Every item goes in "quotes" and is followed by a comma.
     • Keep the square brackets [ ] and curly brackets { } balanced.
   ===================================================================== */


/* ---------- General stages ----------
   The stage pill shown on every customer.
   colour = a hue from 0–360 (0 red, 35 orange, 120 green, 210 blue, 260 purple). */
const STAGES = [
  { name: "Lead",     colour: 210 },
  { name: "Quote",    colour: 260 },
  { name: "Sold",     colour: 150 },
  { name: "Delivery", colour: 35  },
  { name: "Install",  colour: 175 },
  { name: "Lost",     colour: 0   },
  { name: "Complete", colour: 95  },
];

// Which stages count as "Sold" on the Customers list.
const SOLD_STAGES = ["Sold", "Delivery", "Install", "Complete"];

// Which stages mean the customer is finished (no follow-up needed).
const CLOSED_STAGES = ["Lost", "Complete"];

// The stage that means a customer was lost (used by swipe-left and the reviews).
const LOST_STAGE = "Lost";

// The stage a customer moves to when you swipe left on them in the Customers list.
const SWIPE_LEFT_STAGE = LOST_STAGE;

// The stage a customer moves to when they buy (e.g. at their design appointment).
const SOLD_STAGE = "Sold";

// The stage for customers who have a quote and haven't decided yet.
const QUOTE_STAGE = "Quote";


/* ---------- Picked when you create a customer ---------- */
const ROOMS    = ["Kitchen", "Bedroom", "Other"];
const SERVICES = ["Install", "Supply only"];


/* ---------- Customer journey ----------
   Each phase has a list of steps. Ticked steps are dated automatically. */
const JOURNEY = [
  { phase: "Design",     steps: ["Qualified", "Price Advisor", "Home Survey", "Initial Design appointment", "Design", "Quoted"] },
  { phase: "Sale",       steps: ["Deposit", "Charter", "Pre-Fit"] },
  { phase: "Fulfilment", steps: ["Finalised Payment", "Contracted", "Compliance", "Delivery", "Installation"] },
  { phase: "After-sale", steps: ["Calls"] },
];

// Steps to HIDE for a service type (this is what makes "Supply only" a different journey).
const SKIP_STEPS_FOR_SERVICE = {
  "Supply only": ["Pre-Fit", "Installation"],
};

// Steps to HIDE for a room type. Example:  "Bedroom": ["Compliance"],
const SKIP_STEPS_FOR_ROOM = {
};

// Ticking one of these steps moves the customer forward to that stage automatically.
const STEP_MOVES_STAGE = {
  "Quoted":       "Quote",
  "Deposit":      "Sold",
  "Delivery":     "Delivery",
  "Installation": "Install",
};


/* ---------- Account notes ----------
   [ "saved-key", "Heading shown on screen" ]
   ⚠ Don't change a saved-key once you have data, or that note will look empty.
     Changing the heading text is always safe. */
const ACCOUNT_NOTES = [
  ["emo",   "🔹 Emotional Driver"],
  ["why",   "🔹 Why Wren"],
  ["oq",    "🔹 Other Quotes"],
  ["time",  "🔹 Timescale"],
  ["style", "🔹 Range / Style"],
  ["bw",    "🔹 Building Works"],
  ["inst",  "🔹 Installation"],
  ["fin",   "🔹 Finance (Cash / IFC)"],
  ["inv",   "🔹 Investment"],
  ["hm",    "🔹 Home Measure"],
  ["fu",    "🔸 Follow-up Appointment"],
];

const CURRENT_KITCHEN_NOTES = [
  ["app", "🔹 Appliances"],
  ["ws",  "🔸 Wren Supplied"],
  ["ex",  "🔷 Extra"],
];


/* ---------- Customer details ----------
   [ "saved-key", "Label", type ]   type: "text" | "number" | "date" | a list (dropdown) */
const DETAIL_FIELDS = [
  ["name",    "Name",            "text"],
  ["phone",   "Phone",           "text"],
  ["email",   "Email",           "text"],
  ["address", "Address / postcode", "text"],
  ["room",    "Room",            ROOMS],
  ["service", "Service",         SERVICES],
  ["value",   "Quote value (£)", "number"],
  ["source",  "Lead source",     "text"],
];


/* ---------- Shortcuts on the customer page ---------- */
const QUICK_TASKS = ["Follow-up call", "Send quote", "Book home survey", "Book design appointment", "Chase decision", "Confirm fitting date"];

// [ "Button label", days from today ]
const QUICK_DATES = [["Today", 0], ["Tomorrow", 1], ["3 days", 3], ["1 week", 7], ["2 weeks", 14]];

// Task added automatically to every new customer (when no appointment is booked).
const FIRST_TASK = "Make first contact";

// Quick tasks that tick a journey step when you complete them.
// You can also pick a step for any task when you add it.
const TASK_STEPS = {
  "Send quote": "Quoted",
};

// Ticking one of these journey steps adds a task automatically:
// "Step": ["Task", days from today]
const AUTO_TASKS = {
  "Quoted": ["Chase decision", 3],
};


/* ---------- Design appointments ----------
   Booked in the New customer pop-up. The appointment shows on the Today page
   on its date; ticking it asks how it went. */
const APPOINTMENT_TASK = "Design appointment";

// After the appointment (sold or not), the journey is ticked up to this step.
const APPOINTMENT_TICKS_STEP = "Quoted";

// Suggested follow-up when it didn't sell.
const DEFAULT_FOLLOW_UP = "Chase decision";
