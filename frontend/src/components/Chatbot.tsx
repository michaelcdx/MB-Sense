import { useState, useRef, useEffect, type FormEvent } from 'react';
import { MessageSquare, X, Send, Loader2, Mic, CalendarPlus, CheckCircle2, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import Markdown from 'react-markdown';
import { useAppStore, type CalendarEvent } from '../store/useAppStore';
import { useCalendarViewStore } from '../store/useCalendarViewStore';
import {
  buildCalendarEventFromDraft,
  completeScheduleDraft,
  formatMissingScheduleQuestion,
  formatScheduleDate,
  formatScheduleTimeRange,
  getMissingScheduleFields,
  isScheduleIntent,
  mergeScheduleDraft,
  type CompleteScheduleDraft,
  type ScheduleDraft,
} from '../lib/chatSchedule';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  scheduleDraft?: CompleteScheduleDraft;
  scheduleStatus?: 'ready' | 'added';
  scheduleUpdate?: CalendarEvent;
  scheduleUpdateStatus?: 'ready' | 'updated';
}

interface ChatbotProps {
  embedded?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0?: { transcript?: string };
};

type SpeechRecognitionResultEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionErrorEventLike = {
  error?: string;
  message?: string;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function AiLogo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <img
      src="/AI-logo-cropped.svg"
      alt=""
      aria-hidden="true"
      draggable={false}
      className={cn('object-contain', inverted && 'brightness-0 invert', className)}
    />
  );
}
function getSpeechRecognitionConstructor() {
  if (typeof window === 'undefined') return undefined;
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getSpeechAnswerSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

function formatVoiceAnswerText(content: string) {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .replace(/[#>_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatScheduleSummary(draft: CompleteScheduleDraft) {
  return [
    'I have the schedule ready:',
    '',
    `- Title: ${draft.title}`,
    `- Place: ${draft.place}`,
    `- Date: ${formatScheduleDate(draft.date)}`,
    `- Time: ${formatScheduleTimeRange(draft)}`,
    '',
    'Use the button below when you want me to block it in your calendar.',
  ].join('\n');
}

function formatDraftField(value?: string) {
  return value?.trim() || '__________';
}

function formatDraftTime(draft: ScheduleDraft) {
  if (draft.startTime && draft.endTime) return formatScheduleTimeRange({ startTime: draft.startTime, endTime: draft.endTime });
  return '__________';
}

function formatKnownDraftDetails(draft: ScheduleDraft) {
  return [
    '',
    `- Title: ${formatDraftField(draft.title)}`,
    `- Date: ${draft.date ? formatScheduleDate(draft.date) : '__________'}`,
    `- Time: ${formatDraftTime(draft)}`,
    `- Place: ${formatDraftField(draft.place)}`,
  ].join('\n');
}

function getCalendarEventDateKey(event: CalendarEvent) {
  const date = event.date instanceof Date ? event.date : new Date(event.date);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function displayTimeToInputTime(value?: string) {
  if (!value) return undefined;
  const match = value.match(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\b/i);
  if (!match) return undefined;

  let hour = Number(match[1]);
  const minute = Number(match[2] ?? '0');
  const meridiem = match[3]?.toUpperCase();

  if (minute > 59) return undefined;
  if (meridiem === 'PM' && hour !== 12) hour += 12;
  if (meridiem === 'AM' && hour === 12) hour = 0;
  if (hour > 23) return undefined;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function eventToScheduleDraft(event: CalendarEvent): ScheduleDraft {
  return {
    title: event.title,
    place: event.location,
    date: getCalendarEventDateKey(event),
    startTime: displayTimeToInputTime(event.time),
    endTime: displayTimeToInputTime(event.endTime),
  };
}

function scheduleDraftHasChanges(before: ScheduleDraft, after: ScheduleDraft) {
  return before.title !== after.title
    || before.place !== after.place
    || before.date !== after.date
    || before.startTime !== after.startTime
    || before.endTime !== after.endTime;
}

function hasScheduleModifyIntent(message: string) {
  return /\b(change|update|edit|modify|revise|reschedule|delete|remove|cancel)\b/i.test(message);
}

function hasScheduleReference(message: string) {
  return /\b(schedule|calendar|event|appointment|meeting)\b/i.test(message);
}

function hasScheduleDeleteIntent(message: string) {
  return /\b(delete|remove|cancel)\b/i.test(message);
}

function hasScheduleDetailChange(message: string) {
  return /\b(change|update|edit|modify|revise|reschedule|set|move)\b/i.test(message)
    || /\b(title|event|name|date|day|time|place|location|venue|destination)\s*[:=]/i.test(message);
}

function scoreTextMatch(source: string, query?: string) {
  const sourceText = normalizeSearchText(source);
  const queryText = normalizeSearchText(query ?? '');
  if (!sourceText || !queryText) return 0;
  if (sourceText === queryText) return 8;
  if (sourceText.includes(queryText) || queryText.includes(sourceText)) return 6;

  const sourceTokens = new Set(sourceText.split(' ').filter((token) => token.length > 2));
  const queryTokens = queryText.split(' ').filter((token) => token.length > 2);
  if (!sourceTokens.size || !queryTokens.length) return 0;
  const matched = queryTokens.filter((token) => sourceTokens.has(token)).length;
  return matched ? Math.min(4, matched) : 0;
}

function findBestScheduleMatch(events: CalendarEvent[], message: string) {
  const criteria = mergeScheduleDraft(null, message);
  const hasTextCriteria = Boolean(criteria.title || criteria.place);
  const hasDateTimeCriteria = Boolean(criteria.date && criteria.startTime);
  if (!hasTextCriteria && !hasDateTimeCriteria) return null;

  const ranked = events
    .map((event) => {
      const textScore = scoreTextMatch(event.title, criteria.title) + scoreTextMatch(event.location, criteria.place);
      const eventStartTime = displayTimeToInputTime(event.time);
      const eventEndTime = displayTimeToInputTime(event.endTime);
      const dateTimeScore = (criteria.date && getCalendarEventDateKey(event) === criteria.date ? 6 : 0)
        + (criteria.startTime && eventStartTime === criteria.startTime ? 5 : 0)
        + (criteria.endTime && eventEndTime === criteria.endTime ? 2 : 0);
      return { event, score: textScore + dateTimeScore, textScore, dateTimeScore };
    })
    .filter((item) => item.textScore >= 3 || (hasDateTimeCriteria && item.dateTimeScore >= 10))
    .sort((a, b) => b.score - a.score);

  return ranked[0]?.event ?? null;
}

function formatCalendarEventDetails(event: CalendarEvent) {
  return [
    'I found this schedule:',
    '',
    `- Title: ${event.title}`,
    `- Date: ${formatScheduleDate(getCalendarEventDateKey(event))}`,
    `- Time: ${event.endTime ? `${event.time} - ${event.endTime}` : event.time}`,
    `- Place: ${event.location}`,
    '',
    'Tell me what to change, or say delete this schedule.',
  ].join('\n');
}

function formatScheduleUpdateSummary(event: CalendarEvent) {
  return [
    'The schedule update is ready:',
    '',
    `- Title: ${event.title}`,
    `- Date: ${formatScheduleDate(getCalendarEventDateKey(event))}`,
    `- Time: ${event.endTime ? `${event.time} - ${event.endTime}` : event.time}`,
    `- Place: ${event.location}`,
    '',
    'Use the button below to update the schedule.',
  ].join('\n');
}

function formatScheduleDeleteConfirmation(event: CalendarEvent) {
  return [
    `Deleted **${event.title}** from your calendar.`,
    '',
    `- Date: ${formatScheduleDate(getCalendarEventDateKey(event))}`,
    `- Time: ${event.endTime ? `${event.time} - ${event.endTime}` : event.time}`,
    `- Place: ${event.location}`,
  ].join('\n');
}
function applySingleFieldFallback(previousDraft: ScheduleDraft | null, nextDraft: ScheduleDraft, message: string): ScheduleDraft {
  const missingBefore = getMissingScheduleFields(previousDraft ?? {});
  const directAnswer = message.trim().replace(/[.;]+$/g, '');
  if (!directAnswer || missingBefore.length !== 1) return nextDraft;

  const [field] = missingBefore;
  if (field === 'title' && !nextDraft.title) return { ...nextDraft, title: directAnswer };
  if (field === 'place' && !nextDraft.place) return { ...nextDraft, place: directAnswer };
  return nextDraft;
}

export default function Chatbot({ embedded = false, defaultOpen = false, className }: ChatbotProps) {
  const events = useAppStore((state) => state.events);
  const addEvent = useAppStore((state) => state.addEvent);
  const updateEvent = useAppStore((state) => state.updateEvent);
  const deleteEvent = useAppStore((state) => state.deleteEvent);
  const addRecentAction = useAppStore((state) => state.addRecentAction);
  const setActiveWeek = useCalendarViewStore((state) => state.setActiveWeek);
  const [isOpen, setIsOpen] = useState(embedded || defaultOpen);
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'assistant', content: 'Hello Michael. I can help with MB Sense battery predictions, charging windows, and schedule-aware mobility planning.' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [highThinking, setHighThinking] = useState(false);
  const [voiceAnswers, setVoiceAnswers] = useState(false);
  const [voiceAnswerSupported, setVoiceAnswerSupported] = useState(() => getSpeechAnswerSupported());
  const [pendingSchedule, setPendingSchedule] = useState<ScheduleDraft | null>(null);
  const [pendingScheduleUpdate, setPendingScheduleUpdate] = useState<CalendarEvent | null>(null);
  const [voiceListening, setVoiceListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(() => Boolean(getSpeechRecognitionConstructor()));
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalVoiceTranscriptRef = useRef('');
  const latestVoiceTranscriptRef = useRef('');
  const loadingRef = useRef(false);
  const voiceAnswersRef = useRef(false);
  const shouldSubmitVoiceTranscriptRef = useRef(true);
  const closingVoiceRecognitionRef = useRef(false);

  function closeVoiceRecognition(mode: 'stop' | 'abort' = 'abort', shouldSubmitTranscript = false, updateListeningState = true) {
    shouldSubmitVoiceTranscriptRef.current = shouldSubmitTranscript;
    const recognition = recognitionRef.current;
    if (updateListeningState) setVoiceListening(false);

    if (!recognition) {
      closingVoiceRecognitionRef.current = false;
      return;
    }

    if (closingVoiceRecognitionRef.current) return;
    closingVoiceRecognitionRef.current = true;

    try {
      if (mode === 'stop') recognition.stop();
      else recognition.abort();
    } catch (error) {
      console.error('Unable to close speech recognition', error);
      recognitionRef.current = null;
      closingVoiceRecognitionRef.current = false;
    }
  }

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    voiceAnswersRef.current = voiceAnswers;
    if (!voiceAnswers && getSpeechAnswerSupported()) window.speechSynthesis.cancel();
  }, [voiceAnswers]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  useEffect(() => {
    setVoiceSupported(Boolean(getSpeechRecognitionConstructor()));
    setVoiceAnswerSupported(getSpeechAnswerSupported());
    return () => {
      closeVoiceRecognition('abort', false, false);
      recognitionRef.current = null;
      if (getSpeechAnswerSupported()) window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    if (!isOpen && recognitionRef.current) closeVoiceRecognition('abort', false);
  }, [isOpen]);

  const speakAssistantText = (content: string) => {
    if (!voiceAnswersRef.current || !getSpeechAnswerSupported()) return;

    const text = formatVoiceAnswerText(content);
    if (!text) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.95;
    utterance.pitch = 1;
    utterance.volume = 1;
    window.speechSynthesis.speak(utterance);
  };

  const appendAssistantMessage = (content: string, options: Partial<Pick<Message, 'scheduleDraft' | 'scheduleStatus' | 'scheduleUpdate' | 'scheduleUpdateStatus'>> = {}) => {
    const message: Message = {
      id: createMessageId('assistant'),
      role: 'assistant',
      content,
      ...options,
    };

    setMessages((prev) => [...prev, message]);
    speakAssistantText(content);
    return message;
  };

  const buildUpdatedScheduleEvent = (currentEvent: CalendarEvent, draft: CompleteScheduleDraft) => {
    const predictedEvent = buildCalendarEventFromDraft(draft, events.filter((event) => event.id !== currentEvent.id));
    return {
      ...predictedEvent,
      id: currentEvent.id,
    };
  };

  const deleteMatchedSchedule = (event: CalendarEvent) => {
    deleteEvent(event.id);
    setPendingSchedule(null);
    setPendingScheduleUpdate(null);
    setActiveWeek(event.date instanceof Date ? event.date : new Date(event.date));
    addRecentAction({
      icon: 'event',
      title: 'Schedule Deleted',
      description: `${event.title} removed`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    appendAssistantMessage(formatScheduleDeleteConfirmation(event));
  };

  const prepareScheduleUpdate = (currentEvent: CalendarEvent, userMsg: string) => {
    const currentDraft = eventToScheduleDraft(currentEvent);
    const nextDraft = mergeScheduleDraft(currentDraft, userMsg);

    if (!scheduleDraftHasChanges(currentDraft, nextDraft)) {
      appendAssistantMessage(formatCalendarEventDetails(currentEvent));
      return true;
    }

    const completeDraft = completeScheduleDraft(nextDraft);
    if (!completeDraft) {
      appendAssistantMessage(`${formatMissingScheduleQuestion(getMissingScheduleFields(nextDraft))}${formatKnownDraftDetails(nextDraft)}`);
      return true;
    }

    const updatedEvent = buildUpdatedScheduleEvent(currentEvent, completeDraft);
    setPendingSchedule(null);
    setPendingScheduleUpdate(null);
    appendAssistantMessage(formatScheduleUpdateSummary(updatedEvent), {
      scheduleUpdate: updatedEvent,
      scheduleUpdateStatus: 'ready',
    });
    return true;
  };

  const handleScheduleUpdateMessage = (userMsg: string) => {
    if (pendingScheduleUpdate) {
      if (hasScheduleDeleteIntent(userMsg)) {
        deleteMatchedSchedule(pendingScheduleUpdate);
        return true;
      }

      if (hasScheduleDetailChange(userMsg)) return prepareScheduleUpdate(pendingScheduleUpdate, userMsg);

      appendAssistantMessage(formatCalendarEventDetails(pendingScheduleUpdate));
      return true;
    }

    if (!hasScheduleModifyIntent(userMsg)) return false;

    const matchedEvent = findBestScheduleMatch(events, userMsg);
    if (!matchedEvent) {
      if (!hasScheduleReference(userMsg)) return false;
      appendAssistantMessage('Please input the schedule title, date, time, or place so I can find the existing schedule you want to change or delete.');
      return true;
    }

    setPendingSchedule(null);

    if (hasScheduleDeleteIntent(userMsg)) {
      deleteMatchedSchedule(matchedEvent);
      return true;
    }

    const currentDraft = eventToScheduleDraft(matchedEvent);
    const nextDraft = mergeScheduleDraft(currentDraft, userMsg);
    if (hasScheduleDetailChange(userMsg) && scheduleDraftHasChanges(currentDraft, nextDraft)) {
      return prepareScheduleUpdate(matchedEvent, userMsg);
    }

    setPendingScheduleUpdate(matchedEvent);
    appendAssistantMessage(formatCalendarEventDetails(matchedEvent));
    return true;
  };
  const handleScheduleMessage = (userMsg: string) => {
    if (!pendingSchedule && !isScheduleIntent(userMsg)) return false;

    if (!pendingSchedule) setPendingScheduleUpdate(null);

    const parsedDraft = mergeScheduleDraft(pendingSchedule, userMsg);
    const nextDraft = applySingleFieldFallback(pendingSchedule, parsedDraft, userMsg);
    const missing = getMissingScheduleFields(nextDraft);

    if (missing.length) {
      setPendingSchedule(nextDraft);
      appendAssistantMessage(`${formatMissingScheduleQuestion(missing)}${formatKnownDraftDetails(nextDraft)}`);
      return true;
    }

    const completeDraft = completeScheduleDraft(nextDraft);
    if (!completeDraft) return false;

    setPendingSchedule(null);
    appendAssistantMessage(formatScheduleSummary(completeDraft), {
      scheduleDraft: completeDraft,
      scheduleStatus: 'ready',
    });
    return true;
  };

  const sendMessage = async (rawMessage: string) => {
    const userMsg = rawMessage.trim();
    if (!userMsg || loadingRef.current) return;

    setInput('');
    setMessages((prev) => [...prev, { id: createMessageId('user'), role: 'user', content: userMsg }]);

    if (pendingScheduleUpdate && handleScheduleUpdateMessage(userMsg)) return;
    if (pendingSchedule && handleScheduleMessage(userMsg)) return;
    if (handleScheduleUpdateMessage(userMsg)) return;
    if (handleScheduleMessage(userMsg)) return;

    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          usePro: highThinking,
          history: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
        })
      });

      const data = await res.json();
      if (data.text) {
        appendAssistantMessage(data.text);
      }
    } catch (err) {
      console.error(err);
      appendAssistantMessage("I'm having trouble connecting to the MB Sense AI service right now.");
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (e: FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const startVoiceInput = () => {
    if (voiceListening) {
      closeVoiceRecognition('stop', true);
      return;
    }

    if (loadingRef.current) return;

    const Recognition = getSpeechRecognitionConstructor();
    if (!Recognition) {
      setVoiceSupported(false);
      appendAssistantMessage('Voice typing is not supported in this browser. You can still type your message normally.');
      return;
    }

    try {
      const recognition = new Recognition();
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      shouldSubmitVoiceTranscriptRef.current = true;
      closingVoiceRecognitionRef.current = false;
      finalVoiceTranscriptRef.current = '';
      latestVoiceTranscriptRef.current = '';

      recognition.onstart = () => {
        setVoiceListening(true);
      };

      recognition.onresult = (event) => {
        let interimTranscript = '';
        let receivedFinalTranscript = false;

        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          const transcript = result[0]?.transcript ?? '';
          if (result.isFinal) {
            finalVoiceTranscriptRef.current = normalizeTranscript(`${finalVoiceTranscriptRef.current} ${transcript}`);
            receivedFinalTranscript = true;
          } else {
            interimTranscript = normalizeTranscript(`${interimTranscript} ${transcript}`);
          }
        }

        const visibleTranscript = normalizeTranscript(`${finalVoiceTranscriptRef.current} ${interimTranscript}`);
        latestVoiceTranscriptRef.current = visibleTranscript;
        if (visibleTranscript) setInput(visibleTranscript);
        if (receivedFinalTranscript) closeVoiceRecognition('stop', true);
      };
      recognition.onerror = (event) => {
        if (!closingVoiceRecognitionRef.current) console.error('Speech recognition error', event.error ?? event.message ?? event);
        closeVoiceRecognition('abort', false);
      };

      recognition.onend = () => {
        const spokenMessage = normalizeTranscript(finalVoiceTranscriptRef.current || latestVoiceTranscriptRef.current);
        const shouldSubmitTranscript = shouldSubmitVoiceTranscriptRef.current;
        finalVoiceTranscriptRef.current = '';
        latestVoiceTranscriptRef.current = '';
        recognitionRef.current = null;
        closingVoiceRecognitionRef.current = false;
        shouldSubmitVoiceTranscriptRef.current = true;
        setVoiceListening(false);
        if (shouldSubmitTranscript && spokenMessage) void sendMessage(spokenMessage);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (error) {
      console.error('Unable to start speech recognition', error);
      recognitionRef.current = null;
      closingVoiceRecognitionRef.current = false;
      finalVoiceTranscriptRef.current = '';
      latestVoiceTranscriptRef.current = '';
      setVoiceListening(false);
    }
  };

  const handlePutInCalendar = (messageId: string, draft: CompleteScheduleDraft) => {
    const event = buildCalendarEventFromDraft(draft, events);
    addEvent(event);
    setActiveWeek(event.date);
    addRecentAction({
      icon: 'event',
      title: 'Schedule Added',
      description: `${event.title} at ${event.time}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    const confirmation = `Done. I put **${event.title}** in your calendar for ${formatScheduleDate(draft.date)} at ${formatScheduleTimeRange(draft)}.`;
    setMessages((prev) => [
      ...prev.map((message) => message.id === messageId ? { ...message, scheduleStatus: 'added' as const } : message),
      {
        id: createMessageId('assistant'),
        role: 'assistant',
        content: confirmation,
      },
    ]);
    speakAssistantText(confirmation);
  };

  const handleUpdateSchedule = (messageId: string, event: CalendarEvent) => {
    updateEvent(event);
    setPendingScheduleUpdate(null);
    setActiveWeek(event.date instanceof Date ? event.date : new Date(event.date));
    addRecentAction({
      icon: 'event',
      title: 'Schedule Updated',
      description: `${event.title} at ${event.time}`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });

    const confirmation = `Done. I updated **${event.title}** in your calendar for ${formatScheduleDate(getCalendarEventDateKey(event))} at ${event.endTime ? `${event.time} - ${event.endTime}` : event.time}.`;
    setMessages((prev) => [
      ...prev.map((message) => message.id === messageId ? { ...message, scheduleUpdateStatus: 'updated' as const } : message),
      {
        id: createMessageId('assistant'),
        role: 'assistant',
        content: confirmation,
      },
    ]);
    speakAssistantText(confirmation);
  };
  const lastReadyScheduleMessageId = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.scheduleDraft && message.scheduleStatus === 'ready')?.id;
  const lastReadyScheduleUpdateMessageId = [...messages]
    .reverse()
    .find((message) => message.role === 'assistant' && message.scheduleUpdate && message.scheduleUpdateStatus === 'ready')?.id;

  const chatPanel = (
    <motion.div
      initial={{ opacity: 0, y: embedded ? 12 : 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: embedded ? 12 : 100 }}
      className={cn(
        'flex flex-col overflow-hidden border border-outline-variant/45 bg-surface-container-lowest shadow-ambient-lg',
        embedded ? 'h-full min-h-[520px] rounded-3xl' : 'fixed bottom-24 right-4 z-[70] h-[min(560px,calc(100dvh-7rem))] w-[calc(100vw-2rem)] max-w-[400px] rounded-3xl sm:bottom-24 sm:right-6',
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-outline-variant/45 bg-surface-container-low px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/25 bg-primary/10">
            <AiLogo className="h-6 w-6" />
          </div>
          <div>
            <h3 className="font-bold uppercase leading-tight tracking-wide text-on-surface">MB Sense Assistant</h3>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Online</span>
            </div>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-outline-variant/45 bg-surface-container-lowest text-slate-400 transition hover:text-on-surface" aria-label="Close chatbot">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-5 pb-20">
        {messages.map((m) => (
          <div key={m.id} className={cn('flex w-full flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
            <div
              className={cn(
                'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                m.role === 'user' ? 'rounded-tr-sm bg-primary text-on-primary' : 'markdown-body rounded-tl-sm border border-outline-variant/45 bg-surface-container-low text-on-surface'
              )}
            >
              {m.role === 'user' ? m.content : <Markdown>{m.content}</Markdown>}
            </div>
            {m.id === lastReadyScheduleMessageId && m.scheduleDraft && m.scheduleStatus === 'ready' && (
              <button
                type="button"
                onClick={() => handlePutInCalendar(m.id, m.scheduleDraft!)}
                className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/25 bg-primary px-4 text-xs font-black uppercase tracking-wider text-on-primary shadow-ambient transition active:scale-[0.98]"
              >
                <CalendarPlus className="h-4 w-4" />
                Put in your calendar
              </button>
            )}
            {m.id === lastReadyScheduleUpdateMessageId && m.scheduleUpdate && m.scheduleUpdateStatus === 'ready' && (
              <button
                type="button"
                onClick={() => handleUpdateSchedule(m.id, m.scheduleUpdate!)}
                className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl border border-primary/25 bg-primary px-4 text-xs font-black uppercase tracking-wider text-on-primary shadow-ambient transition active:scale-[0.98]"
              >
                <CalendarPlus className="h-4 w-4" />
                Update schedule
              </button>
            )}
            {m.scheduleUpdateStatus === 'updated' && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs font-black uppercase tracking-wider text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Updated schedule
              </div>
            )}
            {m.scheduleStatus === 'added' && (
              <div className="mt-2 inline-flex items-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-500/10 px-3 py-2 text-xs font-black uppercase tracking-wider text-emerald-600">
                <CheckCircle2 className="h-4 w-4" />
                Added to calendar
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex w-full justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border border-outline-variant/45 bg-surface-container-low px-4 py-3 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              Processing...
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-outline-variant/45 bg-surface-container-low p-4">
        <form onSubmit={handleSend} className="relative">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 transition-colors hover:text-amber-500">
              <input type="checkbox" className="sr-only" checked={highThinking} onChange={(e) => setHighThinking(e.target.checked)} />
              <div className={cn('flex h-3 w-3 items-center justify-center rounded border transition-all', highThinking ? 'border-amber-500 bg-amber-500' : 'border-outline-variant bg-surface-container-lowest')}>
                {highThinking && <div className="h-1.5 w-1.5 rounded-sm bg-on-surface" />}
              </div>
              High Thinking
            </label>
            <label className={cn('flex cursor-pointer items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors', voiceAnswerSupported ? 'text-slate-400 hover:text-primary' : 'cursor-not-allowed text-slate-500 opacity-60')}>
              <input type="checkbox" className="sr-only" checked={voiceAnswers} disabled={!voiceAnswerSupported} onChange={(e) => setVoiceAnswers(e.target.checked)} />
              <div className={cn('flex h-3 w-3 items-center justify-center rounded border transition-all', voiceAnswers ? 'border-primary bg-primary' : 'border-outline-variant bg-surface-container-lowest')}>
                {voiceAnswers && <div className="h-1.5 w-1.5 rounded-sm bg-on-primary" />}
              </div>
              <Volume2 className="h-3.5 w-3.5" />
              Prefer voice answer
            </label>
          </div>
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={voiceListening ? 'Listening...' : 'Ask about charging predictions or schedule something...'}
              className="w-full rounded-xl border border-outline-variant/55 bg-surface-container-lowest py-3 pl-4 pr-24 text-sm text-on-surface transition-colors placeholder:text-slate-500 focus:border-primary/50 focus:outline-none"
            />
            <div className="absolute bottom-2 right-2 flex items-center gap-1">
              <button
                type="button"
                onClick={startVoiceInput}
                disabled={!voiceSupported || loading}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:text-primary-dim disabled:opacity-40',
                  voiceListening && 'bg-primary text-on-primary hover:text-on-primary'
                )}
                aria-label={voiceListening ? 'Stop voice input' : 'Start voice input'}
                title={voiceSupported ? 'Voice input' : 'Voice input is not supported in this browser'}
              >
                <Mic className="h-4 w-4" />
              </button>
              <button type="submit" disabled={!input.trim() || loading} className="flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:text-primary-dim disabled:opacity-50" aria-label="Send message">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </motion.div>
  );

  if (embedded) {
    return (
      <div className={cn('h-full', className)}>
        <AnimatePresence mode="wait">
          {isOpen ? (
            chatPanel
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex h-full min-h-[520px] flex-col items-center justify-center rounded-3xl border border-outline-variant/45 bg-surface-container-lowest p-8 text-center shadow-ambient-lg">
              <MessageSquare className="mb-4 h-10 w-10 text-primary" />
              <h3 className="text-2xl font-black text-on-surface">Chat closed</h3>
              <p className="mt-2 max-w-sm text-sm font-semibold leading-relaxed text-slate-500">Open the MB Sense assistant when you need prediction or charging guidance.</p>
              <button onClick={() => setIsOpen(true)} className="mt-6 rounded-2xl bg-primary px-5 py-3 text-sm font-black text-on-primary active:scale-95">
                Open chat
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <>
      {!isOpen && (
        <button onClick={() => setIsOpen(true)} className="fixed bottom-24 right-6 z-[60] sm:bottom-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary text-on-primary shadow-ambient-lg transition-all hover:bg-primary-dim active:scale-95" aria-label="Open AI assistant">
          <AiLogo className="h-11 w-11" inverted />
        </button>
      )}

      <AnimatePresence>{isOpen && chatPanel}</AnimatePresence>
    </>
  );
}

function normalizeTranscript(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}
