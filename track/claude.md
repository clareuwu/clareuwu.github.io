# Habit Tracker PWA - Project Documentation

## Project Context
This is a Progressive Web App for tracking habits, medication dosages, and custom events. It's part of Clare's GitHub Pages site (`clareuwu.github.io`) and will be hosted at `/track`.

## User Requirements Summary
- **Purpose**: Rapid logging of events/behaviors with datetime and customizable fields (dosage, quantity, duration, etc.)
- **Primary Use Case**: Medication tracking - need to log dosages quickly and easily on mobile
- **UI Style**: iPhone calendar app aesthetic - monthly calendar, day selection, minimal styling
- **Mobile-First**: iOS-style wheel pickers for date/time/units
- **Privacy**: Local-only data storage, manual/auto export for backups
- **No Recurring Events**: Manual entry only (user preference)

## Technology Decisions

### Stack
- **Frontend**: Alpine.js (already loaded on parent site) + Vanilla HTML/CSS
- **Storage**: IndexedDB (complex queries, better performance than localStorage)
- **PWA**: Service Worker for offline capability
- **Pickers**: Custom CSS scroll-snap wheel pickers (iOS-style UX)
- **No Build Tools**: ES6 modules, direct browser loading

### Why These Choices?
- **Alpine.js**: Already on site, declarative, perfect for reactive UI without build tools
- **IndexedDB**: Better than localStorage for date-based queries and complex data structures
- **Custom Pickers**: User specifically wants iOS multi-wheel picker experience for rapid mobile logging
- **No Frameworks**: Keep it lightweight, inherit styling from parent site

## Data Model

### EventType (schema definition for different trackable things)
```javascript
{
  id: "uuid",
  name: "Medication A",
  color: "#FF5733",  // User-selected, only color in UI
  fields: [
    {
      id: "uuid",
      name: "dosage",
      type: "numeric" | "category" | "text",
      unit: "mg",  // for numeric: mg, g, kg, ml, L, oz, mins, hrs, days, times, pills
      options: ["opt1", "opt2"],  // for category
      required: true | false
    }
  ],
  createdAt: "ISO-8601",
  updatedAt: "ISO-8601"
}
```

### Event (actual logged instance)
```javascript
{
  id: "uuid",
  typeId: "event-type-uuid",
  datetime: "ISO-8601 UTC",  // Store UTC, display local
  fieldValues: {
    "field-uuid": value  // Type matches field.type
  },
  createdAt: "ISO-8601",
  updatedAt: "ISO-8601"
}
```

### IndexedDB Structure
- Database: `habitTracker` v1
- Object Stores:
  - `eventTypes`: keyPath "id", indexes on "name", "createdAt"
  - `events`: keyPath "id", indexes on "typeId", "datetime", compound ["typeId", "datetime"]
  - `settings`: keyPath "key" (for app preferences)

## File Structure
```
/track/
├── index.html              # Main app + ALL UI markup as native Alpine templates
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker (bump CACHE_NAME on asset changes)
├── claude.md              # This file - project context
├── css/
│   └── track.css          # Minimal styles, inherit from /s/main.css
├── js/
│   ├── app.js             # THE single Alpine component (appData): state + getters + methods
│   ├── db.js              # IndexedDB wrapper
│   └── utils/             # (currently unused by app.js — helpers are inlined in app.js)
│       ├── date.js        # Date helpers
│       └── storage.js     # Export/import, auto-backup
└── icons/
    ├── favicon.png
    ├── icon-192.png
    └── icon-512.png
```

### ⚠️ Architecture note (read before adding UI)
The UI is **one** Alpine component, `Alpine.data('appData', ...)` in `js/app.js`,
rendered by **native Alpine directives** written directly in `index.html`
(`x-for`, `x-if`, `x-model`, `@click`, `x-text`, `x-show`).

Do **NOT** go back to the old pattern of building HTML strings in JS and
injecting them with `x-html`. Alpine does not process directives (`@click`,
`x-for`, `x-model`, …) inside `x-html` content, so that approach produces a
page where nothing is interactive. The original `js/components/*.js`
string-generators were deleted for exactly this reason.

Rules of thumb:
- New display data → add a **getter** on `appData` that returns plain
  data/arrays, and iterate it with `<template x-for>` in `index.html`.
- New action → add a **method** on `appData` and bind it with `@click`.
- Register `appData` synchronously inside the `alpine:init` listener. Async
  setup (e.g. `db.init()`) goes **inside** the component's own `init()`, never
  before `Alpine.data(...)` is called.
- Store datetimes as ISO-8601 UTC; use the local-time helpers in `app.js`
  (`toLocalInputValue` / `fromLocalInputValue`) for `<input type="datetime-local">`.

## Component Responsibilities

All of the below live on the single `appData` component in `js/app.js`.
"UI" = the corresponding `<template>` markup in `index.html`.

### Calendar
- Getter `calendarDays` → 42-cell array `{ date, day, isOtherMonth, isToday, isSelected, dots[] }`
- Getters `eventsByDay` (Map dayKey→events) and `typeColorMap` feed the dots
- Methods `prevMonth` / `nextMonth` / `goToToday` / `selectDate(date)`
- UI: `x-for` over `calendarDays`, `:class` toggles for today/selected/other-month

