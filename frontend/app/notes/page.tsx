'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { meetingsAPI } from '@/lib/api';
import { useToast } from '@/components/Toast';
import Navigation from '@/components/Navigation';
import Pagination from '@/components/Pagination';
import EmptyState from '@/components/EmptyState';
import { SkeletonGrid } from '@/components/SkeletonCard';
import { exportNotesToCSV } from '@/lib/export';
import { parseISO, format } from 'date-fns';
import { getUrgencyStyles } from '@/lib/urgency-detector';
import { StickyNote, Calendar, Tag, Search, ChevronRight, Filter, Plus, X, Download, AlertCircle, Trash2 } from 'lucide-react';

interface Note {
  id: string;
  title: string;
  description: string;
  category: string;
  date?: Date;
  meetingId: string;
  meetingTitle?: string;
  type?: string;
  completed?: boolean;
  urgency?: 'yes' | 'no';
}

export default function NotesPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const toast = useToast();

  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);
  const [newNoteData, setNewNoteData] = useState({
    title: '',
    description: '',
    category: 'GENERAL',
    meetingId: '',
  });
  const [meetings, setMeetings] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchNotes();
    }
  }, [user]);

  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      const meetingsData = await meetingsAPI.getAllMeetings();
      setMeetings(meetingsData); // Store meetings for dropdown

      // Extract notes from meetings.events array (from Event table)
      const extractedNotes: Note[] = [];

      meetingsData.forEach((meeting: any) => {
        try {
          const finalSummary = typeof meeting.final_summary === 'string'
            ? JSON.parse(meeting.final_summary)
            : meeting.final_summary;

          // First, collect all completed tasks from this meeting
          const completedTasks = new Set<string>();
          if (meeting.events && Array.isArray(meeting.events)) {
            meeting.events.forEach((eventItem: any) => {
              try {
                const eventData = typeof eventItem.event_data === 'string'
                  ? JSON.parse(eventItem.event_data)
                  : eventItem.event_data;
                if (eventItem.event_type === 'dated_events' && eventData.completed) {
                  completedTasks.add(eventData.title?.toLowerCase() || '');
                }
              } catch (err) {
                // Ignore parse errors for this pass
              }
            });
          }

          // Process notes from Event table
          if (meeting.events && Array.isArray(meeting.events)) {
            meeting.events.forEach((eventItem: any) => {
              try {
                const eventData = typeof eventItem.event_data === 'string'
                  ? JSON.parse(eventItem.event_data)
                  : eventItem.event_data;

                // Only process notes type events
                // Backend generates: category, title, description
                if (eventItem.event_type === 'notes') {
                  console.log(`[Notes] Processing note with data:`, eventData);

                  // Map backend category to frontend category names
                  let category = 'general';
                  const backendCategory = eventData.category;

                  if (backendCategory) {
                    const categoryUpper = backendCategory.toUpperCase();
                    if (categoryUpper === 'DECISION' || categoryUpper.includes('DECISION')) {
                      category = 'decision';
                    } else if (categoryUpper === 'BUDGET' || categoryUpper.includes('BUDGET')) {
                      category = 'budget';
                    } else if (categoryUpper === 'ACTION' || categoryUpper.includes('ACTION')) {
                      category = 'action';
                    } else {
                      category = 'general';
                    }
                  }

                  // Check if there's a related completed task
                  const noteTitle = eventData.title?.toLowerCase() || '';
                  const hasCompletedRelatedTask = completedTasks.has(noteTitle);

                  extractedNotes.push({
                    id: `note-${eventItem.id}`,
                    title: eventData.title || 'Untitled Note',
                    description: eventData.description || '',
                    category: category,
                    date: undefined, // Notes don't have dates in Gemini schema
                    meetingId: meeting.job_id,
                    meetingTitle: finalSummary.title || 'Meeting',
                    type: backendCategory,
                    completed: eventData.completed || hasCompletedRelatedTask,
                    urgency: eventData.urgency,
                  });

                  console.log(`[Notes] Created note with category: ${category} from backend category: ${backendCategory}`);
                }
              } catch (err) {
                console.error('Error parsing note:', err);
              }
            });
          }

        } catch (error) {
          console.error('Error processing meeting notes:', error);
        }
      });

      setNotes(extractedNotes);
    } catch (error) {
      console.error('Failed to fetch notes:', error);
      toast.error('Failed to load notes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNoteData.title.trim()) {
      toast.error('Please enter a note title');
      return;
    }
    if (!newNoteData.meetingId) {
      toast.error('Please select a meeting');
      return;
    }

    try {
      await meetingsAPI.createNote(newNoteData.meetingId, {
        title: newNoteData.title,
        description: newNoteData.description,
        category: newNoteData.category,
      });

      toast.success('Note created successfully!');
      setShowAddNoteModal(false);
      setNewNoteData({
        title: '',
        description: '',
        category: 'GENERAL',
        meetingId: '',
      });
      // Refresh notes
      fetchNotes();
    } catch (error) {
      console.error('Failed to create note:', error);
      toast.error('Failed to create note');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) {
      return;
    }
    try {
      // Extract numeric ID from "note-123" format
      const numericId = parseInt(noteId.replace('note-', ''));
      await meetingsAPI.deleteNote(numericId);
      setNotes(notes.filter(note => note.id !== noteId));
      toast.success('Note deleted successfully');
    } catch (error) {
      console.error('Failed to delete note:', error);
      toast.error('Failed to delete note');
    }
  };

  const categories = useMemo(() => {
    const cats = new Set(['all']);
    notes.forEach(note => cats.add(note.category));
    return Array.from(cats);
  }, [notes]);

  const filteredNotes = useMemo(() => {
    return notes
      .filter(note => selectedCategory === 'all' || note.category === selectedCategory)
      .filter(note =>
        searchTerm === '' ||
        note.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        note.description.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        // Sort by date if available, otherwise by meeting
        if (a.date && b.date) {
          return b.date.getTime() - a.date.getTime();
        }
        if (a.date) return -1;
        if (b.date) return 1;
        return 0;
      });
  }, [notes, selectedCategory, searchTerm]);

  // Pagination logic
  const totalPages = Math.ceil(filteredNotes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedNotes = filteredNotes.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      general: 'bg-gray-100 text-gray-700 border-gray-300',
      budget: 'bg-green-100 text-green-700 border-green-300',
      action: 'bg-blue-100 text-blue-700 border-blue-300',
      decision: 'bg-purple-100 text-purple-700 border-purple-300',
      technical: 'bg-orange-100 text-orange-700 border-orange-300',
      'follow-up': 'bg-yellow-100 text-yellow-700 border-yellow-300',
    };
    return colors[category] || colors.general;
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
          <SkeletonGrid count={6} />
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
              <StickyNote className="w-8 h-8 text-emerald-600" />
              <h1 className="text-3xl font-bold text-gray-900">Notes</h1>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => exportNotesToCSV(filteredNotes)}
                disabled={filteredNotes.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                title="Export to CSV"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
              <button
                onClick={() => setShowAddNoteModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">Add Note</span>
              </button>
            </div>
          </div>
          <p className="text-gray-600">All notes from your analyzed meetings</p>
        </div>

        {/* Category Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-5 h-5 text-gray-600" />
            <h3 className="font-medium text-gray-900">Categories</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors capitalize ${
                  selectedCategory === category
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category}
                {category !== 'all' && (
                  <span className="ml-2 text-sm opacity-75">
                    ({notes.filter(n => n.category === category).length})
                  </span>
                )}
                {category === 'all' && (
                  <span className="ml-2 text-sm opacity-75">
                    ({notes.length})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Notes Grid */}
        {isLoading ? (
          <SkeletonGrid count={6} />
        ) : filteredNotes.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm">
            <EmptyState
              icon={StickyNote}
              title="No notes found"
              description={
                searchTerm || selectedCategory !== 'all'
                  ? 'Try adjusting your search or filter criteria'
                  : 'Upload and analyze meetings to see notes here'
              }
              action={
                !(searchTerm || selectedCategory !== 'all')
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedNotes.map(note => {
              // Normalize urgency: handle old data (high/medium/low) and new data (yes/no)
              const rawUrgency = note.urgency || 'no';
              const urgency = (rawUrgency === 'high' || rawUrgency === 'medium' || rawUrgency === 'yes') ? 'yes' : 'no';
              const isUrgent = urgency === 'yes';
              const urgencyLevel = urgency === 'yes' ? 'high' : 'low';
              const styles = getUrgencyStyles(urgencyLevel);

              return (
              <div
                key={note.id}
                onClick={() => setSelectedNote(note)}
                className={`bg-white rounded-lg shadow-sm p-5 hover:shadow-md transition-shadow cursor-pointer border ${
                  note.completed
                    ? 'border-green-500 opacity-60'
                    : isUrgent
                    ? `border-l-4 ${styles.border} ${styles.cardBg}`
                    : 'border-gray-200 hover:border-emerald-500'
                }`}
              >
                {/* Category Badge */}
                <div className="flex items-center justify-between mb-3">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize border ${getCategoryColor(note.category)}`}>
                    <Tag className="w-3 h-3 inline mr-1" />
                    {note.category}
                  </span>
                  <div className="flex items-center gap-2">
                    {note.completed && (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-300">
                        ✓ Done
                      </span>
                    )}
                    {note.date && (
                      <div className="flex items-center text-xs text-gray-500">
                        <Calendar className="w-3 h-3 mr-1" />
                        {format(note.date, 'MMM dd')}
                      </div>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNote(note.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Delete note"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Title */}
                <div className="mb-2">
                  <div className="flex items-start gap-2 mb-1">
                    <h3 className={`flex-1 font-semibold text-gray-900 line-clamp-2 ${
                      note.completed ? 'line-through' : ''
                    }`}>{note.title}</h3>
                    {!note.completed && isUrgent && (
                      <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${styles.badge}`}>
                        {styles.icon} URGENT
                      </span>
                    )}
                  </div>
                </div>

                {/* Description */}
                <p className="text-gray-600 text-sm mb-3 line-clamp-3">{note.description}</p>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs text-gray-500 pt-3 border-t border-gray-100">
                  <span className="line-clamp-1">{note.meetingTitle}</span>
                  <ChevronRight className="w-4 h-4 flex-shrink-0" />
                </div>
              </div>
              );
            })}
            </div>

            {filteredNotes.length > 12 && (
              <div className="mt-6 bg-white rounded-lg shadow-sm">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredNotes.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Add Note Modal */}
      {showAddNoteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Add New Note</h2>
              <button
                onClick={() => setShowAddNoteModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Meeting Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Meeting
                </label>
                <select
                  value={newNoteData.meetingId}
                  onChange={(e) => setNewNoteData({ ...newNoteData, meetingId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="">Select a meeting...</option>
                  {meetings.map((meeting) => (
                    <option key={meeting.job_id} value={meeting.job_id}>
                      {format(new Date(meeting.created_at), 'MMM dd, yyyy')} - Meeting
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={newNoteData.category}
                  onChange={(e) => setNewNoteData({ ...newNoteData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  <option value="GENERAL">General</option>
                  <option value="BUDGET">Budget</option>
                  <option value="DECISION">Decision</option>
                </select>
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={newNoteData.title}
                  onChange={(e) => setNewNoteData({ ...newNoteData, title: e.target.value })}
                  placeholder="Enter note title..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {/* Description Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newNoteData.description}
                  onChange={(e) => setNewNoteData({ ...newNoteData, description: e.target.value })}
                  placeholder="Enter note description..."
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAddNoteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddNote}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  Add Note
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Note Detail Modal */}
      {selectedNote && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={() => setSelectedNote(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize border ${getCategoryColor(selectedNote.category)}`}>
                    {selectedNote.category}
                  </span>
                  {selectedNote.date && (
                    <div className="flex items-center text-sm text-gray-600">
                      <Calendar className="w-4 h-4 mr-1" />
                      {format(selectedNote.date, 'MMMM dd, yyyy')}
                    </div>
                  )}
                </div>
                <h2 className="text-2xl font-bold text-gray-900">{selectedNote.title}</h2>
              </div>
              <button
                onClick={() => setSelectedNote(null)}
                className="text-gray-400 hover:text-gray-600 ml-4"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-gray-700 whitespace-pre-wrap">{selectedNote.description}</p>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">From meeting:</p>
                <p className="font-medium text-gray-900 mb-4">{selectedNote.meetingTitle}</p>
                <button
                  onClick={() => router.push(`/meeting/${selectedNote.meetingId}`)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <span>View Full Meeting</span>
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
