# Habit Tracker PWA

A Progressive Web App for tracking habits, medications, and custom events with flexible schemas.

## Current Status

### ✅ Completed (Phases 1-4, 6-7)
- Basic HTML structure with Alpine.js integration
- PWA manifest and service worker
- IndexedDB wrapper with full CRUD operations
- Calendar component with month navigation
- Event list component with edit/delete functionality
- Event type manager with field builder
- Event form with dynamic fields
- Data export/import functionality
- Date utilities
- Minimal CSS styling

### 🚧 In Progress
- Testing basic functionality

### ⏳ Pending (Phase 5)
- Custom iOS-style wheel pickers (DateTime, Numeric, Category)
- Replace HTML5 inputs with custom pickers
- PWA icons (192x192 and 512x512 PNG files)
- Final mobile optimization and polish

## Testing Instructions

### Local Development
1. Start HTTP server from parent directory:
   ```bash
   cd /Users/clare/projects/clareuwu.github.io
   python3 -m http.server 8000
   ```

2. Open browser to: `http://localhost:8000/track/`

### Test Checklist
- [ ] Create a new event type with multiple fields (numeric, category, text)
- [ ] Add an event with all field types filled
- [ ] Navigate calendar forward/backward
- [ ] Select different days and verify events display correctly
- [ ] Edit an event and verify changes saved
- [ ] Delete an event with confirmation
- [ ] Export data to JSON
- [ ] Import data from JSON
- [ ] Test offline mode (disconnect network, verify app still works)
- [ ] Test PWA installation (Add to Home Screen)

### Known Issues
- PWA icons not yet created (will show default icons)
- Using HTML5 datetime-local input (works but not iOS-optimized)
- Using basic number/select inputs for fields (will be replaced with custom pickers)

## File Structure
```
/track/
├── index.html           # Main app entry point
├── manifest.json        # PWA manifest
├── sw.js               # Service worker
├── css/
│   └── track.css       # App-specific styles
├── js/
│   ├── app.js          # Alpine.js initialization & global state
│   ├── db.js           # IndexedDB wrapper
│   ├── components/
│   │   ├── calendar.js     # Monthly calendar grid
│   │   ├── event-list.js   # Event list for selected day
│   │   ├── event-form.js   # Add/edit event modal
│   │   └── type-form.js    # Event type manager
│   └── utils/
│       ├── date.js         # Date formatting/manipulation
│       └── storage.js      # Export/import utilities
└── icons/              # PWA icons (TODO: create PNG files)
```

## Next Steps

1. **Test Current Implementation**
   - Verify all core features work as expected
   - Test on multiple browsers (Chrome, Safari, Firefox)
   - Test on mobile devices (iOS Safari, Chrome Mobile)

2. **Create PWA Icons**
   - Generate 192x192 icon: `icons/icon-192.png`
   - Generate 512x512 icon: `icons/icon-512.png`
   - Use simple colored square or custom design

3. **Build Custom Pickers (Phase 5)**
   - Implement iOS-style scroll-snap wheel pickers
   - Replace datetime-local with custom DateTime picker (5 wheels)
   - Replace number inputs with Numeric picker (number + unit wheels)
   - Replace select inputs with Category picker (single wheel)

4. **Mobile Optimization (Phase 7)**
   - Test touch interactions
   - Optimize picker scroll performance
   - Verify large touch targets (44px minimum)
   - Test on various screen sizes

5. **Final Polish**
   - Error handling edge cases
   - Loading states
   - Smooth animations
   - Accessibility improvements

## Technical Notes

- **Alpine.js**: Loaded from CDN, reactive UI without build tools
- **IndexedDB**: Local-first data storage, automatic backup via export
- **Service Worker**: Offline support, cache-first strategy for assets
- **ES6 Modules**: Native browser imports, no bundler required
- **Mobile-First**: Designed for rapid mobile logging

## Development Guidelines

- Keep styling minimal (inherit from `/s/main.css`)
- No external dependencies except Alpine.js
- All data stays local (privacy-first)
- Manual event entry only (no recurring events)
- Export/import for data portability

## Browser Support

- Modern browsers with ES6 module support
- IndexedDB support (all modern browsers)
- Service Worker support (PWA functionality)
- Alpine.js 3.x compatible

## License

Part of clareuwu.github.io personal site
