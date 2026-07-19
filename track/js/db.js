/**
 * IndexedDB wrapper for Habit Tracker
 * Handles all database operations for event types and events
 */

const DB_NAME = 'habitTracker';
const DB_VERSION = 1;

class Database {
  constructor() {
    this.db = null;
  }

  /**
   * Initialize database connection
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Database failed to open:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('Database opened successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create EventTypes object store
        if (!db.objectStoreNames.contains('eventTypes')) {
          const eventTypesStore = db.createObjectStore('eventTypes', { keyPath: 'id' });
          eventTypesStore.createIndex('name', 'name', { unique: false });
          eventTypesStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        // Create Events object store
        if (!db.objectStoreNames.contains('events')) {
          const eventsStore = db.createObjectStore('events', { keyPath: 'id' });
          eventsStore.createIndex('typeId', 'typeId', { unique: false });
          eventsStore.createIndex('datetime', 'datetime', { unique: false });
          eventsStore.createIndex('typeId_datetime', ['typeId', 'datetime'], { unique: false });
        }

        // Create Settings object store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        console.log('Database upgrade complete');
      };
    });
  }

  /**
   * Generate UUID v4
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // ===== EVENT TYPES =====

  /**
   * Get all event types
   */
  async getAllEventTypes() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['eventTypes'], 'readonly');
      const store = transaction.objectStore('eventTypes');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get event type by ID
   */
  async getEventType(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['eventTypes'], 'readonly');
      const store = transaction.objectStore('eventTypes');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save event type (create or update)
   */
  async saveEventType(eventType) {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      const data = {
        ...eventType,
        id: eventType.id || this.generateUUID(),
        updatedAt: now,
        createdAt: eventType.createdAt || now
      };

      const transaction = this.db.transaction(['eventTypes'], 'readwrite');
      const store = transaction.objectStore('eventTypes');
      const request = store.put(data);

      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete event type
   */
  async deleteEventType(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['eventTypes'], 'readwrite');
      const store = transaction.objectStore('eventTypes');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ===== EVENTS =====

  /**
   * Get all events
   */
  async getAllEvents() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['events'], 'readonly');
      const store = transaction.objectStore('events');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get event by ID
   */
  async getEvent(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['events'], 'readonly');
      const store = transaction.objectStore('events');
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get events by type ID
   */
  async getEventsByType(typeId) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['events'], 'readonly');
      const store = transaction.objectStore('events');
      const index = store.index('typeId');
      const request = index.getAll(typeId);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get events for a specific day
   */
  async getEventsByDay(date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.getEventsByDateRange(startOfDay, endOfDay);
  }

  /**
   * Get events within a date range
   */
  async getEventsByDateRange(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['events'], 'readonly');
      const store = transaction.objectStore('events');
      const index = store.index('datetime');

      const startISO = startDate.toISOString();
      const endISO = endDate.toISOString();
      const range = IDBKeyRange.bound(startISO, endISO);

      const request = index.getAll(range);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save event (create or update)
   */
  async saveEvent(event) {
    return new Promise((resolve, reject) => {
      const now = new Date().toISOString();
      const data = {
        ...event,
        id: event.id || this.generateUUID(),
        datetime: event.datetime || now,
        updatedAt: now,
        createdAt: event.createdAt || now
      };

      const transaction = this.db.transaction(['events'], 'readwrite');
      const store = transaction.objectStore('events');
      const request = store.put(data);

      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete event
   */
  async deleteEvent(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['events'], 'readwrite');
      const store = transaction.objectStore('events');
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ===== SETTINGS =====

  /**
   * Get setting by key
   */
  async getSetting(key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Save setting
   */
  async saveSetting(key, value) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readwrite');
      const store = transaction.objectStore('settings');
      const request = store.put({ key, value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ===== UTILITY =====

  /**
   * Clear all data (for import/testing)
   */
  async clearAll() {
    const stores = ['eventTypes', 'events', 'settings'];

    return Promise.all(stores.map(storeName =>
      new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
    ));
  }

  /**
   * Get all data for export
   */
  async exportAll() {
    const [eventTypes, events, settingsData] = await Promise.all([
      this.getAllEventTypes(),
      this.getAllEvents(),
      this.getAllSettings()
    ]);

    return {
      version: DB_VERSION,
      exportDate: new Date().toISOString(),
      eventTypes,
      events,
      settings: settingsData
    };
  }

  /**
   * Get all settings
   */
  async getAllSettings() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['settings'], 'readonly');
      const store = transaction.objectStore('settings');
      const request = store.getAll();

      request.onsuccess = () => {
        const settings = {};
        request.result.forEach(item => {
          settings[item.key] = item.value;
        });
        resolve(settings);
      };
      request.onerror = () => reject(request.error);
    });
  }
}

// Export singleton instance
export const db = new Database();
