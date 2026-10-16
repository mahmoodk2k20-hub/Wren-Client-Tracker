# Client Hub — how to edit

## Where everything lives

```
client-hub/
├── index.html                  Page layout: top bar, page buttons, loads everything else
├── css/
│   ├── theme.css               COLOURS (light + dark mode)
│   └── app.css                 Sizes, spacing, shapes (sections labelled inside)
└── js/
    ├── config.js               ★ SETTINGS — stages, journey steps, notes, quick tasks
    ├── helpers.js              Dates, money formatting, safe text
    ├── storage.js              Saving on this device + syncing to your account
    ├── customer-rules.js       Works out sold / active / next follow-up / journey progress
    ├── app.js                  Starts the app and switches pages
    └── pages/
        ├── today.js            Today page (overdue, today, this week, next week…)
        ├── customers.js        Customers list
        ├── tracking.js         Daily stats + weekly overview
        └── customer-page.js    Side panel for one customer + "New customer" pop-up
```

## Common changes

| I want to… | Edit |
|---|---|
| Rename / add a stage, change its colour | `js/config.js` → `STAGES` (also check `SOLD_STAGES`, `CLOSED_STAGES`) |
| Add or rename a journey step | `js/config.js` → `JOURNEY` |
| Hide steps for Supply only / Bedroom etc. | `js/config.js` → `SKIP_STEPS_FOR_SERVICE` / `SKIP_STEPS_FOR_ROOM` |
| Make ticking a step change the stage | `js/config.js` → `STEP_MOVES_STAGE` |
| Add an account-note heading | `js/config.js` → `ACCOUNT_NOTES` (give it a new short key) |
| Add a customer detail field | `js/config.js` → `DETAIL_FIELDS` |
| Change the quick task / date buttons | `js/config.js` → `QUICK_TASKS`, `QUICK_DATES` |
| Change colours | `css/theme.css` |
| Change what's on the Today page | `js/pages/today.js` → `renderToday()` |
| Change the columns on the Customers list | `js/pages/customers.js` → `customerRow()` (+ header in `renderCustomerList()`) |
| Reorder sections on a customer's panel | `js/pages/customer-page.js` → `drawCustomerPage()` |
| Add a tracking stat | `js/pages/tracking.js` → `dayRecord()`, `dayTotals()`, `renderTracking()` |
| Add a whole new page | new file in `js/pages/`, add it to `PAGES` in `js/app.js`, a button in `index.html`, and a `<script>` line in `index.html` |

## Things to be careful of

- **Don't rename the short keys** in `ACCOUNT_NOTES` or `DETAIL_FIELDS` once you have data — the text label is safe to change, the key is where the data is stored.
- **Renaming a stage** (e.g. "Lead" → "New lead"): customers already on the old name will show as the first stage. Easiest to rename before you add customers, or move them over by hand.
- **Removing a journey step** just hides it; the tick is kept in case you add it back.
- Every list item needs quotes and a comma: `"Deposit",`. If the page goes blank after an edit, it's almost always a missing comma, quote or bracket in the last thing you changed.

## Updating the live page

Edit the files, then ask Claude: *"update my Client Hub artifact with these files"* (or attach the changed files). Your customers and stats are stored separately from the code, so updating the code never wipes them.
