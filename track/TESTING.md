# Habit Tracker - Testing Guide

## Quick Start

The app is currently running at: **http://localhost:8000/track/**

Server is running on PID 21079 (Python HTTP server on port 8000)

## Step-by-Step Testing

### 1. Create Your First Event Type
1. Open http://localhost:8000/track/
2. Click "Manage Types" button
3. Fill in the form:
   - Type Name: "Medication"
   - Color: Choose a color (e.g., blue #3b82f6)
   - Fields: Click "+ Add Field"
     - Field name: "dosage"
     - Type: "Numeric"
     - Unit: "mg"
     - Required: ✓
   - Add another field:
     - Field name: "notes"
     - Type: "Text"
     - Required: ☐
4. Click "Save Type"

### 2. Add an Event
1. Click "+ Add Event" button
2. Select "Medication" from event type dropdown
3. Pick a date and time
4. Enter dosage (e.g., 25)
5. Enter notes (optional)
6. Click "Save Event"

### 3. Test Calendar Navigation
1. Click the left/right arrows to navigate months
2. Click "Today" to return to current month
3. Click on different days to view events for that day
4. Notice colored dots on calendar days that have events

### 4. Test Event Management
1. Click "Edit" on an event
2. Change the dosage value
3. Save and verify the change
4. Click "Delete" on an event
5. Confirm deletion

### 5. Test Export/Import
1. Click "Settings" button
2. Click "Export Data (JSON)"
3. A file will download: `habit-tracker-backup-YYYY-MM-DD.json`
4. Click "Import Data"
5. Select the file you just downloaded
6. Confirm import (will replace existing data)
7. Verify all data is restored

### 6. Test Offline Mode (PWA Feature)
1. Open browser DevTools (F12)
2. Go to Network tab
3. Check "Offline" checkbox
4. Reload the page
5. Verify the app still loads and works
6. Add/edit events (they save to IndexedDB)
7. Uncheck "Offline" to go back online

### 7. Test PWA Installation (Chrome/Edge)
1. Look for install icon in address bar (or ⋮ menu → "Install")
2. Click install
3. App opens as standalone window
4. Verify it works independently of browser

## Expected Behavior

### ✅ Should Work
- Calendar displays current month
- Can navigate between months
- Can select days
- Event types can be created with multiple field types
- Events can be added, edited, deleted
- Events appear on calendar as colored dots
- Export downloads JSON file
- Import loads data from JSON
- App works offline
- Data persists across page reloads

### ⚠️ Known Limitations (To Be Improved)
- No custom PWA icons (shows default browser icons)
- DateTime input uses browser default (not iOS-optimized wheel picker yet)
- Number/select inputs are basic HTML inputs (will be replaced with custom pickers)
- No animations/transitions
- Minimal error messages

## Browser Console

Open DevTools Console (F12) to see:
- Database initialization logs
- Service worker registration
- Any errors or warnings

## Data Storage

All data is stored in IndexedDB:
- Database name: `habitTracker`
- Object stores: `eventTypes`, `events`, `settings`
- Location: Browser's IndexedDB storage
- Can be viewed in DevTools → Application → IndexedDB

## Stopping the Server

When done testing:
```bash
kill 21079
# or find and kill:
ps aux | grep "python3 -m http.server 8000" | grep -v grep | awk '{print $2}' | xargs kill
```

## Common Issues

**App doesn't load:**
- Check server is running: `lsof -i :8000`
- Check browser console for errors
- Verify you're accessing http://localhost:8000/track/ (not file://)

**Service Worker not registering:**
- Service Workers require HTTPS or localhost
- Check DevTools → Application → Service Workers

**Data not persisting:**
- IndexedDB requires user gesture for some operations
- Check browser settings allow local storage
- Private/Incognito mode may block IndexedDB

**Import not working:**
- Ensure JSON file is valid (check with JSONLint)
- File must have `eventTypes` and/or `events` arrays
- Check browser console for detailed error

## Next Steps After Testing

If everything works:
1. Phase 5: Build custom iOS-style pickers for better mobile UX
2. Create proper PWA icons (192x192, 512x512 PNG files)
3. Mobile optimization and final polish
4. Deploy to GitHub Pages

If you find bugs:
- Check browser console for errors
- Verify file paths are correct
- Test in different browsers
- Check IndexedDB data in DevTools
