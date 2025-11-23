'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { meetingsAPI } from '@/lib/api';
import { useToast } from '@/components/Toast';
import Navigation from '@/components/Navigation';
import { getUrgencyStyles } from '@/lib/urgency-detector';
import { format } from 'date-fns';
import { TaskCardSkeleton, StatCardSkeleton } from '@/components/Skeleton';
import {
  CheckSquare,
  Circle,
  CheckCircle2,
  AlertCircle,
  Clock,
  Filter,
  Search,
  Loader2,
  Trash2
} from 'lucide-react';

interface Task {
  id: number;
  title: string;
  description?: string;
  date: Date;
  completed: boolean;
  type: string;
  category?: string;
  meetingId: string;
  urgency?: 'yes' | 'no';
}

export default function TasksPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const toast = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'pending' | 'completed'>('all');
  const [filterUrgency, setFilterUrgency] = useState<'all' | 'yes' | 'no'>('all');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (user) {
      fetchTasks();
    }
  }, [user]);

  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const meetings = await meetingsAPI.getAllMeetings();
      const allTasks: Task[] = [];

      meetings.forEach((meeting: any) => {
        if (meeting.events && Array.isArray(meeting.events)) {
          meeting.events.forEach((eventItem: any) => {
            try {
              const eventData = typeof eventItem.event_data === 'string'
                ? JSON.parse(eventItem.event_data)
                : eventItem.event_data;

              // Include both dated_events and notes as tasks
              if (eventItem.event_type === 'dated_events' || eventItem.event_type === 'notes') {
                const taskDate = eventItem.event_type === 'dated_events'
                  ? new Date(eventData.date)
                  : new Date(meeting.created_at);

                allTasks.push({
                  id: eventItem.id,
                  title: eventData.title || 'Untitled Task',
                  description: eventData.description || eventData.details,
                  date: taskDate,
                  completed: eventData.completed || false,
                  type: eventItem.event_type,
                  category: eventData.category || eventData.note_type,
                  meetingId: meeting.job_id,
                  urgency: eventData.urgency,
                });
              }
            } catch (err) {
              console.error('Error parsing task:', err);
            }
          });
        }
      });

      // Sort tasks: urgent first, then by completion status, then by date
      allTasks.sort((a, b) => {
        // First, sort by urgency (normalize old values first)
        const aRawUrgency = a.urgency || 'no';
        const bRawUrgency = b.urgency || 'no';
        const aLevel = (aRawUrgency === 'high' || aRawUrgency === 'medium' || aRawUrgency === 'yes') ? 'yes' : 'no';
        const bLevel = (bRawUrgency === 'high' || bRawUrgency === 'medium' || bRawUrgency === 'yes') ? 'yes' : 'no';
        if (aLevel !== bLevel) {
          const urgencyOrder = { yes: 0, no: 1 };
          return urgencyOrder[aLevel] - urgencyOrder[bLevel];
        }
        // Then by completion status (incomplete first)
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        // Finally by date
        return a.date.getTime() - b.date.getTime();
      });

      setTasks(allTasks);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      toast.error('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTask = async (taskId: number, completed: boolean) => {
    try {
      await meetingsAPI.toggleTaskCompletion(taskId, completed);
      setTasks(tasks.map(task =>
        task.id === taskId ? { ...task, completed } : task
      ));
      // Re-sort to push completed tasks to bottom
      setTasks(prev => [...prev].sort((a, b) => {
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        return a.date.getTime() - b.date.getTime();
      }));
      toast.success(completed ? 'Task marked as completed' : 'Task marked as incomplete');
    } catch (error) {
      console.error('Failed to toggle task:', error);
      toast.error('Failed to update task status');
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }
    try {
      await meetingsAPI.deleteEvent(taskId);
      setTasks(tasks.filter(task => task.id !== taskId));
      toast.success('Task deleted successfully');
    } catch (error) {
      console.error('Failed to delete task:', error);
      toast.error('Failed to delete task');
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks
      .filter(task => {
        if (filterType === 'pending') return !task.completed;
        if (filterType === 'completed') return task.completed;
        return true;
      })
      .filter(task => {
        if (filterUrgency === 'all') return true;
        const rawUrgency = task.urgency || 'no';
        const normalizedUrgency = (rawUrgency === 'high' || rawUrgency === 'medium' || rawUrgency === 'yes') ? 'yes' : 'no';
        return normalizedUrgency === filterUrgency;
      })
      .filter(task =>
        searchTerm === '' ||
        task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        task.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [tasks, filterType, filterUrgency, searchTerm]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter(t => t.completed).length;
    const pending = total - completed;
    const urgent = tasks.filter(t => {
      const rawUrgency = t.urgency || 'no';
      const normalizedUrgency = (rawUrgency === 'high' || rawUrgency === 'medium' || rawUrgency === 'yes') ? 'yes' : 'no';
      return normalizedUrgency === 'yes' && !t.completed;
    }).length;
    const important = 0; // No longer using "medium" urgency

    return { total, completed, pending, urgent, important };
  }, [tasks]);

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navigation />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <CheckSquare className="w-8 h-8 text-indigo-600" />
              <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
            </div>
            <p className="text-gray-600">Manage all your tasks and action items</p>
          </div>

          {/* Stats Cards Skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            {[...Array(5)].map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>

          {/* Filters Skeleton */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 h-10 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-10 w-40 bg-gray-200 rounded-lg animate-pulse" />
              <div className="h-10 w-40 bg-gray-200 rounded-lg animate-pulse" />
            </div>
          </div>

          {/* Tasks Skeleton */}
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <TaskCardSkeleton key={i} />
            ))}
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
            <CheckSquare className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
          </div>
          <p className="text-gray-600">Manage all your tasks and action items</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-600">Total Tasks</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-indigo-600">{stats.pending}</div>
            <div className="text-sm text-gray-600">Pending</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-green-600">{stats.completed}</div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-red-600">{stats.urgent}</div>
            <div className="text-sm text-gray-600">Urgent</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-2xl font-bold text-gray-400">{stats.important}</div>
            <div className="text-sm text-gray-600">Normal</div>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-600" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Status</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* Urgency Filter */}
            <select
              value={filterUrgency}
              onChange={(e) => setFilterUrgency(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Priority</option>
              <option value="yes">🔴 Urgent</option>
              <option value="no">Normal</option>
            </select>
          </div>
        </div>

        {/* Tasks List */}
        {filteredTasks.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <CheckSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">
              {searchTerm || filterType !== 'all' || filterUrgency !== 'all'
                ? 'No tasks match your filters'
                : 'No tasks found. Upload meetings to create tasks.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const rawUrgency = task.urgency || 'no';
              const urgency = (rawUrgency === 'high' || rawUrgency === 'medium' || rawUrgency === 'yes') ? 'yes' : 'no';
              const isUrgent = urgency === 'yes';
              const urgencyLevel = urgency === 'yes' ? 'high' : 'low';
              const styles = getUrgencyStyles(urgencyLevel);

              return (
                <div
                  key={task.id}
                  className={`rounded-lg shadow-sm border-l-4 transition-all ${
                    task.completed
                      ? 'bg-white border-green-500 opacity-60'
                      : isUrgent
                      ? `${styles.cardBg} ${styles.border}`
                      : 'bg-white border-indigo-500'
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Checkbox */}
                      <button
                        onClick={() => handleToggleTask(task.id, !task.completed)}
                        className="flex-shrink-0 mt-1"
                      >
                        {task.completed ? (
                          <CheckCircle2 className="w-6 h-6 text-green-600" />
                        ) : (
                          <Circle className="w-6 h-6 text-gray-400 hover:text-indigo-600 transition-colors" />
                        )}
                      </button>

                      {/* Task Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex-1">
                            <h3
                              className={`font-semibold text-gray-900 mb-1 cursor-pointer hover:text-indigo-600 ${
                                task.completed ? 'line-through' : ''
                              }`}
                              onClick={() => router.push(`/meeting/${task.meetingId}`)}
                            >
                              {task.title}
                            </h3>
                            {task.description && (
                              <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                            )}
                          </div>

                          {/* Status Badges */}
                          <div className="flex flex-col items-end gap-1">
                            {task.completed && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                                ✓ Done
                              </span>
                            )}
                            {!task.completed && isUrgent && (
                              <span className={`px-2 py-1 rounded text-xs font-medium ${styles.badge}`}>
                                {styles.icon} URGENT
                              </span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteTask(task.id);
                              }}
                              className="mt-1 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete task"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Task Meta */}
                        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(task.date, 'MMM dd, yyyy')}
                          </div>
                          {task.category && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded">
                              {task.category.replace(/_/g, ' ')}
                            </span>
                          )}
                          <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                            {task.type === 'dated_events' ? 'Event' : 'Note'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
