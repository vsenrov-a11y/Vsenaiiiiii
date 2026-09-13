/**
 * Real-world date, calendar, and time-of-day helper for chats and worlds.
 * Automatically synchronizes with current real-world date/time (e.g. "August 15, 2026 - Afternoon").
 */

export function getRealWorldDefaultCalendar(customCalendar?: string): string {
  if (
    customCalendar &&
    customCalendar.trim() &&
    customCalendar.trim() !== 'Spring - Month 3' &&
    customCalendar.trim() !== 'Spring - Afternoon' &&
    !customCalendar.includes('Year 1024') &&
    !customCalendar.includes('Year 1042')
  ) {
    return customCalendar.trim();
  }

  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'long' });
  const day = now.getDate();
  const year = now.getFullYear();
  const hours = now.getHours();

  let timeOfDay = 'Afternoon';
  if (hours >= 5 && hours < 12) {
    timeOfDay = 'Morning';
  } else if (hours >= 12 && hours < 17) {
    timeOfDay = 'Afternoon';
  } else if (hours >= 17 && hours < 21) {
    timeOfDay = 'Evening';
  } else {
    timeOfDay = 'Night';
  }

  return `${month} ${day}, ${year} - ${timeOfDay}`;
}
