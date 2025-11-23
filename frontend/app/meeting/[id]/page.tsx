'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Navigation from '@/components/Navigation';
import { meetingsAPI } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { detectUrgency, getUrgencyStyles } from '@/lib/urgency-detector';
import { Calendar, FileText, CheckCircle, AlertCircle, Loader2, Download, Check, FileDown, Circle, CheckCircle2 } from 'lucide-react';
import { exportMeetingToPDF } from '@/lib/export';
import { useToast } from '@/components/Toast';

export default function MeetingDetailPage() {
  const router = useRouter();
  const params = useParams();
  const jobId = params.id as string;
  const { user, loading } = useAuth();
  const toast = useToast();
  const [meeting, setMeeting] = useState<any>(null);
  const [loadingMeeting, setLoadingMeeting] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
    } else if (user && jobId) {
      loadMeeting();
    }
  }, [user, loading, jobId, router]);

  const loadMeeting = async () => {
    try {
      const data = await meetingsAPI.getMeetingDetails(jobId);
      setMeeting(data);
    } catch (error) {
      console.error('Failed to load meeting:', error);
      alert('Meeting not found');
      router.push('/history');
    } finally {
      setLoadingMeeting(false);
    }
  };

  const handleSyncCalendar = async () => {
    if (!user?.calendar_connected) {
      alert('Please connect your calendar in Settings first');
      return;
    }

    if (meeting?.calendar_synced) {
      alert('This meeting has already been synced to calendar');
      return;
    }

    setSyncing(true);
    try {
      await meetingsAPI.syncToCalendar(jobId);
      alert('Events synced to calendar successfully!');
      // Reload meeting to get updated sync status
      await loadMeeting();
    } catch (error: any) {
      console.error('Calendar sync failed:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to sync to calendar';
      alert(errorMessage);
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleCompletion = async (noteId: number, currentCompleted: boolean) => {
    try {
      const newCompletedState = !currentCompleted;
      await meetingsAPI.toggleTaskCompletion(noteId, newCompletedState);

      // Update local state
      setMeeting((prev: any) => ({
        ...prev,
        notes: prev.notes.map((note: any) =>
          note.id === noteId ? { ...note, completed: newCompletedState } : note
        )
      }));

      if (newCompletedState) {
        toast.success('Note marked as completed');
      } else {
        toast.info('Note marked as incomplete');
      }
    } catch (error) {
      console.error('Failed to toggle completion:', error);
      toast.error('Failed to update completion status');
    }
  };

  if (loading || loadingMeeting) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!meeting) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Meeting Analysis</h1>
              <p className="text-gray-600 mt-2">{formatDate(meeting.created_at)}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => exportMeetingToPDF(meeting)}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                title="Export to PDF"
              >
                <FileDown className="w-4 h-4" />
                <span className="hidden sm:inline">Export PDF</span>
              </button>
              {meeting?.calendar_synced ? (
                <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-md border border-green-300">
                  <Check className="w-4 h-4" />
                  Synced to Calendar
                </div>
              ) : (
                <button
                  onClick={handleSyncCalendar}
                  disabled={syncing || !user?.calendar_connected}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {syncing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Calendar className="w-4 h-4" />
                  )}
                  Sync to Calendar
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Key Takeaways / Summary */}
            {(meeting.key_takeaways || meeting.final_summary) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-indigo-600" />
                  Key Takeaways
                </h2>
                <div className="space-y-4">
                  {(() => {
                    const summary = meeting.key_takeaways || meeting.final_summary;
                    const englishText = summary?.english;
                    const arabicText = summary?.arabic || summary?.original_language;

                    return (
                      <>
                        {englishText && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">English</h3>
                            <div className="prose prose-sm max-w-none text-gray-900">
                              {englishText.split('\n').map((line: string, i: number) => (
                                <p key={i} className="mb-2">
                                  {line}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                        {arabicText && arabicText !== englishText && (
                          <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">
                              Arabic
                            </h3>
                            <div className="prose prose-sm max-w-none text-gray-900" dir="rtl">
                              {arabicText
                                .split('\n')
                                .map((line: string, i: number) => (
                                  <p key={i} className="mb-2">
                                    {line}
                                  </p>
                                ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Transcript */}
            {meeting.raw_transcript && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4">Full Transcript</h2>
                <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm text-gray-800">
                    {meeting.raw_transcript}
                  </pre>
                </div>
              </div>
            )}

            {/* Additional Analysis Result - Only show if user provided custom input */}
            {meeting.user_input && meeting.user_input_result && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  Additional Analysis
                </h2>
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                  <p className="text-sm text-gray-700 mb-3 font-medium">
                    Question: {meeting.user_input}
                  </p>
                  <div className="text-gray-900 whitespace-pre-wrap">
                    {meeting.user_input_result.content || meeting.user_input_result.description}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Events */}
            {meeting.dated_events && meeting.dated_events.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  Events ({meeting.dated_events.length})
                </h3>
                <div className="space-y-4">
                  {meeting.dated_events.map((event: any, index: number) => {
                    // Handle both old and new field names
                    const title = event.title || event.task;
                    const date = event.date || event.due_date;
                    const formattedDate = event.formatted_date;
                    const description = event.description || event.context;

                    return (
                      <div key={index} className="border-l-4 border-indigo-500 pl-3 py-2">
                        <p className="text-sm font-semibold text-gray-900">{title}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          📅 {formattedDate || date || 'TBD'}
                        </p>
                        <p className="text-xs text-gray-600">
                          👤 {event.assignee || 'Unassigned'}
                        </p>
                        {description && (
                          <p className="text-xs text-gray-600 mt-2">{description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Notes */}
            {meeting.notes && meeting.notes.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  Notes ({meeting.notes.length})
                </h3>
                <div className="space-y-4">
                  {meeting.notes.map((note: any, index: number) => {
                    // Handle both old and new field names
                    const category = note.category || note.note_type || 'GENERAL';
                    const description = note.description || note.details;
                    const urgency = detectUrgency(note.title);
                    const styles = getUrgencyStyles(urgency.level);

                    // Determine border color based on completion and urgency
                    const borderColor = note.completed
                      ? 'border-green-500'
                      : urgency.isUrgent
                      ? styles.border.replace('border-', 'border-')
                      : category === 'BUDGET' || category === 'BUDGET_REQUEST'
                      ? 'border-green-500'
                      : category === 'DECISION'
                      ? 'border-blue-500'
                      : 'border-yellow-500';

                    const bgClass = note.completed
                      ? ''
                      : urgency.isUrgent
                      ? styles.cardBg
                      : '';

                    return (
                      <div
                        key={note.id || index}
                        className={`border-l-4 ${borderColor} pl-3 py-2 ${bgClass} ${note.completed ? 'opacity-75' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-medium text-gray-600 uppercase">
                                {category.replace(/_/g, ' ')}
                              </p>
                              <div className="flex items-center gap-1">
                                {note.completed && (
                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium flex-shrink-0">
                                    ✓ Done
                                  </span>
                                )}
                                {!note.completed && urgency.isUrgent && (
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${styles.badge}`}>
                                    {styles.icon} {urgency.level.toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className={`text-sm font-semibold text-gray-900 mt-1 ${note.completed ? 'line-through' : ''}`}>
                              {note.title}
                            </p>
                            {description && (
                              <p className="text-xs text-gray-600 mt-2">{description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
