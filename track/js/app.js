/**
 * Main application file
 * Single Alpine.js component holding all state, rendered with native
 * Alpine templates in index.html (no x-html string injection).
 */

import { db } from './db.js';

// ===== Helpers =====

function pad2(n) {
  return String(n).padStart(2, '0');
}

function dayKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth() === b.getMonth() &&
         a.getDate() === b.getDate();
}

// Format a Date as the value expected by <input type="datetime-local"> in LOCAL time
function toLocalInputValue(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
         `T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

// Parse a datetime-local string ("YYYY-MM-DDTHH:mm") as LOCAL time
function fromLocalInputValue(str) {
  return new Date(str); // browsers parse this format as local time
}

function formatTime(date) {
  const hours = date.getHours();
  const minutes = pad2(date.getMinutes());
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${ampm}`;
}

function formatFieldValue(field, value) {
  if (field.type === 'numeric') {
    return `${value} ${field.unit || ''}`.trim();
  }
  return String(value);
}

// Run fn, alerting the user and logging on failure instead of throwing
async function withErrorAlert(action, fn, message) {
  try {
    return await fn();
  } catch (error) {
    console.error(`Failed to ${action}:`, error);
    alert(message || `Failed to ${action}. Please try again.`);
  }
}

const UNITS = ['mg', 'g', 'kg', 'ml', 'L', 'oz', 'mins', 'hrs', 'days', 'times', 'pills'];

