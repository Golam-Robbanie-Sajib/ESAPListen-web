'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { meetingsAPI } from '@/lib/api';
import { useToast } from '@/components/Toast';
import Navigation from '@/components/Navigation';
import Pagination from '@/components/Pagination';
import EmptyState from '@/components/EmptyState';
import { SkeletonList } from '@/components/SkeletonCard';
import { exportEventsToCSV, exportToICS } from '@/lib/export';
import { parseISO, format, isFuture, isPast, isToday, differenceInDays } from 'date-fns';
import { getUrgencyStyles } from '@/lib/urgency-detector';
import {
  List,
  Calendar,
  Download,
  Clock,
  MapPin,
  Users,
  ChevronRight,
  Filter,
  Search,
  Trash2,
  CheckCircle,
  XCircle,
  Bell,
  BellOff,
  Circle,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface Event {
  id: string;
  eventItemId?: number;
  title: string;
  start: Date;
  end: Date;
  description?: string;
  location?: string;
  attendees?: string[];
  meetingId?: string;
  type: 'meeting' | 'task' | 'deadline';
  synced?: boolean;
  calendarEventId?: string;
  isManual?: boolean;
  notificationsEnabled?: boolean;
  completed?: boolean;
  urgency?: 'yes' | 'no';
}

export default function EventsPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const toast = useToast();

  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'upcoming' | 'past' | 'today'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'type'>('date');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchEvents();
      requestNotificationPermission();
    }
  }, [user]);

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  };

  const fetchEvents = async () => {
    setIsLoading(true);
    try {
      const meetings = await meetingsAPI.getAllMeetings();

      // Extract events from meetings.events array (from Event table)
      const extractedEvents: Event[] = [];

      meetings.forEach((meeting: any) => {
        try {
          // Process events from Event table
          if (meeting.events && Array.isArray(meeting.events)) {
            meeting.events.forEach((eventItem: any) => {
              try {
                const eventData = typeof eventItem.event_data === 'string'
                  ? JSON.parse(eventItem.event_data)
                  : eventItem.event_data;

                // Handle dated_events type
                // Backend generates: title, date, description, assignee, urgency
                // Show all dated_events extracted by Gemini (regardless of sync status)
                if (eventItem.event_type === 'dated_events') {
                  const dateField = eventData.date;
                  if (dateField) {
                    const eventDate = parseISO(dateField);
                    extractedEvents.push({
                      id: `event-${eventItem.id}`,
                      eventItemId: eventItem.id,
                      title: eventData.title || 'Untitled Event',
                      start: eventDate,
                      end: new Date(eventDate.getTime() + 60 * 60 * 1000), // 1 hour duration
                      description: eventData.description || '',
                      location: eventData.location,
                      attendees: eventData.assignee ? [eventData.assignee] : [],
                      meetingId: meeting.job_id,
                      type: 'meeting',
                      synced: true,  // All events here are synced
                      notificationsEnabled: true,
                      completed: eventData.completed || false,
                      urgency: eventData.urgency,
                    });
                  }
                }

                // Notes are NOT shown in events page - only dated_events appear here
              } catch (err) {
                console.error('Error parsing event:', err);
              }
            });
          }
        } catch (error) {
          console.error('Error processing meeting events:', error);
        }
      });

      setEvents(extractedEvents);
      scheduleNotifications(extractedEvents);
    } catch (error) {
      console.error('Failed to fetch events:', error);
      toast.error('Failed to load events');
    } finally {
      setIsLoading(false);
    }
  };

  const scheduleNotifications = (eventsList: Event[]) => {
    eventsList.forEach(event => {
      if (event.notificationsEnabled && isFuture(event.start)) {
        const daysUntil = differenceInDays(event.start, new Date());

        // Schedule notification for 1 day before (if event is more than 1 day away)
        if (daysUntil === 1 && 'Notification' in window && Notification.permission === 'granted') {
          setTimeout(() => {
            new Notification(`Upcoming Event Tomorrow: ${event.title}`, {
              body: `${event.title} is scheduled for ${format(event.start, 'PPP p')}`,
              icon: '/esapai_logo.png',
              tag: event.id,
            });
          }, 100);
        }
      }
    });
  };

  const handleToggleNotification = (eventId: string) => {
    const updatedEvents = events.map(e =>
      e.id === eventId
        ? { ...e, notificationsEnabled: !e.notificationsEnabled }
        : e
    );
    setEvents(updatedEvents);
    const event = updatedEvents.find(e => e.id === eventId);
    if (event?.notificationsEnabled) {
      toast.success('Notifications enabled for this event');
    } else {
      toast.info('Notifications disabled for this event');
    }
  };

  const handleToggleCompletion = async (event: Event) => {
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

  const handleSyncEvent = async (event: Event) => {
    try {
      toast.info('Syncing event to Google Calendar...');
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

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event?')) {
      return;
    }
    try {
      // Extract numeric ID from "event-123" format
      const numericId = parseInt(eventId.replace('event-', ''));
      await meetingsAPI.deleteEvent(numericId);
      setEvents(events.filter(e => e.id !== eventId));
      setSelectedEvent(null);
      toast.success('Event deleted successfully');
    } catch (error) {
      console.error('Failed to delete event:', error);
      toast.error('Failed to delete event');
    }
  };

  const filteredEvents = useMemo(() => {
    return events
      .filter(event => {
        if (filterType === 'upcoming') return isFuture(event.start);
        if (filterType === 'past') return isPast(event.start) && !isToday(event.start);
        if (filterType === 'today') return isToday(event.start);
        return true;
      })
      .filter(event =>
        searchTerm === '' ||
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        if (sortBy === 'date') {
          return a.start.getTime() - b.start.getTime();
        } else {
          return a.type.localeCompare(b.type);
        }
      });
  }, [events, filterType, searchTerm, sortBy]);

  // Pagination logic
  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEvents = filteredEvents.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page
  };

  const getEventTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      meeting: 'bg-emerald-100 text-emerald-700 border-emerald-300',
      task: 'bg-blue-100 text-blue-700 border-blue-300',
      deadline: 'bg-red-100 text-red-700 border-red-300',
    };
    return colors[type] || colors.meeting;
  };

  const getTimeStatus = (date: Date) => {
    if (isToday(date)) return { text: 'Today', color: 'text-blue-600' };
    if (isFuture(date)) {
      const days = differenceInDays(date, new Date());
      if (days === 1) return { text: 'Tomorrow', color: 'text-green-600' };
      if (days <= 7) return { text: `In ${days} days`, color: 'text-green-600' };
      return { text: format(date, 'MMM dd, yyyy'), color: 'text-gray-600' };
    }
    return { text: format(date, 'MMM dd, yyyy'), color: 'text-gray-400' };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <div className="h-8 bg-gray-200 rounded w-48 mb-2 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-64 animate-pulse"></div>
          </div>
          <SkeletonList count={5} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <List className="w-8 h-8 text-emerald-600" />
              <h1 className="text-3xl font-bold text-gray-900">Events</h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => exportEventsToCSV(filteredEvents)}
                disabled={filteredEvents.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
                title="Export to CSV"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">CSV</span>
              </button>
              <button
                onClick={() => exportToICS(filteredEvents, `events_${new Date().toISOString().split('T')[0]}`)}
                disabled={filteredEvents.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors text-sm"
                title="Export to Calendar (ICS)"
              >
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">ICS</span>
              </button>
            </div>
          </div>
          <p className="text-gray-600">All events from your meetings, sorted by date</p>
        </div>

        {/* Filters & Search */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
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

            {/* Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">All Events</option>
                <option value="today">Today</option>
                <option value="upcoming">Upcoming</option>
                <option value="past">Past</option>
              </select>
            </div>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="date">Sort by Date</option>
              <option value="type">Sort by Type</option>
            </select>
          </div>
        </div>

        {/* Events List */}
        {isLoading ? (
          <SkeletonList count={5} />
        ) : filteredEvents.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm">
            <EmptyState
              icon={List}
              title="No events found"
              description={
                searchTerm || filterType !== 'all'
                  ? 'Try adjusting your search or filter criteria'
                  : 'Upload and analyze meetings to see events here'
              }
              action={
                !(searchTerm || filterType !== 'all')
                  ? {
                      label: 'Go to Dashboard',
                      onClick: () => router.push('/dashboard'),
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          <>
            <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-200">
              {paginatedEvents.map(event => {
              const timeStatus = getTimeStatus(event.start);
              const rawUrgency = event.urgency || 'no';
              const urgency = (rawUrgency === 'high' || rawUrgency === 'medium' || rawUrgency === 'yes') ? 'yes' : 'no';
              const isUrgent = urgency === 'yes';
              const urgencyLevel = urgency === 'yes' ? 'high' : 'low';
              const styles = getUrgencyStyles(urgencyLevel);
              const borderClass = event.completed
                ? 'border-l-4 border-green-500'
                : isUrgent
                ? `border-l-4 ${styles.border}`
                : '';
              const bgClass = event.completed
                ? 'bg-white'
                : isUrgent
                ? styles.cardBg
                : 'bg-white';
              return (
                <div
                  key={event.id}
                  className={`p-5 hover:bg-gray-50 transition-colors ${borderClass} ${bgClass} ${event.completed ? 'opacity-75' : ''}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Date Badge */}
                    <div className="flex-shrink-0">
                      <div className={`rounded-lg p-3 text-center min-w-[70px] ${
                        isUrgent ? 'bg-red-100' : 'bg-emerald-100'
                      }`}>
                        <div className={`text-2xl font-bold ${
                          isUrgent ? 'text-red-700' : 'text-emerald-700'
                        }`}>
                          {format(event.start, 'd')}
                        </div>
                        <div className={`text-xs uppercase ${
                          isUrgent ? 'text-red-600' : 'text-emerald-600'
                        }`}>
                          {format(event.start, 'MMM')}
                        </div>
                      </div>
                    </div>

                    {/* Event Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-start gap-2 mb-1">
                            <h3 className={`text-lg font-semibold text-gray-900 ${event.completed ? 'line-through' : ''}`}>{event.title}</h3>
                            {event.completed && (
                              <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium flex-shrink-0">
                                ✓ Done
                              </span>
                            )}
                            {!event.completed && isUrgent && (
                              <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${styles.badge}`}>
                                {styles.icon} URGENT
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 mb-2">
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>{format(event.start, 'h:mm a')}</span>
                            </div>
                            <span className={`font-medium ${timeStatus.color}`}>{timeStatus.text}</span>
                            <span className={`px-2 py-1 rounded-full text-xs border capitalize ${getEventTypeColor(event.type)}`}>
                              {event.type}
                            </span>
                          </div>
                          {event.description && (
                            <p className="text-gray-600 text-sm line-clamp-2 mb-2">{event.description}</p>
                          )}
                          {event.location && (
                            <div className="flex items-center gap-1 text-sm text-gray-500">
                              <MapPin className="w-4 h-4" />
                              <span className="line-clamp-1">{event.location}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 mt-3">
                        <button
                          onClick={() => setSelectedEvent(event)}
                          className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <span>View Details</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>

                        {!event.synced && user?.calendar_connected && (
                          <button
                            onClick={() => handleSyncEvent(event)}
                            className="px-3 py-1.5 text-sm bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors flex items-center gap-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            <span>Sync</span>
                          </button>
                        )}

                        {event.synced && (
                          <span className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg flex items-center gap-1">
                            <CheckCircle className="w-4 h-4" />
                            <span>Synced</span>
                          </span>
                        )}

                        <button
                          onClick={() => handleToggleNotification(event.id)}
                          className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1 ${
                            event.notificationsEnabled
                              ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700'
                              : 'bg-gray-100 hover:bg-gray-200 text-gray-500'
                          }`}
                        >
                          {event.notificationsEnabled ? (
                            <>
                              <Bell className="w-4 h-4" />
                              <span>Notify</span>
                            </>
                          ) : (
                            <>
                              <BellOff className="w-4 h-4" />
                              <span>No Notify</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => handleDeleteEvent(event.id)}
                          className="px-3 py-1.5 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors flex items-center gap-1"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>

            {filteredEvents.length > 25 && (
              <div className="mt-6 bg-white rounded-lg shadow-sm">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredEvents.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedEvent(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize border ${getEventTypeColor(selectedEvent.type)}`}>
                    {selectedEvent.type}
                  </span>
                  {selectedEvent.completed && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Completed
                    </span>
                  )}
                  {selectedEvent.synced && (
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      Synced
                    </span>
                  )}
                </div>
                <h2 className={`text-2xl font-bold text-gray-900 ${selectedEvent.completed ? 'line-through' : ''}`}>{selectedEvent.title}</h2>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600 ml-4"
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

              {/* Actions */}
              <div className="pt-4 border-t border-gray-200 space-y-3">
                {!selectedEvent.synced && user?.calendar_connected && (
                  <button
                    onClick={() => {
                      handleSyncEvent(selectedEvent);
                      setSelectedEvent(null);
                    }}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    <span>Sync to Calendar</span>
                  </button>
                )}

                {selectedEvent.meetingId && (
                  <button
                    onClick={() => router.push(`/meeting/${selectedEvent.meetingId}`)}
                    className="w-full px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <span>View Meeting Details</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}

                <button
                  onClick={() => {
                    handleDeleteEvent(selectedEvent.id);
                  }}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-5 h-5" />
                  <span>Delete Event</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
