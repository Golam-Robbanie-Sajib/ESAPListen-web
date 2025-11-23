'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { meetingsAPI } from '@/lib/api';
import Navigation from '@/components/Navigation';
import { MessageSquare, Calendar, Search, ExternalLink, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface QueryResult {
  meetingId: string;
  meetingDate: Date;
  question: string;
  answer: string;
  type: string; // Type from Gemini: summary, analysis, list, comparison, search, question
}

export default function QueriesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [queries, setQueries] = useState<QueryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/signin');
    } else if (user) {
      fetchQueries();
    }
  }, [user, authLoading, router]);

  const fetchQueries = async () => {
    setLoading(true);
    try {
      const meetings = await meetingsAPI.getAllMeetings();
      const allQueries: QueryResult[] = [];

      meetings.forEach((meeting: any) => {
        if (meeting.user_input && meeting.user_input_result) {
          const result = typeof meeting.user_input_result === 'string'
            ? JSON.parse(meeting.user_input_result)
            : meeting.user_input_result;

          allQueries.push({
            meetingId: meeting.job_id,
            meetingDate: new Date(meeting.created_at),
            question: meeting.user_input,
            answer: result.content || result.description || 'No answer available',
            type: result.type || 'analysis', // Gemini provides type: summary, analysis, list, etc.
          });
        }
      });

      // Sort by date (newest first)
      allQueries.sort((a, b) => b.meetingDate.getTime() - a.meetingDate.getTime());
      setQueries(allQueries);
    } catch (error) {
      console.error('Failed to fetch queries:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredQueries = queries.filter(
    (query) =>
      searchTerm === '' ||
      query.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      query.answer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
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
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <MessageSquare className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-900">Query History</h1>
          </div>
          <p className="text-gray-600">
            All your additional analysis queries and their results
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search queries and answers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Queries List */}
        {filteredQueries.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquare className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm ? 'No queries found' : 'No queries yet'}
            </h3>
            <p className="text-gray-600 mb-4">
              {searchTerm
                ? 'Try a different search term'
                : 'Start asking questions when processing meetings to see them here'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredQueries.map((query, index) => {
              // Map type to display label and color
              const typeConfig = {
                summary: { label: 'SUMMARY', color: 'bg-blue-100 text-blue-700' },
                analysis: { label: 'ANALYSIS', color: 'bg-purple-100 text-purple-700' },
                list: { label: 'LIST', color: 'bg-green-100 text-green-700' },
                comparison: { label: 'COMPARISON', color: 'bg-orange-100 text-orange-700' },
                search: { label: 'SEARCH', color: 'bg-indigo-100 text-indigo-700' },
                question: { label: 'QUESTION', color: 'bg-pink-100 text-pink-700' },
              };
              const config = typeConfig[query.type as keyof typeof typeConfig] || typeConfig.analysis;

              return (
                <div
                  key={index}
                  className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                >
                  {/* Meeting Info & Type Badge */}
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
                    <Calendar className="w-4 h-4" />
                    <span>{format(query.meetingDate, 'MMM dd, yyyy • h:mm a')}</span>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${config.color}`}>
                      {config.label}
                    </span>
                    <button
                      onClick={() => router.push(`/meeting/${query.meetingId}`)}
                      className="ml-auto text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                    >
                      View Meeting
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Query Input */}
                  <div className="mb-4">
                    <div className="text-xs font-semibold text-indigo-600 uppercase mb-1">
                      Additional Analysis
                    </div>
                    <div className="text-gray-600 text-sm">
                      {query.question.substring(0, 50)}
                      {query.question.length > 50 ? '...' : ''}
                    </div>
                  </div>

                  {/* Result */}
                  <div>
                    <div className="text-xs font-semibold text-emerald-600 uppercase mb-1">
                      Analyzed Information
                    </div>
                    <div className="text-gray-700 whitespace-pre-wrap bg-gray-50 p-4 rounded-md border border-gray-200">
                      {query.answer}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Stats */}
        {queries.length > 0 && (
          <div className="mt-8 text-center text-sm text-gray-500">
            Showing {filteredQueries.length} of {queries.length} queries
          </div>
        )}
      </div>
    </div>
  );
}
