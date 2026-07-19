/**
 * Storage utilities for data export/import
 */

import { db } from '../db.js';

/**
 * Export all data to JSON file
 * @returns {Promise<void>}
 */
export async function exportData() {
  try {
    const data = await db.exportAll();

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `habit-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);

    // Save last export timestamp
    await db.saveSetting('lastExportDate', new Date().toISOString());

    console.log('Data exported successfully');
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
}

/**
 * Import data from JSON file
 * @param {File} file - JSON file to import
 * @param {boolean} merge - If true, merge with existing data; if false, replace
 * @returns {Promise<Object>} Import stats
 */
export async function importData(file, merge = false) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);

        // Validate data structure
        if (!validateImportData(data)) {
          throw new Error('Invalid data format');
        }

        // Clear existing data if not merging
        if (!merge) {
          await db.clearAll();
        }

        // Import event types
        const importedTypes = [];
        if (data.eventTypes && Array.isArray(data.eventTypes)) {
          for (const type of data.eventTypes) {
            const saved = await db.saveEventType(type);
            importedTypes.push(saved);
          }
        }

        // Import events
        const importedEvents = [];
        if (data.events && Array.isArray(data.events)) {
          for (const event of data.events) {
            const saved = await db.saveEvent(event);
            importedEvents.push(saved);
          }
        }

        // Import settings
        if (data.settings && typeof data.settings === 'object') {
          for (const [key, value] of Object.entries(data.settings)) {
            await db.saveSetting(key, value);
          }
        }

        // Save import timestamp
        await db.saveSetting('lastImportDate', new Date().toISOString());

        const stats = {
          eventTypes: importedTypes.length,
          events: importedEvents.length,
          success: true
        };

        console.log('Data imported successfully:', stats);
        resolve(stats);
      } catch (error) {
        console.error('Import failed:', error);
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}

/**
 * Validate import data structure
 * @param {Object} data - Data to validate
 * @returns {boolean} True if valid
 */
function validateImportData(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Check for required top-level properties
  if (!data.eventTypes && !data.events) {
    return false;
  }

  // Validate event types
  if (data.eventTypes) {
    if (!Array.isArray(data.eventTypes)) {
      return false;
    }

    for (const type of data.eventTypes) {
      if (!type.id || !type.name || !Array.isArray(type.fields)) {
        return false;
      }
    }
  }

  // Validate events
  if (data.events) {
    if (!Array.isArray(data.events)) {
      return false;
    }

    for (const event of data.events) {
      if (!event.id || !event.typeId || !event.datetime) {
        return false;
      }

      // Validate datetime is valid ISO string
      if (isNaN(Date.parse(event.datetime))) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Get last export date
 * @returns {Promise<Date|null>}
 */
export async function getLastExportDate() {
  const dateString = await db.getSetting('lastExportDate');
  return dateString ? new Date(dateString) : null;
}

/**
 * Get last import date
 * @returns {Promise<Date|null>}
 */
export async function getLastImportDate() {
  const dateString = await db.getSetting('lastImportDate');
  return dateString ? new Date(dateString) : null;
}

/**
 * Auto-export to downloads folder
 * Note: Browsers don't allow automatic file downloads without user interaction,
 * so this will still require a user click, but can be triggered automatically
 * @returns {Promise<void>}
 */
export async function autoExport() {
  const lastExport = await getLastExportDate();
  const now = new Date();

  // Check if a week has passed since last export
  if (lastExport) {
    const daysSinceExport = (now - lastExport) / (1000 * 60 * 60 * 24);
    if (daysSinceExport < 7) {
      console.log(`Last export was ${Math.floor(daysSinceExport)} days ago, skipping auto-export`);
      return;
    }
  }

  console.log('Auto-export: triggering backup');
  await exportData();
}

/**
 * Check if auto-export is due
 * @returns {Promise<boolean>}
 */
export async function isAutoExportDue() {
  const lastExport = await getLastExportDate();
  if (!lastExport) {
    return true;
  }

  const now = new Date();
  const daysSinceExport = (now - lastExport) / (1000 * 60 * 60 * 24);

  return daysSinceExport >= 7;
}

/**
 * Get storage statistics
 * @returns {Promise<Object>} Storage stats
 */
export async function getStorageStats() {
  const eventTypes = await db.getAllEventTypes();
  const events = await db.getAllEvents();

  // Estimate storage size (rough approximation)
  const dataSize = new Blob([JSON.stringify({ eventTypes, events })]).size;

  return {
    eventTypesCount: eventTypes.length,
    eventsCount: events.length,
    estimatedSize: formatBytes(dataSize),
    estimatedSizeBytes: dataSize
  };
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Bytes
 * @returns {string} Formatted string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
