import type { CalendarEvent } from '../store/useAppStore';

export type ScheduleDraft = {
  title?: string;
  place?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
};

export type CompleteScheduleDraft = {
  title: string;
  place: string;
  date: string;
  startTime: string;
  endTime: string;
};

export type ScheduleField = 'title' | 'place' | 'date' | 'time';

const allFieldLabels = [
  'time and date',
  'date and time',
  'location',
  'place',
  'venue',
  'title',
  'event',
  'name',
  'date',
  'day',
  'time',
];

const nonTitleWords = [
  'schedule',
  'calendar',
  'appointment',
  'meeting',
  'event',
  'plan',
  'book',
  'block',
  'reserve',
];

const monthIndexes: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const weekdayIndexes: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

function normalizeSpaces(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function cleanExtractedValue(value?: string) {
  return normalizeSpaces((value ?? '').replace(/^[\s:,-]+|[\s,.;]+$/g, ''));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromDateParts(year: number, monthIndex: number, day: number) {
  const date = new Date(year, monthIndex, day);
  if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) return null;
  return date;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function normalizeYear(rawYear: string | undefined, now: Date) {
  if (!rawYear) return now.getFullYear();
  const numeric = Number(rawYear);
  if (rawYear.length === 2) return 2000 + numeric;
  return numeric;
}

function chooseBestDate(candidates: Date[], now: Date) {
  const today = startOfDay(now).getTime();
  const valid = candidates
    .filter((date) => Number.isFinite(date.getTime()))
    .sort((a, b) => {
      const aTime = startOfDay(a).getTime();
      const bTime = startOfDay(b).getTime();
      const aIsFuture = aTime >= today;
      const bIsFuture = bTime >= today;
      if (aIsFuture !== bIsFuture) return aIsFuture ? -1 : 1;
      return Math.abs(aTime - today) - Math.abs(bTime - today);
    });

  return valid[0] ?? null;
}

function labelPattern(labels: string[]) {
  return labels.map(escapeRegExp).join('|');
}

function extractFieldValue(message: string, labels: string[]) {
  const fieldPattern = labelPattern(labels);
  const stopPattern = labelPattern(allFieldLabels);
  const colonMatch = message.match(new RegExp(String.raw`(?:^|[\n,;])\s*(?:${fieldPattern})\s*:\s*([\s\S]*?)(?=(?:[\n,;]\s*(?:${stopPattern})\s*:)|$)`, 'i'));
  if (colonMatch?.[1]) return cleanExtractedValue(colonMatch[1]);

  const statementMatch = message.match(new RegExp(String.raw`\b(?:${fieldPattern})\s+(?:is|as|to be|at)\s+([\s\S]*?)(?=(?:\b(?:${stopPattern})\s+(?:is|as|to be|at)\b)|$)`, 'i'));
  if (statementMatch?.[1]) return cleanExtractedValue(statementMatch[1]);

  return '';
}

function extractCombinedDateTimeValue(message: string) {
  return extractFieldValue(message, ['time and date', 'date and time']);
}

function parseRelativeDate(message: string, now: Date) {
  if (/\btoday\b/i.test(message)) return toDateKey(now);
  if (/\btomorrow\b/i.test(message)) return toDateKey(addDays(now, 1));
  return null;
}

function parseWeekdayDate(message: string, now: Date) {
  const match = message.match(/\b(next\s+)?(sun(?:day)?|mon(?:day)?|tue(?:s|sday)?|wed(?:nesday)?|thu(?:rs|rsday)?|fri(?:day)?|sat(?:urday)?)\b/i);
  if (!match) return null;

  const requested = weekdayIndexes[match[2].toLowerCase()];
  if (requested === undefined) return null;

  const current = now.getDay();
  let delta = (requested - current + 7) % 7;
  if (delta === 0 || match[1]) delta += 7;
  return toDateKey(addDays(now, delta));
}

function parseIsoDate(message: string) {
  const match = message.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (!match) return null;

  const date = fromDateParts(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return date ? toDateKey(date) : null;
}

function parseNamedMonthDate(message: string, now: Date) {
  const monthNames = Object.keys(monthIndexes).join('|');
  const monthFirst = message.match(new RegExp(String.raw`\b(${monthNames})\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(20\d{2}|\d{2}))?\b`, 'i'));
  const dayFirst = message.match(new RegExp(String.raw`\b(\d{1,2})(?:st|nd|rd|th)?\s+(${monthNames})(?:,?\s*(20\d{2}|\d{2}))?\b`, 'i'));
  const match = monthFirst ?? dayFirst;
  if (!match) return null;

  const isMonthFirst = match === monthFirst;
  const month = isMonthFirst ? match[1] : match[2];
  const day = Number(isMonthFirst ? match[2] : match[1]);
  const year = normalizeYear(match[3], now);
  const date = fromDateParts(year, monthIndexes[month.toLowerCase()], day);
  if (!date) return null;

  if (!match[3] && startOfDay(date) < startOfDay(now)) {
    const nextYearDate = fromDateParts(year + 1, date.getMonth(), date.getDate());
    return nextYearDate ? toDateKey(nextYearDate) : null;
  }

  return toDateKey(date);
}

function parseNumericDate(message: string, now: Date) {
  const match = message.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](20\d{2}|\d{2}))?\b/);
  if (!match) return null;

  const first = Number(match[1]);
  const second = Number(match[2]);
  const year = normalizeYear(match[3], now);
  const candidates: Date[] = [];

  const monthDay = fromDateParts(year, first - 1, second);
  if (monthDay) candidates.push(monthDay);

  const dayMonth = fromDateParts(year, second - 1, first);
  if (dayMonth) candidates.push(dayMonth);

  const chosen = chooseBestDate(candidates, now);
  return chosen ? toDateKey(chosen) : null;
}

