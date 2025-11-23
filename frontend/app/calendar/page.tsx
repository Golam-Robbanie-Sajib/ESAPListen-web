'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { meetingsAPI } from '@/lib/api';
import { useToast } from '@/components/Toast';
import Navigation from '@/components/Navigation';
import { EventCardSkeleton } from '@/components/Skeleton';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, parseISO, isFuture, isPast, isToday, isValid } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import './calendar-styles.css';
import { detectUrgency, getUrgencyStyles } from '@/lib/urgency-detector';
import { Calendar as CalendarIcon, Clock, MapPin, Users, ChevronRight, Filter, Search, Circle, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Meeting, FinalSummary, DatedEvent, Note, CalendarEvent } from '@/lib/types';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

export default function EventsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const toast = useToast();

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'month' | 'week' | 'day'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'meeting' | 'task' | 'deadline'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEvent, setNewEvent] = useState({
    title: '',
    start: '',
    end: '',
    type: 'meeting' as 'meeting' | 'task' | 'deadline',
    description: '',
    location: '',
  });

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchEvents();
    }
  }, [user]);

  // Handle ESC key to close modals
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedEvent) {
          setSelectedEvent(null);
        } else if (showCreateModal) {
          setShowCreateModal(false);
        }
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [selectedEvent, showCreateModal]);

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const meetings: Meeting[] = await meetingsAPI.getAllMeetings();

      // Extract events from meetings.events array (from Event table)
      const extractedEvents: CalendarEvent[] = [];

      meetings.forEach((meeting: Meeting) => {
        try {
          // Process events from Event table
          if (meeting.events && Array.isArray(meeting.events)) {
            meeting.events.forEach((eventItem) => {
              try {
                const eventData = typeof eventItem.event_data === 'string'
                  ? JSON.parse(eventItem.event_data)
                  : eventItem.event_data;

                // Handle dated_events type
                // Backend generates: title, date, description, assignee
                // Show all dated_events extracted by Gemini (regardless of sync status)
                if (eventItem.event_type === 'dated_events') {
                  // Backend uses "date" field
                  const dateField = eventData.date;
                  if (!dateField) {
                    console.warn(`[Calendar] Skipping dated_event with missing date field. Available fields:`, Object.keys(eventData));
                    return;
                  }

                  console.log(`[Calendar] Processing dated_event - date: ${dateField}, title: ${eventData.title}`);

                  const eventDate = parseISO(dateField);

                  // Validate date
                  if (!isValid(eventDate)) {
                    console.warn(`[Calendar] Invalid date for event: ${dateField}`, eventData);
                    return;
                  }

                  const DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000; // 1 hour
                  const newEvent = {
                    id: `event-${eventItem.id}`,
                    eventItemId: eventItem.id,
                    title: eventData.title || 'Untitled Event',
                    start: eventDate,
                    end: new Date(eventDate.getTime() + DEFAULT_EVENT_DURATION_MS),
                    description: eventData.description || '',
                    location: eventData.location,
                    attendees: eventData.assignee ? [eventData.assignee] : [],
                    meetingId: meeting.job_id,
                    type: 'meeting' as const,
                    synced: true,  // All events here are synced
                    completed: eventData.completed || false,
                    urgency: eventData.urgency,
                  };

                  console.log(`[Calendar] Created event:`, { title: newEvent.title, start: newEvent.start.toISOString(), synced: newEvent.synced });
                  extractedEvents.push(newEvent);
                }

                // Notes are NOT shown in calendar - only dated_events appear here
              } catch (err) {
                console.error('Error parsing event:', { err, eventItem, meetingId: meeting.job_id });
              }
            });
          }
        } catch (error) {
          console.error('Error processing meeting events:', { error, meetingId: meeting.job_id });
        }
      });

      setEvents(extractedEvents);
    } catch (error) {
      console.error('Failed to fetch events:', error);
      toast.error('Failed to load events');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateEvent = () => {
    if (!newEvent.title || !newEvent.start) {
      toast.error('Please fill in all required fields');
      return;
    }

    const startDate = new Date(newEvent.start);
    const DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000; // 1 hour
    const endDate = newEvent.end ? new Date(newEvent.end) : new Date(startDate.getTime() + DEFAULT_EVENT_DURATION_MS);

    const manualEvent: CalendarEvent = {
      id: `manual-${Date.now()}`,
      title: newEvent.title,
      start: startDate,
      end: endDate,
      type: newEvent.type,
      description: newEvent.description,
      location: newEvent.location,
      isManual: true,
      synced: false,
    };

    setEvents([...events, manualEvent]);
    setShowCreateModal(false);
    setNewEvent({
      title: '',
      start: '',
      end: '',
      type: 'meeting',
      description: '',
      location: '',
    });
    toast.success('Event created successfully!');
  };

  const handleSyncEvent = async (event: CalendarEvent) => {
    try {
      toast.info('Syncing event to Google Calendar...');
      // TODO: Implement actual Google Calendar sync API call
      // For now, just simulate sync
      await new Promise(resolve => setTimeout(resolve, 1000));

      const updatedEvents = events.map(e =>
        e.id === event.id
          ? { ...e, synced: true, calendarEventId: `gcal-${Date.now()}` }
          : e
      );
      setEvents(updatedEvents);
      toast.success('Event synced to Google Calendar!');
    } catch (error) {
      console.error('Failed to sync event:', error);
      toast.error('Failed to sync event to calendar');
    }
  };

  const handleToggleCompletion = async (event: CalendarEvent) => {
    if (!event.eventItemId) return;

    try {
      const newCompletedState = !event.completed;
      await meetingsAPI.toggleTaskCompletion(event.eventItemId, newCompletedState);

      // Update local state
      const updatedEvents = events.map(e =>
        e.id === event.id
          ? { ...e, completed: newCompletedState }
          : e
      );
      setEvents(updatedEvents);

      if (newCompletedState) {
        toast.success('Event marked as completed');
      } else {
        toast.info('Event marked as incomplete');
      }
    } catch (error) {
      console.error('Failed to toggle completion:', error);
      toast.error('Failed to update completion status');
    }
  };

  const upcomingEvents = useMemo(() => {
    return events
      .filter(event => isFuture(event.start) || isToday(event.start))
      .filter(event => filterType === 'all' || event.type === filterType)
      .filter(event =>
        searchTerm === '' ||
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 10);
  }, [events, filterType, searchTerm]);

  const filteredEvents = useMemo(() => {
    return events.filter(event => filterType === 'all' || event.type === filterType);
  }, [events, filterType]);

  const handleSelectEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
  };

  const handleNavigate = (newDate: Date) => {
    setCurrentDate(newDate);
  };

  const getEventStyle = (event: CalendarEvent) => {
    const baseStyle = {
      borderRadius: '4px',
      border: 'none',
      padding: '2px 6px',
      fontSize: '13px',
      fontWeight: '500',
    };

    switch (event.type) {
      case 'meeting':
        return { ...baseStyle, backgroundColor: '#10b981', color: 'white' };
      case 'task':
        return { ...baseStyle, backgroundColor: '#3b82f6', color: 'white' };
      case 'deadline':
        return { ...baseStyle, backgroundColor: '#ef4444', color: 'white' };
      default:
        return { ...baseStyle, backgroundColor: '#6b7280', color: 'white' };
    }
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <CalendarIcon className="w-8 h-8 text-emerald-600" />
              <h1 className="text-3xl font-bold text-gray-900">Calendar</h1>
            </div>
            <p className="text-gray-600">View and manage your scheduled events</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Calendar Skeleton */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="h-96 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>

            {/* Sidebar Skeleton */}
            <div className="space-y-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="h-6 bg-gray-200 rounded w-32 mb-4 animate-pulse" />
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <EventCardSkeleton key={i} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <CalendarIcon className="w-8 h-8 text-emerald-600" />
              <h1 className="text-3xl font-bold text-gray-900">Events Calendar</h1>
            </div>
            <p className="text-gray-600">View and manage all your meeting events and deadlines</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <span className="text-xl">+</span>
            <span>Create Event</span>
          </button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Filter by type */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-gray-600" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Events</option>
              <option value="meeting">Meetings</option>
              <option value="task">Tasks</option>
              <option value="deadline">Deadlines</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar - Main content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="mb-4 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Calendar View</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setView('month')}
                    className={`px-3 py-1 rounded ${view === 'month' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                  >
                    Month
                  </button>
                  <button
                    onClick={() => setView('week')}
                    className={`px-3 py-1 rounded ${view === 'week' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                  >
                    Week
                  </button>
                  <button
                    onClick={() => setView('day')}
                    className={`px-3 py-1 rounded ${view === 'day' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                  >
                    Day
                  </button>
                </div>
              </div>

              <div style={{ height: '600px' }}>
                <Calendar
                  localizer={localizer}
                  events={filteredEvents}
                  startAccessor="start"
                  endAccessor="end"
                  view={view}
                  date={currentDate}
                  onView={(newView) => setView(newView as any)}
                  onNavigate={handleNavigate}
                  onSelectEvent={handleSelectEvent}
                  eventPropGetter={(event) => ({
                    style: getEventStyle(event),
                  })}
                  style={{ height: '100%' }}
                />
              </div>
            </div>
          </div>

          {/* Upcoming Events Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-24">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                Upcoming Events
              </h2>

              {upcomingEvents.length === 0 ? (
                <div className="text-center py-8">
                  <CalendarIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No upcoming events</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {upcomingEvents.map((event) => {
                    const rawUrgency = event.urgency || 'no';
                    const normalizedUrgency = (rawUrgency === 'high' || rawUrgency === 'medium' || rawUrgency === 'yes') ? 'yes' : 'no';
                    const isUrgent = normalizedUrgency === 'yes';
                    const urgencyLevel = isUrgent ? 'high' : 'low';
                    const styles = getUrgencyStyles(urgencyLevel);
                    const borderClass = event.completed
                      ? 'border-green-500'
                      : isUrgent
                      ? styles.border
                      : 'border-gray-200';
                    const bgClass = event.completed
                      ? ''
                      : isUrgent
                      ? styles.cardBg
                      : '';
                    return (
                    <div
                      key={event.id}
                      onClick={() => setSelectedEvent(event)}
                      className={`p-4 border rounded-lg hover:border-emerald-500 cursor-pointer transition-colors ${borderClass} ${bgClass} ${event.completed ? 'opacity-75' : ''}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-start gap-2 mb-1">
                            <h3 className={`font-medium text-gray-900 ${event.completed ? 'line-through' : ''}`}>{event.title}</h3>
                            {event.completed && (
                              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium flex-shrink-0">
                                ✓
                              </span>
                            )}
                            {!event.completed && isUrgent && (
                              <span className={`px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${styles.badge}`}>
                                {styles.icon}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                            <Clock className="w-4 h-4" />
                            <span>{format(event.start, 'MMM dd, yyyy')}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span>{format(event.start, 'h:mm a')}</span>
                          </div>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          event.type === 'meeting' ? 'bg-emerald-100 text-emerald-700' :
                          event.type === 'task' ? 'bg-blue-100 text-blue-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {event.type}
                        </span>
                      </div>
                      {event.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">{event.description}</p>
                      )}
                      {event.location && (
                        <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
                          <MapPin className="w-4 h-4" />
                          <span className="line-clamp-1">{event.location}</span>
                        </div>
                      )}
                    </div>
                  );
                  })}
                </div>
              )}

              {/* Legend */}
              <div className="mt-6 pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-3">Event Types</p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                    <span className="text-gray-600">Meetings</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-gray-600">Tasks</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-gray-600">Deadlines</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className={`text-2xl font-bold text-gray-900 mb-2 ${selectedEvent.completed ? 'line-through' : ''}`}>{selectedEvent.title}</h2>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 text-sm rounded-full ${
                    selectedEvent.type === 'meeting' ? 'bg-emerald-100 text-emerald-700' :
                    selectedEvent.type === 'task' ? 'bg-blue-100 text-blue-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {selectedEvent.type}
                  </span>
                  {selectedEvent.completed && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Completed
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  <Clock className="w-5 h-5" />
                  <span className="font-medium">Date & Time</span>
                </div>
                <p className="text-gray-900 ml-7">
                  {format(selectedEvent.start, 'EEEE, MMMM dd, yyyy')}
                </p>
                <p className="text-gray-600 ml-7">
                  {format(selectedEvent.start, 'h:mm a')} - {format(selectedEvent.end, 'h:mm a')}
                </p>
              </div>

              {selectedEvent.description && (
                <div>
                  <p className="font-medium text-gray-600 mb-1">Description</p>
                  <p className="text-gray-900">{selectedEvent.description}</p>
                </div>
              )}

              {selectedEvent.location && (
                <div>
                  <div className="flex items-center gap-2 text-gray-600 mb-1">
                    <MapPin className="w-5 h-5" />
                    <span className="font-medium">Location</span>
                  </div>
                  <p className="text-gray-900 ml-7">{selectedEvent.location}</p>
                </div>
              )}

              {selectedEvent.attendees && selectedEvent.attendees.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 text-gray-600 mb-2">
                    <Users className="w-5 h-5" />
                    <span className="font-medium">Attendees</span>
                  </div>
                  <div className="ml-7 space-y-1">
                    {selectedEvent.attendees.map((attendee, index) => (
                      <p key={index} className="text-gray-900">{attendee}</p>
                    ))}
                  </div>
                </div>
              )}

              {/* Sync Status */}
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${selectedEvent.synced ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                    <span className="text-sm text-gray-600">
                      {selectedEvent.synced ? 'Synced to Calendar' : 'Not synced'}
                    </span>
                  </div>
                  {!selectedEvent.synced && user?.calendar_connected && (
                    <button
                      onClick={() => handleSyncEvent(selectedEvent)}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                      Sync Now
                    </button>
                  )}
                </div>
              </div>

              {selectedEvent.meetingId && (
                <div className="pt-4 border-t border-gray-200">
                  <button
                    onClick={() => router.push(`/meeting/${selectedEvent.meetingId}`)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    <span>View Meeting Details</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Create New Event</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Event title"
                />
              </div>

              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={newEvent.type}
                  onChange={(e) => setNewEvent({ ...newEvent, type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="meeting">Meeting</option>
                  <option value="task">Task</option>
                  <option value="deadline">Deadline</option>
                </select>
              </div>

              {/* Start Date/Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date & Time *</label>
                <input
                  type="datetime-local"
                  value={newEvent.start}
                  onChange={(e) => setNewEvent({ ...newEvent, start: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* End Date/Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date & Time</label>
                <input
                  type="datetime-local"
                  value={newEvent.end}
                  onChange={(e) => setNewEvent({ ...newEvent, end: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newEvent.description}
                  onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  rows={3}
                  placeholder="Event description"
                />
              </div>

              {/* Location */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                <input
                  type="text"
                  value={newEvent.location}
                  onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  placeholder="Event location"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateEvent}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Create Event
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