### Event List
- Getter `selectedDayEvents` → sorted (newest first) array enriched with
  `{ typeName, color, time, fields:[{name,value}], raw }`
- Methods `editEvent(raw)` / `deleteEvent(id)`
- UI: `x-for` over `selectedDayEvents`; empty state via `x-if`

### Event Form (modal)
- State `eventForm { mode, id, typeId, datetime, fieldValues }`; getter `eventFormType`
- Methods `openEventForm` / `editEvent` / `onEventTypeChange` / `saveEvent` / `closeEventForm`
- Dynamic fields rendered by `x-for` over `eventFormType.fields`, `x-if` per field type
- Uses HTML5 `<input type="datetime-local">` (custom wheel picker is still future work)

### Type Form (modal)
- State `typeForm { editingId, name, color, fields[] }`
- Methods `openTypeManager` / `addTypeField` / `removeTypeField` / `editType` /
  `saveType` / `deleteType` / `resetTypeForm`; getter helper `fieldsSummary(type)`
- Field builder rendered by `x-for` over `typeForm.fields`

### Pickers (future — pickers.js, not yet built)
- **DateTimePicker**: 5 wheels (Month, Day, Year, Hour, Minute)
- **NumericPicker**: 2 wheels (Number, Unit)
- **CategoryPicker**: 1 wheel (Options)
- **ColorPicker**: Hex input with preview
- CSS scroll-snap for smooth iOS-like scrolling
- Touch-optimized, large targets

## Implementation Sequence

**Phase 1: Foundation** (Day 1)
- HTML structure, manifest.json, db.js, app.js, basic CSS

**Phase 2: Calendar & List** (Day 2)
- calendar.js, event-list.js, integrate in UI

**Phase 3: Event Types** (Day 3)
- type-form.js, type management UI

**Phase 4: Event Creation** (Day 4)
- event-form.js with simple inputs, wire up add/edit

**Phase 5: Custom Pickers** (Days 5-6)
- pickers.js with CSS scroll-snap, replace simple inputs

**Phase 6: PWA & Export** (Day 7)
- storage.js (export/import/auto-backup), sw.js, settings UI

**Phase 7: Polish** (Day 8)
- Mobile optimizations, error handling, testing

## Key Technical Patterns

### Alpine.js single component (js/app.js)
```javascript
document.addEventListener('alpine:init', () => {
  // Registered SYNCHRONOUSLY — no await before this call, or x-data
  // initializes against an undefined component and nothing renders.
  Alpine.data('appData', () => ({
    selectedDate: new Date(),
    eventTypes: [],
    events: [],
    async init() { await db.init(); await this.loadData(); }, // async work lives here
    get calendarDays() { /* returns plain data; iterate with x-for in HTML */ },
    saveEvent() { /* db write, then this.loadData() — getters recompute reactively */ }
  }));
});
```
Reactivity: mutating component state (reassigning `currentMonth`/`selectedDate`,
reloading `events`) makes the getters recompute and the DOM update. There is no
manual `render()` — do not reintroduce one.

### IndexedDB Wrapper (db.js)
```javascript
class DB {
  async init() { /* open db, create stores */ }
  async getEventsByDay(date) { /* query by date range */ }
  async saveEvent(event) { /* upsert */ }
  // ... CRUD methods
}
export const db = new DB();
```

### Date Handling
- Store: ISO-8601 UTC strings
- Display: Local timezone
- Utils: Convert, format, get month boundaries

### Performance
- Query only visible month for calendar
- Use IndexedDB indexes for fast date queries
- Debounce picker scrolls
- Cache event counts per day

## Initial Unit Types
Per user preference: mg, g, kg, ml, L, oz, mins, hrs, days, times, pills

## Testing Checklist
- ✅ Create event type with multiple field types
- ✅ Add event with all field types filled
- ✅ Navigate calendar forward/back multiple months
- ✅ Edit event and verify changes saved
- ✅ Delete event with confirmation
- ✅ Export data to JSON
- ✅ Import data from JSON
- ✅ Offline mode (airplane mode)
- ✅ PWA install (Add to Home Screen)
- ✅ iOS Safari testing
- ✅ Lighthouse PWA score 100/100

## Parent Site Integration
- Inherits color variables from `/s/main.css`
- Uses Alpine.js loaded in parent site
- Matches minimal aesthetic (no frameworks, basic styling)
- Lives in `/track` subdirectory of GitHub Pages site

## Future Features (Post-MVP)
- Data visualization (charts)
- Search/filter
- Recurring events (if user wants later)
- Cloud sync
- Dark mode
- Advanced fields (location, photos)

## Commands to Run (for testing)
```bash
# Navigate to track directory
cd /Users/clare/projects/clareuwu.github.io/track

# Serve locally for testing (from parent dir)
cd .. && python3 -m http.server 8000
# Then visit: http://localhost:8000/track/

# Test PWA in Chrome DevTools:
# Application tab → Manifest, Service Workers, Storage

# Deploy: Just commit and push (GitHub Pages auto-deploys)
```

## Session Resume Checklist
When returning to this project:
1. Read this file (claude.md)
2. Check implementation plan at `/Users/clare/.claude/plans/peppy-dazzling-cookie.md`
3. Review current phase from plan (which files exist vs needed)
4. Check git status for uncommitted work
5. Run local server to test current state
6. Continue from next step in implementation sequence