function parseDate(message: string, now: Date) {
  const dateValue = extractFieldValue(message, ['date', 'day']);
  const combinedDateTimeValue = extractCombinedDateTimeValue(message);
  const sources = [dateValue, combinedDateTimeValue, message].filter(Boolean);

  for (const source of sources) {
    const parsed = parseRelativeDate(source, now)
      ?? parseIsoDate(source)
      ?? parseNamedMonthDate(source, now)
      ?? parseNumericDate(source, now)
      ?? parseWeekdayDate(source, now);

    if (parsed) return parsed;
  }

  return undefined;
}

function parseTimeToken(token: string, inheritedMeridiem?: string) {
  const normalized = token.trim().toLowerCase();
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? '0');
  const meridiem = (match[3] ?? inheritedMeridiem)?.toLowerCase();

  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    if (meridiem === 'pm' && hour !== 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
  } else if (hour > 23 || !match[2]) {
    return null;
  }

  return hour * 60 + minute;
}

function minutesToInputTime(minutes: number) {
  const bounded = ((minutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  const hour = Math.floor(bounded / 60);
  const minute = bounded % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function parseTimeRange(message: string) {
  const timeToken = String.raw`(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)|(?:[01]?\d|2[0-3]):[0-5]\d)`;
  const rangeEndToken = String.raw`(?:\d{1,2}(?::\d{2})?\s*(?:am|pm)?|(?:[01]?\d|2[0-3]):[0-5]\d)`;
  const rangeMatch = message.match(new RegExp(String.raw`\b(${timeToken})\s*(?:-|to|until|till|through)\s*(${rangeEndToken})\b`, 'i'));
  if (rangeMatch) {
    const firstMeridiem = rangeMatch[1].match(/\b(am|pm)\b/i)?.[1]?.toLowerCase();
    const start = parseTimeToken(rangeMatch[1]);
    const parsedEnd = parseTimeToken(rangeMatch[2], firstMeridiem);
    if (start !== null && parsedEnd !== null) {
      const end = parsedEnd > start ? parsedEnd : start + 60;
      return {
        startTime: minutesToInputTime(start),
        endTime: minutesToInputTime(end),
      };
    }
  }

  const singleMatch = message.match(new RegExp(String.raw`\b(?:at|from|time\s*:?\s*)?(${timeToken})\b`, 'i'));
  if (!singleMatch) return {};

  const start = parseTimeToken(singleMatch[1]);
  if (start === null) return {};

  return {
    startTime: minutesToInputTime(start),
    endTime: minutesToInputTime(start + 60),
  };
}

function parseTime(message: string) {
  const timeValue = extractFieldValue(message, ['time']);
  const combinedDateTimeValue = extractCombinedDateTimeValue(message);
  const sources = [timeValue, combinedDateTimeValue, message].filter(Boolean);

  for (const source of sources) {
    const parsed = parseTimeRange(source);
    if (parsed.startTime) return parsed;
  }

  return {};
}

function extractPlace(message: string) {
  const labeled = extractFieldValue(message, ['place', 'location', 'venue']);
  if (labeled) return labeled;

  const placeMatches = Array.from(message.matchAll(/\b(?:at|in)\s+(.+?)(?=\s+\b(?:on|at|from|by|tomorrow|today|next)\b|[,.;]|$)/gi));
  const value = placeMatches
    .map((match) => cleanExtractedValue(match[1]))
    .find((candidate) => candidate && !/^\d{1,2}(?::\d{2})?\s*(am|pm)?$/i.test(candidate) && !/^my calendar$/i.test(candidate));

  if (!value) return undefined;
  return value;
}

function stripDateAndTimePhrases(message: string) {
  return message
    .replace(/\b(today|tomorrow|next\s+\w+)\b/gi, ' ')
    .replace(/\b(20\d{2})-\d{1,2}-\d{1,2}\b/g, ' ')
    .replace(/\b\d{1,2}[/.]\d{1,2}(?:[/.](?:20\d{2}|\d{2}))?\b/g, ' ')
    .replace(/\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s*(?:20\d{2}|\d{2}))?\b/gi, ' ')
    .replace(/\b\d{1,2}(?:st|nd|rd|th)?\s+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:,?\s*(?:20\d{2}|\d{2}))?\b/gi, ' ')
    .replace(/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi, ' ')
    .replace(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g, ' ');
}

function normalizeTitleValue(value: string) {
  const cleaned = cleanExtractedValue(value)
    .replace(/^(?:my|a|an|the)\s+/i, '')
    .replace(/^(?:called|named|titled)\s+/i, '');

  if (!cleaned) return '';
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function extractPurposeTitle(message: string) {
  const match = message.match(/\b(?:make|create|add|plan|book|block|reserve|put|schedule)?\s*(?:a\s+)?(?:schedule|calendar\s+event|event|appointment)\s+(?:for|about|called|named|titled)\s+(.+?)(?=\s+\b(?:at|in|on|from|until|till|through|today|tomorrow|next|place|location|venue|date|time)\b|[,.;]|$)/i);
  if (!match?.[1]) return undefined;

  const title = normalizeTitleValue(match[1]);
  return title && !nonTitleWords.includes(title.toLowerCase()) ? title : undefined;
}

function extractTitle(message: string) {
  const labeled = extractFieldValue(message, ['title', 'event', 'name']);
  if (labeled) return normalizeTitleValue(labeled);

  const purposeTitle = extractPurposeTitle(message);
  if (purposeTitle) return purposeTitle;

  let working = normalizeSpaces(message)
    .replace(/^(please|can you|could you|help me|i want to|i need to|i would like to)\s+/i, '')
    .replace(/\b(add|create|make|schedule|plan|book|block|reserve|put)\b/gi, '')
    .replace(/\b(a|an|the|my)\s+(schedule|calendar|event|appointment|meeting|block)\b/i, '')
    .replace(/\b(to|in)\s+my\s+calendar\b/i, '')
    .replace(/\bfor\b\s+/i, '');

  working = stripDateAndTimePhrases(working);
  working = working.split(/\s+\b(?:at|in|on|from|until|till|through)\b\s+/i)[0];
  working = normalizeTitleValue(working);

  if (!working || nonTitleWords.includes(working.toLowerCase())) return undefined;
  return working;
}

export function isScheduleIntent(message: string) {
  const lower = message.toLowerCase();
  return /\b(schedule|calendar|appointment|meeting|event|book|block|reserve)\b/i.test(lower)
    || (/\bplan\b/i.test(lower) && /\b(schedule|calendar|appointment|meeting|event)\b/i.test(lower))
    || /put\s+.+\s+calendar/i.test(message)
    || /add\s+.+\s+calendar/i.test(message);
}

export function mergeScheduleDraft(current: ScheduleDraft | null, message: string, now = new Date()): ScheduleDraft {
  const time = parseTime(message);
  return {
    ...current,
    title: extractTitle(message) ?? current?.title,
    place: extractPlace(message) ?? current?.place,
    date: parseDate(message, now) ?? current?.date,
    startTime: time.startTime ?? current?.startTime,
    endTime: time.endTime ?? current?.endTime,
  };
}

export function getMissingScheduleFields(draft: ScheduleDraft): ScheduleField[] {
  const missing: ScheduleField[] = [];
  if (!draft.title) missing.push('title');
  if (!draft.place) missing.push('place');
  if (!draft.date) missing.push('date');
  if (!draft.startTime) missing.push('time');
  return missing;
}

export function completeScheduleDraft(draft: ScheduleDraft): CompleteScheduleDraft | null {
  if (!draft.title || !draft.place || !draft.date || !draft.startTime) return null;
  return {
    title: draft.title,
    place: draft.place,
    date: draft.date,
    startTime: draft.startTime,
    endTime: draft.endTime ?? minutesToInputTime((parseTimeToken(draft.startTime) ?? 9 * 60) + 60),
  };
}

function inputTimeToMinutes(value: string) {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

export function formatScheduleTime(value: string) {
  const minutes = inputTimeToMinutes(value);
  const hour24 = Math.floor(minutes / 60) % 24;
  const minute = minutes % 60;
  const meridiem = hour24 >= 12 ? 'PM' : 'AM';
  const hour = hour24 % 12 || 12;
  return `${hour}:${String(minute).padStart(2, '0')} ${meridiem}`;
}

export function formatScheduleDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString([], {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatScheduleTimeRange(draft: Pick<CompleteScheduleDraft, 'startTime' | 'endTime'>) {
  return `${formatScheduleTime(draft.startTime)} - ${formatScheduleTime(draft.endTime)}`;
}

export function formatMissingScheduleQuestion(missing: ScheduleField[]) {
  const labels: Record<ScheduleField, string> = {
    title: 'title',
    place: 'place',
    date: 'date',
    time: 'time',
  };
  const missingLabels = missing.map((field) => labels[field]);
  const joined = missingLabels.length === 1
    ? missingLabels[0]
    : `${missingLabels.slice(0, -1).join(', ')} and ${missingLabels[missingLabels.length - 1]}`;

  return `I can put that in your calendar once I have the ${joined}.`;
}

function getEventType(startTime: string): CalendarEvent['type'] {
  const minutes = inputTimeToMinutes(startTime);
  if (minutes < 12 * 60) return 'Morning';
  if (minutes < 17 * 60) return 'Afternoon';
  return 'Evening';
}

function getEventCategory(title: string): CalendarEvent['category'] {
  const lower = title.toLowerCase();
  if (/\b(class|lecture|study|exam)\b/.test(lower)) return 'study';
  if (/\b(deadline|assignment|submission)\b/.test(lower)) return 'assignment';
  if (/\b(urgent|important|pitch|board)\b/.test(lower)) return 'important';
  if (/\b(charge|charging)\b/.test(lower)) return 'charging';
  if (/\b(gym|fitness|wellness|workout)\b/.test(lower)) return 'fitness';
  if (/\b(family|dinner|personal|lunch)\b/.test(lower)) return 'personal';
  return 'work';
}

function isRemotePlace(place: string) {
  return /\b(online|remote|zoom|teams|google meet|meet call|video call)\b/i.test(place);
}

export function buildCalendarEventFromDraft(draft: CompleteScheduleDraft): CalendarEvent {
  const [year, month, day] = draft.date.split('-').map(Number);
  const carNeeded = !isRemotePlace(draft.place);

  return {
    id: `chat-${Date.now()}`,
    title: draft.title,
    location: draft.place,
    time: formatScheduleTime(draft.startTime),
    endTime: formatScheduleTime(draft.endTime),
    date: new Date(year, month - 1, day),
    carNeeded,
    type: getEventType(draft.startTime),
    category: getEventCategory(draft.title),
    status: carNeeded ? 'Vehicle Required' : 'Remote / No Car',
    notes: 'Created from MB Sense Assistant.',
  };
}

