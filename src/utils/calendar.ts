import type {WeddingConfig} from '../types/wedding';

function toIcsUtc(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/,/g, '\\,').replace(/;/g, '\\;').replace(/\n/g, '\\n');
}

export function downloadWeddingCalendarReminder(config: WeddingConfig): void {
  const title = `${config.couple.bride.nickname.en} & ${config.couple.groom.nickname.en} — Wedding Muhurtham`;
  const location = `${config.venue.name.en}, ${config.venue.addressLine1.en}, ${config.venue.addressLine2.en}`;
  const description = `${config.hero.invitationMessage.en} Muhurtham: ${config.dateAndTime.muhurthamWindow.en}. Directions: ${config.venue.googleMapsUrl}`;

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Kerala Hindu Wedding Invitation//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:wedding-${config.dateAndTime.muhurthamIso}@invitation`,
    `DTSTAMP:${toIcsUtc(new Date().toISOString())}`,
    `DTSTART:${toIcsUtc(config.dateAndTime.muhurthamIso)}`,
    `DTEND:${toIcsUtc(config.dateAndTime.calendarEndIso)}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], {type: 'text/calendar;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${config.couple.bride.nickname.en.toLowerCase()}-${config.couple.groom.nickname.en.toLowerCase()}-wedding.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