document.addEventListener('alpine:init', () => {
  Alpine.data('appData', () => ({
    // ===== State =====
    currentMonth: new Date(),
    selectedDate: new Date(),
    eventTypes: [],
    events: [],

    // Modals
    showEventForm: false,
    showTypeManager: false,
    showSettings: false,

    // Event form state
    eventForm: {
      mode: 'add',
      id: null,
      typeId: '',
      datetime: '',
      fieldValues: {}
    },

    // Type manager form state
    typeForm: {
      editingId: null,
      name: '',
      color: '#3b82f6',
      fields: []
    },

    units: UNITS,

    // ===== Init =====
    async init() {
      try {
        await db.init();
      } catch (error) {
        console.error('Failed to initialize database:', error);
        alert('Failed to initialize database. Please refresh the page.');
        return;
      }
      await this.loadData();
    },

    async loadData() {
      try {
        [this.eventTypes, this.events] = await Promise.all([
          db.getAllEventTypes(),
          db.getAllEvents()
        ]);
      } catch (error) {
        console.error('Failed to load data:', error);
      }
    },

    // ===== Computed: labels =====
    get currentMonthLabel() {
      return this.currentMonth.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    },

    get selectedDateLabel() {
      return this.selectedDate.toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    },

    get weekdays() {
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    },

    // ===== Computed: calendar grid =====
    get eventsByDay() {
      const map = new Map();
      this.events.forEach(event => {
        const key = dayKey(new Date(event.datetime));
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(event);
      });
      return map;
    },

    get typeColorMap() {
      const map = new Map();
      this.eventTypes.forEach(t => map.set(t.id, t.color));
      return map;
    },

    get calendarDays() {
      const year = this.currentMonth.getFullYear();
      const month = this.currentMonth.getMonth();
      const firstDayOfWeek = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const prevMonthLastDay = new Date(year, month, 0).getDate();
      const today = new Date();
      const eventsByDay = this.eventsByDay;
      const colors = this.typeColorMap;
      const totalCells = 42;

      const build = (date, isOtherMonth) => {
        const key = dayKey(date);
        const dayEvents = eventsByDay.get(key) || [];
        const typeIds = [...new Set(dayEvents.map(e => e.typeId))];
        return {
          key: date.toISOString(),
          date,
          day: date.getDate(),
          isOtherMonth,
          isToday: isSameDay(date, today),
          isSelected: isSameDay(date, this.selectedDate),
          dots: typeIds.map(id => colors.get(id) || '#999')
        };
      };

      const days = [];
      // Previous month tail
      for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        days.push(build(new Date(year, month - 1, prevMonthLastDay - i), true));
      }
      // Current month
      for (let d = 1; d <= daysInMonth; d++) {
        days.push(build(new Date(year, month, d), false));
      }
      // Next month head
      for (let d = 1; days.length < totalCells; d++) {
        days.push(build(new Date(year, month + 1, d), true));
      }
      return days;
    },

    // ===== Computed: event list for selected day =====
    get selectedDayEvents() {
      const typeMap = new Map();
      this.eventTypes.forEach(t => typeMap.set(t.id, t));
      const key = dayKey(this.selectedDate);
      const dayEvents = this.eventsByDay.get(key) || [];

      return [...dayEvents]
        .sort((a, b) => new Date(b.datetime) - new Date(a.datetime))
        .map(event => {
          const type = typeMap.get(event.typeId);
          if (!type) return null;
          const fields = (type.fields || [])
            .map(field => {
              const value = event.fieldValues?.[field.id];
              if (value === undefined || value === null || value === '') return null;
              return { name: field.name, value: formatFieldValue(field, value) };
            })
            .filter(Boolean);
          return {
            id: event.id,
            raw: event,
            typeName: type.name,
            color: type.color || '#999',
            time: formatTime(new Date(event.datetime)),
            fields
          };
        })
        .filter(Boolean);
    },

    // ===== Calendar navigation =====
    prevMonth() {
      this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1, 1);
    },

    nextMonth() {
      this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1, 1);
    },

    goToToday() {
      const today = new Date();
      this.currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      this.selectedDate = today;
    },

    selectDate(date) {
      this.selectedDate = new Date(date);
    },

    // ===== Event form =====
    get eventFormType() {
      return this.eventTypes.find(t => t.id === this.eventForm.typeId) || null;
    },

    openEventForm() {
      // Default datetime: selected day at the current time
      const now = new Date();
      const dt = new Date(this.selectedDate);
      dt.setHours(now.getHours(), now.getMinutes(), 0, 0);

      this.eventForm = {
        mode: 'add',
        id: null,
        typeId: '',
        datetime: toLocalInputValue(dt),
        fieldValues: {}
      };
      this.showEventForm = true;
    },

    editEvent(event) {
      this.eventForm = {
        mode: 'edit',
        id: event.id,
        typeId: event.typeId,
        datetime: toLocalInputValue(new Date(event.datetime)),
        fieldValues: { ...(event.fieldValues || {}) }
      };
      this.showEventForm = true;
    },

    onEventTypeChange() {
      // Reset field values to empty for the newly selected type
      const type = this.eventFormType;
      const values = {};
      if (type) {
        (type.fields || []).forEach(field => { values[field.id] = ''; });
      }
      this.eventForm.fieldValues = values;
    },

    async saveEvent() {
      const form = this.eventForm;
      if (!form.typeId) { alert('Please select an event type'); return; }
      if (!form.datetime) { alert('Please select date and time'); return; }

      const type = this.eventFormType;
      if (type) {
        for (const field of type.fields || []) {
          if (field.required) {
            const v = form.fieldValues[field.id];
            if (v === undefined || v === null || v === '') {
              alert(`${field.name} is required`);
              return;
            }
          }
        }
      }

      const eventData = {
        id: form.id || undefined,
        typeId: form.typeId,
        datetime: fromLocalInputValue(form.datetime).toISOString(),
        fieldValues: { ...form.fieldValues }
      };
      if (form.id) {
        const existing = this.events.find(e => e.id === form.id);
        if (existing?.createdAt) eventData.createdAt = existing.createdAt;
      }

      await withErrorAlert('save event', async () => {
        await db.saveEvent(eventData);
        await this.loadData();
        this.closeEventForm();
      });
    },

    closeEventForm() {
      this.showEventForm = false;
    },

    async deleteEvent(eventId) {
      if (!confirm('Are you sure you want to delete this event?')) return;
      await withErrorAlert('delete event', async () => {
        await db.deleteEvent(eventId);
        await this.loadData();
      });
    },

    // ===== Type manager =====
    openTypeManager() {
      this.resetTypeForm();
      this.showTypeManager = true;
    },

    closeTypeManager() {
      this.showTypeManager = false;
    },

    fieldsSummary(type) {
      return (type.fields || []).map(f => {
        const unit = f.unit ? ` (${f.unit})` : '';
        const options = f.options && f.options.length ? ` [${f.options.join(', ')}]` : '';
        return `${f.name}${unit}${options}`;
      }).join(', ');
    },

    resetTypeForm() {
      this.typeForm = {
        editingId: null,
        name: '',
        color: '#3b82f6',
        fields: []
      };
    },

    addTypeField() {
      this.typeForm.fields.push({
        id: 'field-' + Date.now() + '-' + Math.random().toString(36).slice(2, 11),
        name: '',
        type: 'numeric',
        unit: 'mg',
        optionsText: '',
        required: true
      });
    },

    removeTypeField(index) {
      this.typeForm.fields.splice(index, 1);
    },

    editType(type) {
      this.typeForm = {
        editingId: type.id,
        name: type.name,
        color: type.color,
        fields: (type.fields || []).map(f => ({
          id: f.id,
          name: f.name,
          type: f.type,
          unit: f.unit || 'mg',
          optionsText: f.options ? f.options.join(', ') : '',
          required: !!f.required
        }))
      };
    },

    async saveType() {
      const form = this.typeForm;
      if (!form.name.trim()) { alert('Please enter a type name'); return; }

      for (const field of form.fields) {
        if (!field.name.trim()) { alert('All fields must have names'); return; }
        if (field.type === 'category') {
          const options = (field.optionsText || '').split(',').map(o => o.trim()).filter(Boolean);
          if (options.length === 0) {
            alert(`Field "${field.name}" is a category but has no options`);
            return;
          }
        }
      }

      const typeData = {
        id: form.editingId || undefined,
        name: form.name.trim(),
        color: form.color,
        fields: form.fields.map(f => ({
          id: f.id,
          name: f.name.trim(),
          type: f.type,
          unit: f.type === 'numeric' ? f.unit : undefined,
          options: f.type === 'category'
            ? (f.optionsText || '').split(',').map(o => o.trim()).filter(Boolean)
            : undefined,
          required: !!f.required
        }))
      };
      if (form.editingId) {
        const existing = this.eventTypes.find(t => t.id === form.editingId);
        if (existing?.createdAt) typeData.createdAt = existing.createdAt;
      }

      await withErrorAlert('save event type', async () => {
        await db.saveEventType(typeData);
        await this.loadData();
        this.resetTypeForm();
      });
    },

    async deleteType(typeId) {
      const typeEvents = this.events.filter(e => e.typeId === typeId);
      if (typeEvents.length > 0) {
        if (!confirm(`This type has ${typeEvents.length} event(s). Delete anyway?`)) return;
      } else if (!confirm('Delete this event type?')) {
        return;
      }
      await withErrorAlert('delete event type', async () => {
        await Promise.all(typeEvents.map(e => db.deleteEvent(e.id)));
        await db.deleteEventType(typeId);
        await this.loadData();
        if (this.typeForm.editingId === typeId) this.resetTypeForm();
      });
    },

    // ===== Settings =====
    openSettings() {
      this.showSettings = true;
    },

    closeSettings() {
      this.showSettings = false;
    },

    async exportData() {
      await withErrorAlert('export data', async () => {
        const data = await db.exportAll();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `habit-tracker-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    },

    triggerImport() {
      this.$refs.importFile?.click();
    },

    async importData(e) {
      const file = e.target.files[0];
      if (!file) return;
      if (!confirm('Import data? This will replace all existing data.')) {
        e.target.value = '';
        return;
      }
      await withErrorAlert('import data', async () => {
        const text = await file.text();
        const data = JSON.parse(text);
        await db.clearAll();
        if (Array.isArray(data.eventTypes)) {
          await Promise.all(data.eventTypes.map(type => db.saveEventType(type)));
        }
        if (Array.isArray(data.events)) {
          await Promise.all(data.events.map(event => db.saveEvent(event)));
        }
        await this.loadData();
        alert('Data imported successfully!');
        this.closeSettings();
      }, 'Failed to import data. Please check the file format.');
      e.target.value = '';
    }
  }));
});
