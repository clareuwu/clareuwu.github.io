# Habit Tracker — Linear Code Walkthrough

## Overview of the pieces

The whole app is essentially **four files doing real work**:

| File | Role |
|------|------|
| `index.html` | All markup + all UI logic as native Alpine directives |
| `js/app.js` | The single Alpine component `appData` — state, getters, methods |
| `js/db.js` | Thin Promise wrapper around IndexedDB (the `db` singleton) |
| `sw.js` | Service worker for offline caching |

Two files — `js/utils/date.js` and `js/utils/storage.js` — exist but are **dead code**. Nothing imports them. `app.js` inlines its own copies of those helpers (flagged at the end). Keep that in mind so you don't waste time studying them thinking they're live.

---

## Part 1 — Page load and bootstrap

### 1.1 The `<head>` (`index.html:3-21`)

```html
<meta name="viewport" ... maximum-scale=1.0, user-scalable=no>
<meta name="apple-mobile-web-app-capable" content="yes">
<link rel="manifest" href="/track/manifest.json">
<script type="module" src="/track/js/app.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
```

Two things to notice about script ordering, because it's the crux of how Alpine boots:

- `app.js` is a **`type="module"`** — modules are *always* deferred, and they execute in module order after the HTML is parsed.
- Alpine is loaded with plain **`defer`**.

Neither runs immediately. `app.js` doesn't *do* anything at top level except register an `alpine:init` listener (more below). Alpine, once it loads, fires `alpine:init`, then scans the DOM for `x-data`. Because `app.js`'s listener is attached before Alpine initializes, the component is guaranteed to be registered by the time Alpine looks for it. This ordering is the entire reason the architecture note in `CLAUDE.md` insists you register **synchronously** inside `alpine:init`.

The viewport lock (`maximum-scale=1.0, user-scalable=no`) plus the apple-mobile meta tags are the "make it feel like a native iPhone app" touches.

### 1.2 Service worker registration (`index.html:283-292`)

At the very bottom of the body, an inline (non-module) script registers `sw.js` on `window.load`. This is deliberately *outside* Alpine — it has nothing to do with the UI, it just kicks off offline caching. We'll return to what the SW actually does in Part 9.

### 1.3 The root component mount (`index.html:23`)

```html
<div id="app" x-data="appData">
```

`x-data="appData"` tells Alpine: "instantiate the component registered under the name `appData` and make its state the reactive scope for everything inside this div." Everything else in the page is children of this div, so the whole UI shares one component instance.

---

## Part 2 — The component definition (`app.js`)

### 2.1 Inline helpers (`app.js:11-51`)

Before the component, a set of module-scoped pure functions:

- `pad2` — zero-pads to 2 digits.
- `dayKey(date)` → `"YYYY-MM-DD"` in **local** time (`app.js:15`). This is the canonical key used everywhere to bucket events into calendar days. Critically it's built from `getFullYear/getMonth/getDate` (local), *not* from the ISO string, so events are grouped by the user's local day.
- `isSameDay(a,b)` — local Y/M/D equality.
- `toLocalInputValue(date)` (`app.js:26`) → `"YYYY-MM-DDTHH:mm"`, the exact format `<input type="datetime-local">` wants, in local time.
- `fromLocalInputValue(str)` (`app.js:32`) → `new Date(str)`; the browser parses that bare format as **local** time. This is the inverse of the above.
- `formatTime(date)` → 12-hour `"h:mm AM/PM"`.
- `formatFieldValue(field, value)` → for numeric fields appends the unit (`"5 mg"`), otherwise stringifies.

The **date contract** running through the app: store ISO-8601 UTC strings in the DB; convert to/from local only at the display and input edges. `toLocalInputValue`/`fromLocalInputValue` are that boundary.

`UNITS` (`app.js:51`) is the fixed unit list from the spec (`mg, g, kg, …, pills`).

### 2.2 Registration (`app.js:53-57`)

```js
document.addEventListener('alpine:init', () => {
  window.TRACKER_UNITS = UNITS;
  Alpine.data('appData', () => ({ ... }));
});
```

