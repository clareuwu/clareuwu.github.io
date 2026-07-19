/**
 * Date utility functions
 */

/**
 * Format date for display (locale-aware)
 * @param {Date|string} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export function formatDate(date, options = {}) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const defaultOptions = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };

  return dateObj.toLocaleDateString('en-US', { ...defaultOptions, ...options });
}

/**
 * Format time for display
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted time string (12-hour format)
 */
export function formatTime(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const hours = dateObj.getHours();
  const minutes = dateObj.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = String(minutes).padStart(2, '0');

  return `${displayHours}:${displayMinutes} ${ampm}`;
}

/**
 * Format date and time together
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted datetime string
 */
export function formatDateTime(date) {
  return `${formatDate(date)} at ${formatTime(date)}`;
}

/**
 * Get start of day (00:00:00.000)
 * @param {Date} date - Date to get start of
 * @returns {Date} Start of day
 */
export function getStartOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day (23:59:59.999)
 * @param {Date} date - Date to get end of
 * @returns {Date} End of day
 */
export function getEndOfDay(date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Get start of month
 * @param {Date} date - Date in the month
 * @returns {Date} Start of month
 */
export function getStartOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Get end of month
 * @param {Date} date - Date in the month
 * @returns {Date} End of month
 */
export function getEndOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * Check if two dates are the same day
 * @param {Date} date1 - First date
 * @param {Date} date2 - Second date
 * @returns {boolean} True if same day
 */
export function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

/**
 * Get day key for caching (YYYY-MM-DD)
 * @param {Date} date - Date to convert
 * @returns {string} Day key
 */
export function getDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse day key to Date
 * @param {string} dayKey - Day key (YYYY-MM-DD)
 * @returns {Date} Parsed date
 */
export function parseDayKey(dayKey) {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Convert local date to UTC ISO string
 * @param {Date} date - Local date
 * @returns {string} UTC ISO string
 */
export function toUTC(date) {
  return date.toISOString();
}

/**
 * Convert UTC ISO string to local date
 * @param {string} utcString - UTC ISO string
 * @returns {Date} Local date
 */
export function fromUTC(utcString) {
  return new Date(utcString);
}

/**
 * Get relative time string (e.g., "2 hours ago", "in 3 days")
 * @param {Date|string} date - Date to compare
 * @returns {string} Relative time string
 */
export function getRelativeTime(date) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now - dateObj;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) {
    return 'just now';
  } else if (diffMin < 60) {
    return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
  } else if (diffHour < 24) {
    return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
  } else if (diffDay < 7) {
    return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
  } else {
    return formatDate(dateObj);
  }
}

/**
 * Get all days in a month
 * @param {number} year - Year
 * @param {number} month - Month (0-11)
 * @returns {Date[]} Array of dates for each day
 */
export function getDaysInMonth(year, month) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];

  for (let day = 1; day <= daysInMonth; day++) {
    days.push(new Date(year, month, day));
  }

  return days;
}

/**
 * Add days to a date
 * @param {Date} date - Starting date
 * @param {number} days - Number of days to add (can be negative)
 * @returns {Date} New date
 */
export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Add months to a date
 * @param {Date} date - Starting date
 * @param {number} months - Number of months to add (can be negative)
 * @returns {Date} New date
 */
export function addMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}
