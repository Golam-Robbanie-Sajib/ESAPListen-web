'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Navigation from '@/components/Navigation';
import Pagination from '@/components/Pagination';
import EmptyState from '@/components/EmptyState';
import { SkeletonList } from '@/components/SkeletonCard';
import { meetingsAPI } from '@/lib/api';
import { formatDate, truncate } from '@/lib/utils';
import { exportMeetingsToCSV } from '@/lib/export';
import { Calendar, FileText, Trash2, Check, Download } from 'lucide-react';

export default function HistoryPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loadingMeetings, setLoadingMeetings] = useState(true);
  const [sortBy, setSortBy] = useState<'date' | 'events'>('date');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
    } else if (user) {
      loadMeetings();
    }
  }, [user, loading, router]);

  const loadMeetings = async () => {
    try {
      const data = await meetingsAPI.getMeetings();
      setMeetings(data.meetings);
    } catch (error) {
      console.error('Failed to load meetings:', error);
    } finally {
      setLoadingMeetings(false);
    }
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Are you sure you want to delete this meeting?')) return;

    try {
      await meetingsAPI.deleteMeeting(jobId);
      setMeetings(meetings.filter((m) => m.job_id !== jobId));
    } catch (error) {
      console.error('Failed to delete meeting:', error);
      alert('Failed to delete meeting');
    }
  };

  const sortedMeetings = [...meetings].sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    return b.event_count - a.event_count;
  });

  // Pagination logic
  const totalPages = Math.ceil(sortedMeetings.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedMeetings = sortedMeetings.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <div className="h-8 bg-gray-200 rounded w-64 mb-2 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Meeting History</h1>
            <p className="text-gray-600 mt-2">
              {meetings.length} meeting{meetings.length !== 1 ? 's' : ''} analyzed
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => exportMeetingsToCSV(meetings)}
              disabled={meetings.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              title="Export to CSV"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export</span>
            </button>

            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="date">Date</option>
                <option value="events">Events Count</option>
              </select>
            </div>
          </div>
        </div>

        {loadingMeetings ? (
          <SkeletonList count={5} />
        ) : meetings.length === 0 ? (
          <div className="bg-white rounded-lg shadow">
            <EmptyState
              icon={FileText}
              title="No meetings yet"
              description="Upload your first meeting to get started"
              action={{
                label: 'Go to Dashboard',
                onClick: () => router.push('/dashboard'),
              }}
            />
          </div>
        ) : (
          <>
            <div className="grid gap-4">
              {paginatedMeetings.map((meeting) => (
              <div
                key={meeting.job_id}
                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6 cursor-pointer"
                onClick={() => router.push(`/meeting/${meeting.job_id}`)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        Meeting Analysis
                      </h3>
                      <span className="text-sm text-gray-500">
                        {formatDate(meeting.created_at)}
                      </span>
                    </div>

                    <p className="text-gray-600 text-sm mb-4">
                      {truncate(meeting.summary_preview, 200)}
                    </p>

                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{meeting.event_count} events</span>
                      </div>
                      {meeting.has_custom_query && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                          Custom Query
                        </span>
                      )}
                      {meeting.calendar_synced && (
                        <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Synced to Calendar
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(meeting.job_id);
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
            </div>

            {meetings.length > 10 && (
              <div className="mt-6 bg-white rounded-lg shadow">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={sortedMeetings.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
