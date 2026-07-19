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

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('eventTypes')) {
          db.createObjectStore('eventTypes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('events')) {
          db.createObjectStore('events', { keyPath: 'id' });
        }
      };
    });
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * Run a single request against an object store and resolve with its result.
   */
  _run(storeName, mode, fn) {
    return new Promise((resolve, reject) => {
      const store = this.db.transaction([storeName], mode).objectStore(storeName);
      const request = fn(store);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ===== EVENT TYPES =====

  getAllEventTypes() {
    return this._run('eventTypes', 'readonly', store => store.getAll());
  }

  async saveEventType(eventType) {
    const now = new Date().toISOString();
    const data = {
      ...eventType,
      id: eventType.id || this.generateUUID(),
      updatedAt: now,
      createdAt: eventType.createdAt || now
    };
    await this._run('eventTypes', 'readwrite', store => store.put(data));
    return data;
  }

  deleteEventType(id) {
    return this._run('eventTypes', 'readwrite', store => store.delete(id));
  }

  // ===== EVENTS =====

  getAllEvents() {
    return this._run('events', 'readonly', store => store.getAll());
  }

  async saveEvent(event) {
    const now = new Date().toISOString();
    const data = {
      ...event,
      id: event.id || this.generateUUID(),
      datetime: event.datetime || now,
      updatedAt: now,
      createdAt: event.createdAt || now
    };
    await this._run('events', 'readwrite', store => store.put(data));
    return data;
  }

  deleteEvent(id) {
    return this._run('events', 'readwrite', store => store.delete(id));
  }

  // ===== UTILITY =====

  async clearAll() {
    await Promise.all(['eventTypes', 'events'].map(storeName =>
      this._run(storeName, 'readwrite', store => store.clear())
    ));
  }

  async exportAll() {
    const [eventTypes, events] = await Promise.all([
      this.getAllEventTypes(),
      this.getAllEvents()
    ]);

    return {
      version: DB_VERSION,
      exportDate: new Date().toISOString(),
      eventTypes,
      events
    };
  }
}

// Export singleton instance
export const db = new Database();