`Alpine.data('appData', factory)` registers the factory. Alpine calls the factory once per `x-data="appData"` — here, once. (`window.TRACKER_UNITS` is set but never read by the template, which uses the component's own `units` property instead — minor vestigial line.)

### 2.3 Initial state (`app.js:58-87`)

```js
ready: false,
currentMonth: new Date(),   // which month the grid shows
selectedDate: new Date(),   // which day the event list shows
eventTypes: [],             // all EventType schemas
events: [],                 // ALL events (loaded in full)
showEventForm / showTypeManager / showSettings: false,  // modal visibility
eventForm: { mode, id, typeId, datetime, fieldValues },
typeForm: { editingId, name, color, fields },
units: UNITS,
```

Design decision worth calling out: **`events` holds every event in the database**, loaded once. There's no per-month querying despite `db.js` having range-query methods. For a personal tracker this is fine and makes all the getters trivial (pure in-memory transforms). It's the main scalability trade-off.

`currentMonth` and `selectedDate` start as *the same* `new Date()` but are independent — navigating months doesn't move the selected day, and vice versa.

---

## Part 3 — Startup sequence (`init` → `loadData`)

### 3.1 `init()` (`app.js:90-100`)

Alpine automatically calls a component's `init()` after creating it. This is where the **async** work lives (per the architecture rule — async must not happen before `Alpine.data`):

```js
await db.init();      // open IndexedDB
await this.loadData(); // pull everything into memory
this.ready = true;
```

On DB failure it alerts and bails. `ready` is set but, notably, **nothing in the template gates on `ready`** — it's currently unused. Not harmful, just latent.

### 3.2 `db.init()` (`db.js:17-58`)

Opens `habitTracker` v1. IndexedDB's `onupgradeneeded` fires only on first open (or version bump) and is where stores/indexes are created:

- `eventTypes` — keyPath `id`; indexes on `name`, `createdAt`.
- `events` — keyPath `id`; indexes on `typeId`, `datetime`, and a **compound** `typeId_datetime`.
- `settings` — keyPath `key`.

Every method in `db.js` follows the identical pattern: open a transaction, get the store, issue a request, resolve/reject in the `onsuccess`/`onerror` handlers. That's the entire abstraction — it turns IndexedDB's event API into promises.

### 3.3 `loadData()` (`app.js:102-109`)

```js
this.eventTypes = await db.getAllEventTypes();  // store.getAll()
this.events     = await db.getAllEvents();       // store.getAll()
```

Two `getAll()` calls fill the in-memory arrays. **Reassigning these arrays is what drives every re-render** — Alpine's reactivity sees the assignment, and every getter that reads `events`/`eventTypes` recomputes. This is the app's core loop: *mutate state → getters recompute → DOM updates*. There is deliberately no manual `render()`.

---

## Part 4 — The calendar (render path)

Now the reactive getters that turn `events` + `currentMonth` + `selectedDate` into what you see.

### 4.1 Header labels (`app.js:112-124`)

- `currentMonthLabel` → `"July 2026"` (drives `<h2>` at `index.html:36`).
- `selectedDateLabel` → `"Saturday, July 18, 2026"` (drives the event-list `<h3>`).
- `weekdays` → `['Sun'…'Sat']`, rendered as the grid's column headers (`index.html:42-44`).

### 4.2 Bucketing events by day (`app.js:127-135`)

```js
get eventsByDay() {
  const map = new Map();
  this.events.forEach(event => {
    const key = dayKey(new Date(event.datetime)); // UTC string → local day key
    map.get(key)?.push(event) ?? map.set(key, [event]);
  });
  return map;
}
```

A `Map` from `"YYYY-MM-DD"` → array of events on that day. This is computed once and reused by both the calendar dots and the day list. Because getters are re-evaluated on access, any change to `events` naturally rebuilds it.

### 4.3 Type → color lookup (`app.js:137-141`)

`typeColorMap` — `Map<typeId, color>`, so the calendar can color dots without repeatedly searching `eventTypes`.

### 4.4 Building the 42-cell grid (`app.js:143-183`)

This is the meatiest getter. Given `currentMonth`:

1. `firstDayOfWeek` = weekday of the 1st (`0`=Sun).
2. `daysInMonth` = day 0 of *next* month (a classic JS trick — `new Date(y, m+1, 0)`).
3. `prevMonthLastDay` = day 0 of *this* month.
4. A `build(date, isOtherMonth)` closure produces each cell:
   ```js
   {
     key: date.toISOString(),  // Alpine :key
     date, day: date.getDate(),
     isOtherMonth, isToday, isSelected,
     dots: [...unique typeIds on that day].map(id => color)
   }
   ```
   Note `dots` is one dot **per distinct event type** on the day (deduped via `new Set`), colored by type — not one dot per event.
5. Three loops fill exactly **42 cells** (6 weeks, fixed height): the previous-month tail before the 1st, the actual month, and enough next-month days to reach 42.

### 4.5 Grid markup (`index.html:45-56`)

```html
<template x-for="d in calendarDays" :key="d.key">
  <div class="calendar-day"
       :class="{ 'other-month': d.isOtherMonth, 'today': d.isToday, 'selected': d.isSelected }"
       @click="selectDate(d.date)">
    <div class="day-number" x-text="d.day"></div>
    <div class="day-indicators" x-show="d.dots.length">
      <template x-for="(color, i) in d.dots" :key="i">
        <span class="event-dot" :style="`background-color: ${color};`"></span>
```

`x-for` iterates the getter; `:class` toggles the state styles (`.today` = bold, `.selected` = grey bg, `.other-month` = 30% opacity — all in `track.css:144-175`); clicking calls `selectDate`. The nested `x-for` paints the dots.

### 4.6 Navigation (`app.js:217-233`)

- `prevMonth`/`nextMonth` — reassign `currentMonth` to the 1st of the adjacent month. Reassignment → `calendarDays` recomputes → grid re-renders.
- `goToToday` — snaps `currentMonth` to this month *and* `selectedDate` to today.
- `selectDate(date)` — sets `selectedDate` (cloned), which flips which cell is `.selected` and repopulates the day list below.

---

## Part 5 — The event list for the selected day

### 5.1 `selectedDayEvents` getter (`app.js:186-214`)

Pulls the selected day's bucket from `eventsByDay`, then for each event:

- Looks up its `EventType` (via a local `typeMap`). **If the type is missing, the event is dropped** (`return null` → filtered out) — a safety net for orphaned events.
- Sorts **newest-first** (`app.js:193`).
- Maps each schema field to `{name, value}`, formatting via `formatFieldValue`, and **skips empty values** so blank optional fields don't show.
- Returns a view-model: `{ id, raw, typeName, color, time, fields }`. `raw` is the untouched DB record, kept so Edit can repopulate the form.

### 5.2 List markup (`index.html:61-92`)

- `<template x-if="selectedDayEvents.length === 0">` → "No events for this day" empty state.
- `x-for` renders each event: a colored left bar (`ev.color`), type name, `ev.time`, the `fields` list, and Edit/Delete buttons wired to `editEvent(ev.raw)` / `deleteEvent(ev.id)`.
- The header's **+ Add Event** button calls `openEventForm` (`index.html:64`).

---

## Part 6 — Event form (create / edit)

### 6.1 Opening for a new event (`app.js:240-254`)

`openEventForm` seeds `eventForm` with the **selected day at the current clock time** (nice UX — you picked the day on the calendar, it assumes "now" for the time), formatted through `toLocalInputValue`, then shows the modal. `mode: 'add'`, `id: null`.

### 6.2 Opening for edit (`app.js:256-265`)

`editEvent(raw)` copies the event's `typeId`, converts its stored UTC `datetime` back to local input format, and **clones `fieldValues`** (`{...}`) so edits don't mutate the in-memory record before saving. `mode: 'edit'`, `id` set.

### 6.3 The dynamic form body (`index.html:96-164`)

The modal is an overlay with `@click.self="closeEventForm"` (click the backdrop, not the content, to close). Inside:

- **Type `<select>`** bound to `eventForm.typeId`, with `@change="onEventTypeChange"`.
- **`datetime-local` input** bound to `eventForm.datetime`.
- `<template x-if="eventFormType">` — only when a type is chosen — loops `eventFormType.fields` and renders a **different control per field type**:
  - `numeric` → `<input type="number" step="any">` + unit label,
  - `category` → `<select>` of the field's `options`,
  - `text` → `<textarea>`.
  Each is `x-model`-bound to `eventForm.fieldValues[field.id]`.
- If no type is picked yet, a "Please select an event type" prompt shows instead.

`eventFormType` (`app.js:236-238`) is a getter that finds the selected type object — it's what makes the field section reactive to the dropdown.

### 6.4 Switching type resets fields (`app.js:267-275`)

`onEventTypeChange` wipes `fieldValues` and re-seeds one empty entry per field of the newly chosen type, so stale values from a previous type can't leak in.

### 6.5 Saving (`app.js:277-314`)

`saveEvent`:
1. Validates a type and datetime are set.
2. Loops the type's fields and enforces **`required`** ones.
3. Builds the record: `datetime` converted **local → UTC** via `fromLocalInputValue(...).toISOString()`, `fieldValues` cloned.
4. On edit, preserves the original `createdAt` (`app.js:301-304`).
5. `await db.saveEvent(eventData)` → `await this.loadData()` → `closeEventForm()`.

That `loadData()` after every write is the pattern throughout: re-pull everything, let getters recompute. Simple and always consistent.

### 6.6 `db.saveEvent` (`db.js:217-235`)

Upsert via `store.put`. Fills `id` (generates a UUID v4 if absent — `generateUUID` at `db.js:63`), `datetime`, `updatedAt`, and `createdAt` (only if not already present). `put` means the same method handles both create and edit.

### 6.7 Deleting (`app.js:320-329`)

`deleteEvent` → `confirm()` → `db.deleteEvent(id)` → `loadData()`.

---

## Part 7 — Event Type manager

This modal both **lists** existing types and **builds/edits** them, sharing one `typeForm`.

### 7.1 Open / reset (`app.js:332-356`)

`openTypeManager` calls `resetTypeForm` (clears to a blank type, default color `#3b82f6`) then shows the modal.

### 7.2 The field builder (`index.html:208-245`, methods `app.js:358-372`)

- `addTypeField` pushes a new field row with a generated `id`, defaulting to `numeric` / `mg` / required.
- Each row (`x-for` over `typeForm.fields`) has: name input, type `<select>`, and **conditional** extra controls:
  - numeric → unit `<select>` (from `units`),
  - category → a comma-separated **`optionsText`** input.
- `removeTypeField(index)` splices a row out.

Note the two-representation trick for category options: the form edits `optionsText` (a string), and save-time parses it into the `options` array. `editType` does the reverse (`options.join(', ')`).

### 7.3 Editing an existing type (`app.js:374-389`)

`editType(type)` loads it into `typeForm` with `editingId` set, mapping each stored field back into the editable shape (including rebuilding `optionsText`).

### 7.4 Saving a type (`app.js:391-435`)

`saveType`:
1. Requires a name and ≥1 field.
2. Every field needs a name; category fields need ≥1 parsed option.
3. Normalizes each field: numeric keeps `unit` (drops `options`), category parses `optionsText`→`options` (drops `unit`), text keeps neither.
4. Preserves `createdAt` on edit.
5. `db.saveEventType` (upsert, `db.js:104`) → `loadData` → `resetTypeForm`.

The list at the top (`index.html:177-193`) re-renders with the new/updated type; `fieldsSummary(type)` (`app.js:341-347`) produces the grey one-line `"dosage (mg), mood [good, bad]"` summary under each.

### 7.5 Deleting a type — cascade (`app.js:437-453`)

`deleteType` first finds events of that type. If any exist, it warns with the count ("This type has N event(s). Delete anyway?"). On confirm it **deletes all those events**, then the type itself, then reloads. This cascade is why `selectedDayEvents` also defensively drops type-less events — belt and suspenders against orphans.

---

## Part 8 — Settings: export / import

### 8.1 Export (`app.js:464-478`)

`exportData` calls `db.exportAll()` (`db.js:304-318` — pulls types, events, and settings via `Promise.all`, wraps them with `version` and `exportDate`), serializes to pretty JSON, and triggers a download via a temporary `<a download>` blob URL named `habit-tracker-backup-YYYY-MM-DD.json`.

### 8.2 Import (`app.js:480-510`)

The Settings modal has a hidden `<input type="file" x-ref="importFile">`. `triggerImport` (`app.js:480`) programmatically clicks it via `$refs`. On file selection, `importData`:
1. Confirms ("**This will replace all existing data**").
2. Reads + `JSON.parse`es the file.
3. `db.clearAll()` (wipes all three stores, `db.js:286`).
4. Re-saves each `eventType` and `event` through the normal `db` methods.
5. `loadData()`, success alert, close.
6. `finally` resets the input's value so the same file can be re-selected later.

This is a **replace**, not a merge. (The unused `storage.js` has a merge-capable version with validation, but the app doesn't use it.)

---

## Part 9 — Offline / PWA layer

### 9.1 Manifest (`manifest.json`)

Standalone display, scoped to `/track/`, portrait, 192/512 maskable icons. This plus the SW is what makes "Add to Home Screen" produce an app-like launch.

### 9.2 Service worker lifecycle (`sw.js`)

- **`install`** (`sw.js:19`): opens cache `habit-tracker-v2`, `addAll`s the core assets (HTML, CSS, `app.js`, `db.js`, parent `/s/main.css`, and the Alpine CDN bundle), then `skipWaiting()` to activate right away.
- **`activate`** (`sw.js:39`): deletes any cache whose name ≠ current `CACHE_NAME`, then `clients.claim()`. This is the mechanism behind the `CLAUDE.md` instruction to **bump `CACHE_NAME` when assets change** — the rename is what evicts stale files.
- **`fetch`** (`sw.js:62`): **cache-first** — serve from cache if present, else fetch from network and, for successful GET `http(s)` responses, clone into cache. On network failure it tries `/track/offline.html` (which doesn't exist in the repo) and finally falls back to a plain-text 503.
- **`message`** (`sw.js:115`): handles `SKIP_WAITING` and `CLEAR_CACHE` commands — though nothing in the app currently posts these.

Cache-first means **code changes won't appear until `CACHE_NAME` is bumped**; that's the single most important operational gotcha here.

---

## Part 10 — Styling notes (`track.css`)

Minimal, deliberately un-frameworked. Highlights that affect behavior/feel:
- `[x-cloak]{display:none!important}` (`css:441`) hides Alpine markup until it initializes, preventing a flash of raw content. It's applied to all three modal overlays (`x-cloak` in the HTML).
- 44px minimum tap targets on buttons/inputs (iOS HIG).
- Fixed 60px (50px on mobile) calendar cells, 7-col CSS grid with a 1px gap over a grey background to fake cell borders.
- Responsive `@media (max-width:600px)` restacks event items and makes modals full-bleed; `prefers-reduced-motion` kills transitions.

---

## Part 11 — Dead code & things to know before editing

1. **`js/utils/date.js` and `js/utils/storage.js` are unused.** `app.js` inlines its own `formatTime`, day-key, and export/import logic. If you edit date/export behavior, edit `app.js`, not these. (They're not even precached by the SW.)
2. **`ready` flag is set but never read** — no loading gate in the template.
3. **`window.TRACKER_UNITS`** is assigned but unused; the template reads the component's `units`.
4. **All events are loaded into memory** (`getAllEvents`); the range-query methods in `db.js` (`getEventsByDay`, `getEventsByDateRange`, `getEventsByType`) and the compound `typeId_datetime` index exist but are **never called** by the app.
5. **`offline.html`** referenced by the SW fallback doesn't exist — offline nav failures hit the 503 text path.
6. **Golden rule from `CLAUDE.md`:** never inject markup with `x-html`. All UI is native Alpine directives in `index.html`; new display data = a getter + `x-for`, new action = a method + `@click`. And bump `CACHE_NAME` in `sw.js` whenever you touch a cached asset, or your changes won't ship.

---

**The mental model in one sentence:** IndexedDB is the source of truth → `loadData()` mirrors it into two reactive arrays (`events`, `eventTypes`) → pure getters derive the calendar, day list, and form options from those arrays → every user action writes to the DB then re-runs `loadData()`, and Alpine repaints. Everything else is edge conversion (UTC↔local) and offline caching.
