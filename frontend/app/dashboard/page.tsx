'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useConfig } from '@/lib/config-context';
import Navigation from '@/components/Navigation';
import RoleConfigModal from '@/components/RoleConfigModal';
import StatCard from '@/components/StatCard';
import { meetingsAPI, analyticsAPI } from '@/lib/api';
import { Upload, Loader2, Mic, Square, Play, Trash2, Settings, FileText, Calendar, Clock, TrendingUp, CheckSquare, Circle, CheckCircle2, AlertCircle, X, Check } from 'lucide-react';
import { detectUrgency, getUrgencyStyles } from '@/lib/urgency-detector';

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { config, updateConfig } = useConfig();
  const [inputMode, setInputMode] = useState<'upload' | 'record'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [showRoleModal, setShowRoleModal] = useState(false);

  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [autoProcess, setAutoProcess] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'upcoming' | 'tasks'>('upcoming');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
    } else if (user) {
      // Fetch analytics
      analyticsAPI.getAnalytics().then(setAnalytics).catch(console.error);
      // Fetch upcoming events and tasks
      fetchUpcomingEvents();
      fetchTasks();
    }
  }, [user, loading, router]);

  const fetchUpcomingEvents = async () => {
    try {
      const meetings = await meetingsAPI.getAllMeetings();
      const now = new Date();
      const allEvents: any[] = [];

      meetings.forEach((meeting: any) => {
        if (meeting.events && Array.isArray(meeting.events)) {
          meeting.events.forEach((eventItem: any) => {
            try {
              const eventData = typeof eventItem.event_data === 'string'
                ? JSON.parse(eventItem.event_data)
                : eventItem.event_data;

              if (eventItem.event_type === 'dated_events') {
                const eventDate = new Date(eventData.date);
                if (eventDate > now) {
                  allEvents.push({
                    id: eventItem.id,
                    title: eventData.title || 'Untitled Event',
                    date: eventDate,
                    assignee: eventData.assignee,
                    description: eventData.description || '',
                    urgency: eventData.urgency || 'no',
                    completed: eventData.completed || false,
                    meetingId: meeting.job_id,
                  });
                }
              }
            } catch (err) {
              console.error('Error parsing event:', err);
            }
          });
        }
      });

      // Sort by date and take first 5
      allEvents.sort((a, b) => a.date.getTime() - b.date.getTime());
      setUpcomingEvents(allEvents.slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch upcoming events:', error);
    }
  };

  const fetchTasks = async () => {
    try {
      const meetings = await meetingsAPI.getAllMeetings();
      const allTasks: any[] = [];

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
                  date: taskDate,
                  completed: eventData.completed || false,
                  type: eventItem.event_type,
                  category: eventData.category,
                  description: eventData.description || '',
                  urgency: eventData.urgency || 'no',
                  meetingId: meeting.job_id,
                });
              }
            } catch (err) {
              console.error('Error parsing task:', err);
            }
          });
        }
      });

      // Sort by date (uncompleted first, then by date)
      allTasks.sort((a, b) => {
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        return a.date.getTime() - b.date.getTime();
      });
      setTasks(allTasks);
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    }
  };

  const handleToggleTask = async (taskId: number, completed: boolean) => {
    try {
      await meetingsAPI.toggleTaskCompletion(taskId, completed);
      // Update local state
      setTasks(tasks.map(task =>
        task.id === taskId ? { ...task, completed } : task
      ));
      // Re-sort tasks
      setTasks(prev => [...prev].sort((a, b) => {
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        return a.date.getTime() - b.date.getTime();
      }));
      // Refresh upcoming events to sync completion status
      fetchUpcomingEvents();
    } catch (error) {
      console.error('Failed to toggle task completion:', error);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm('Are you sure you want to delete this task?')) {
      return;
    }
    try {
      await meetingsAPI.deleteEvent(taskId);
      setTasks(tasks.filter(task => task.id !== taskId));
      // Refresh upcoming events in case the deleted task was there
      fetchUpcomingEvents();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const handleDeleteEvent = async (eventId: number) => {
    if (!confirm('Are you sure you want to delete this event?')) {
      return;
    }
    try {
      await meetingsAPI.deleteEvent(eventId);
      setUpcomingEvents(upcomingEvents.filter(event => event.id !== eventId));
    } catch (error) {
      console.error('Failed to delete event:', error);
    }
  };

  // Config is now managed globally via useConfig hook

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  // Recording timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRecording, isPaused]);

  // Auto-process effect - triggers uploadRecording when recording is done and autoProcess is true
  useEffect(() => {
    if (recordedAudio && autoProcess) {
      setAutoProcess(false);
      uploadRecording();
    }
  }, [recordedAudio, autoProcess]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        setRecordedAudio(audioBlob);
        setAudioUrl(URL.createObjectURL(audioBlob));
        stream.getTracks().forEach((track) => track.stop());
      };

      setAudioChunks(chunks);
      setMediaRecorder(recorder);
      recorder.start();
      setIsRecording(true);
      setRecordingTime(0);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setIsPaused(false);
    }
  };

  const deleteRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setRecordedAudio(null);
    setAudioUrl(null);
    setRecordingTime(0);
    setAudioChunks([]);
  };

  const uploadRecording = async () => {
    if (!recordedAudio) return;

    // Guard rail: If custom_field_only is checked, user_input must not be empty
    if (config.custom_field_only && !config.user_input.trim()) {
      alert('Please provide a question in the "Additional Analysis" field, or uncheck the "Only process additional analysis" option.');
      return;
    }

    // Convert blob to file
    const recordingFile = new File(
      [recordedAudio],
      `recording_${Date.now()}.webm`,
      { type: 'audio/webm' }
    );

    setProcessing(true);
    setStatus('Uploading recording...');

    console.log('🎙️ Uploading recording with config:', config);
    console.log('🎙️ Calendar Sync enabled:', config.output_fields.calendar_sync);

    try {
      const result = await meetingsAPI.uploadAudio(recordingFile, config);
      setJobId(result.job_id);
      pollJobStatus(result.job_id);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
      setProcessing(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleUpload = async () => {
    if (!file) return;

    // Guard rail: If custom_field_only is checked, user_input must not be empty
    if (config.custom_field_only && !config.user_input.trim()) {
      alert('Please provide a question in the "Additional Analysis" field, or uncheck the "Only process additional analysis" option.');
      return;
    }

    setProcessing(true);
    setStatus('Uploading...');

    console.log('📤 Uploading with config:', config);
    console.log('📤 Calendar Sync enabled:', config.output_fields.calendar_sync);

    try {
      const result = await meetingsAPI.uploadAudio(file, config);
      setJobId(result.job_id);
      pollJobStatus(result.job_id);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
      setProcessing(false);
    }
  };

  const pollJobStatus = async (id: string) => {
    const interval = setInterval(async () => {
      try {
        const statusData = await meetingsAPI.getJobStatus(id);
        setProgress(statusData.overall_progress);

        // Show detailed status based on current stage
        const stages = statusData.stages || {};
        let currentStatus = 'Processing...';

        if (stages.vad?.status === 'in_progress') {
          currentStatus = '🎵 Detecting speech...';
        } else if (stages.enhancement?.status === 'in_progress') {
          currentStatus = '🔊 Enhancing audio quality...';
        } else if (stages.transcription?.status === 'in_progress') {
          currentStatus = '📝 Transcribing audio...';
        } else if (stages.diarization?.status === 'in_progress') {
          currentStatus = '👥 Identifying speakers...';
        } else if (stages.extraction?.status === 'in_progress') {
          currentStatus = '🤖 Extracting key insights...';
        } else if (stages.calendar?.status === 'in_progress') {
          currentStatus = '📅 Syncing to calendar...';
        } else if (statusData.status === 'completed') {
          currentStatus = '✅ Complete!';
        }

        setStatus(currentStatus);

        if (statusData.status === 'completed') {
          clearInterval(interval);
          setProcessing(false);
          router.push(`/meeting/${id}`);
        } else if (statusData.status === 'failed') {
          clearInterval(interval);
          setProcessing(false);
          alert('Processing failed: ' + statusData.error);
        }
      } catch (error) {
        console.error('Status check failed:', error);
      }
    }, 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600 mt-2">
                Upload or record a meeting to get started
              </p>
            </div>
            <button
              onClick={() => setShowRoleModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Settings className="w-5 h-5" />
              <div className="text-left">
                <div className="text-sm font-semibold">Roles and Presets</div>
                <div className="text-xs opacity-90">{config.role}</div>
              </div>
            </button>
          </div>
        </div>

        {/* Main Content Area with Upcoming Events Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Input Area */}
          <div className="lg:col-span-2">
          <div>
            <div className="bg-white rounded-lg shadow p-6">
              {/* Tabs */}
              <div className="flex gap-4 mb-6 border-b border-gray-200">
                <button
                  onClick={() => setInputMode('upload')}
                  className={`pb-3 px-4 font-medium transition-colors ${
                    inputMode === 'upload'
                      ? 'border-b-2 border-indigo-600 text-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Upload className="w-5 h-5 inline-block mr-2" />
                  Upload File
                </button>
                <button
                  onClick={() => setInputMode('record')}
                  className={`pb-3 px-4 font-medium transition-colors ${
                    inputMode === 'record'
                      ? 'border-b-2 border-indigo-600 text-indigo-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Mic className="w-5 h-5 inline-block mr-2" />
                  Record Audio
                </button>
              </div>

              {!processing ? (
                <div className="space-y-6">
                  {/* Upload Mode */}
                  {inputMode === 'upload' && (
                    <>
                      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-500 transition-colors">
                        <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={handleFileChange}
                          className="hidden"
                          id="file-upload"
                        />
                        <label
                          htmlFor="file-upload"
                          className="cursor-pointer text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                          Choose a file
                        </label>
                        <span className="text-gray-600"> or drag and drop</span>
                        <p className="text-sm text-gray-500 mt-2">
                          MP3, WAV, M4A, WebM up to 500MB
                        </p>
                      </div>

                      {file && (
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-sm font-medium text-gray-900">
                            Selected: {file.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            Size: {(file.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  {/* Recording Mode */}
                  {inputMode === 'record' && (
                    <>
                      <div className="border-2 border-gray-300 rounded-lg p-8 text-center">
                        {!isRecording && !recordedAudio && (
                          <div>
                            <Mic className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                            <p className="text-gray-600 mb-4">
                              Click the button below to start recording
                            </p>
                            <button
                              onClick={startRecording}
                              className="bg-red-600 text-white px-6 py-3 rounded-full hover:bg-red-700 transition-colors flex items-center gap-2 mx-auto"
                            >
                              <Mic className="w-5 h-5" />
                              Start Recording
                            </button>
                          </div>
                        )}

                        {isRecording && (
                          <div>
                            <div className="w-16 h-16 mx-auto mb-4 bg-red-600 rounded-full flex items-center justify-center animate-pulse">
                              <Mic className="w-8 h-8 text-white" />
                            </div>
                            <p className="text-2xl font-mono font-bold text-gray-900 mb-4">
                              {formatTime(recordingTime)}
                            </p>
                            <p className="text-sm text-gray-600 mb-4">Recording in progress...</p>
                            <div className="flex gap-3 justify-center">
                              <button
                                onClick={() => {
                                  // Cancel recording: stop recorder without creating blob
                                  if (mediaRecorder && isRecording) {
                                    // Remove onstop handler to prevent blob creation
                                    mediaRecorder.onstop = null;
                                    mediaRecorder.stop();
                                    setIsRecording(false);
                                    setIsPaused(false);
                                  }
                                  // Clear all recording state
                                  deleteRecording();
                                }}
                                className="bg-gray-600 text-white px-6 py-3 rounded-full hover:bg-gray-700 transition-colors flex items-center gap-2"
                              >
                                <X className="w-5 h-5" />
                                Cancel
                              </button>
                              <button
                                onClick={() => {
                                  setAutoProcess(true);
                                  stopRecording();
                                }}
                                className="bg-emerald-600 text-white px-6 py-3 rounded-full hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-lg"
                              >
                                <Check className="w-5 h-5" />
                                Finish & Analyze
                              </button>
                            </div>
                          </div>
                        )}

                        {recordedAudio && !isRecording && (
                          <div>
                            <div className="w-16 h-16 mx-auto mb-4 bg-green-600 rounded-full flex items-center justify-center">
                              <Mic className="w-8 h-8 text-white" />
                            </div>
                            <p className="text-lg font-medium text-gray-900 mb-2">
                              Recording Complete
                            </p>
                            <p className="text-sm text-gray-600 mb-4">
                              Duration: {formatTime(recordingTime)}
                            </p>
                            <div className="flex gap-3 justify-center">
                              <audio src={audioUrl || ''} controls className="mb-4" />
                            </div>
                            <div className="flex gap-3 justify-center mt-4">
                              <button
                                onClick={deleteRecording}
                                className="bg-red-100 text-red-700 px-4 py-2 rounded-md hover:bg-red-200 transition-colors flex items-center gap-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                Delete
                              </button>
                              <button
                                onClick={startRecording}
                                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors flex items-center gap-2"
                              >
                                <Mic className="w-4 h-4" />
                                Re-record
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Additional Analysis - Common for both modes */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        {config.custom_field_only
                          ? '🎯 Custom Query (Required)'
                          : 'Additional Analysis (Optional)'}
                      </label>
                      <textarea
                        value={config.user_input}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value.length <= 1000) {
                            updateConfig({ user_input: value });
                          }
                        }}
                        placeholder={
                          config.custom_field_only
                            ? "🎯 Additinal analysis active!\n\nExamples:\n• What were the main budget concerns?\n• List all action items assigned to John\n• When is the next milestone deadline?\n• Summarize the technical decisions made"
                            : "Optional: Describe the specific information you want from the meeting.\n\nExamples:\n• All budget discussions.\n• List all technical decisions made\n• Who is responsible for the marketing campaign?\n• What are the key deadlines mentioned?"
                        }
                        className={`w-full px-3 py-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500 ${
                          config.custom_field_only
                            ? 'border-indigo-300 bg-indigo-50/30'
                            : 'border-gray-300'
                        }`}
                        rows={4}
                        maxLength={1000}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        {config.user_input.length}/1000 characters
                        {config.custom_field_only && config.user_input.length === 0 && (
                          <span className="text-amber-600 ml-2">⚠️ Query required in this mode</span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="custom_field_only"
                        checked={config.custom_field_only}
                        onChange={(e) =>
                          updateConfig({ custom_field_only: e.target.checked })
                        }
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <label htmlFor="custom_field_only" className="text-sm text-gray-700">
                        Only process additional analysis (skip standard extraction)
                      </label>
                    </div>
                  </div>

                  {/* Process Button */}
                  <button
                    onClick={inputMode === 'upload' ? handleUpload : uploadRecording}
                    disabled={inputMode === 'upload' ? !file : !recordedAudio}
                    className="w-full bg-indigo-600 text-white py-3 px-4 rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium transition-colors"
                  >
                    Process Audio
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center py-8">
                    <Loader2 className="w-16 h-16 mx-auto animate-spin text-indigo-600 mb-4" />
                    <p className="text-lg font-medium text-gray-900">{status}</p>
                    <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-600 mt-2">{progress}% complete</p>
                  </div>
                </div>
              )}
            </div>
          </div>
          </div>

          {/* Upcoming Events / Tasks Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 sticky top-4">
              {/* Tab Switcher */}
              <div className="flex gap-2 mb-4 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
                <button
                  onClick={() => setSidebarTab('upcoming')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    sidebarTab === 'upcoming'
                      ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Upcoming
                </button>
                <button
                  onClick={() => setSidebarTab('tasks')}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                    sidebarTab === 'tasks'
                      ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow'
                      : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <CheckSquare className="w-4 h-4" />
                  Tasks
                </button>
              </div>

              {/* Upcoming Events Tab */}
              {sidebarTab === 'upcoming' && (
                <>
                  {upcomingEvents.length > 0 ? (
                    <div className="space-y-3">
                      {upcomingEvents.map((event, index) => {
                        const rawUrgency = event.urgency || 'no';
                        const urgency = (rawUrgency === 'high' || rawUrgency === 'medium' || rawUrgency === 'yes') ? 'yes' : 'no';
                        const isUrgent = urgency === 'yes';
                        const urgencyLevel = urgency === 'yes' ? 'high' : 'low';
                        const styles = getUrgencyStyles(urgencyLevel);
                        return (
                          <div
                            key={index}
                            className={`p-3 rounded-lg border-l-4 ${styles.border} ${isUrgent ? styles.cardBg : 'bg-gray-50 dark:bg-gray-700'} hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors cursor-pointer relative ${event.completed ? 'opacity-60' : ''}`}
                            onClick={() => router.push(`/meeting/${event.meetingId}`)}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteEvent(event.id);
                              }}
                              className="absolute bottom-2 right-2 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors z-10"
                              title="Delete event"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                            {isUrgent && !event.completed && (
                              <div className="absolute top-2 right-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles.badge}`}>
                                  {styles.icon} URGENT
                                </span>
                              </div>
                            )}
                            {event.completed && (
                              <div className="absolute top-2 right-2">
                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">
                                  ✓ DONE
                                </span>
                              </div>
                            )}
                            <h3 className={`font-medium text-sm text-gray-900 dark:text-white mb-1 pr-16 ${event.completed ? 'line-through' : ''}`}>
                              {event.title}
                            </h3>
                            {event.description && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                                {event.description}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                              <Clock className="w-3 h-3" />
                              {event.date.toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                            {event.assignee && (
                              <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                👤 {event.assignee}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Calendar className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No upcoming events
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Events will appear here after syncing
                      </p>
                    </div>
                  )}

                  {upcomingEvents.length > 0 && (
                    <button
                      onClick={() => router.push('/events')}
                      className="mt-4 w-full text-center text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                    >
                      View all events →
                    </button>
                  )}
                </>
              )}

              {/* Tasks Tab */}
              {sidebarTab === 'tasks' && (
                <>
                  {tasks.length > 0 ? (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {tasks.map((task) => {
                        const rawUrgency = task.urgency || 'no';
                        const urgency = (rawUrgency === 'high' || rawUrgency === 'medium' || rawUrgency === 'yes') ? 'yes' : 'no';
                        const isUrgent = urgency === 'yes';
                        const urgencyLevel = urgency === 'yes' ? 'high' : 'low';
                        const styles = getUrgencyStyles(urgencyLevel);
                        const borderClass = task.completed
                          ? 'border-green-500'
                          : isUrgent
                          ? styles.border
                          : 'border-indigo-500';
                        const bgClass = task.completed
                          ? 'bg-gray-50 dark:bg-gray-700 opacity-60'
                          : isUrgent
                          ? styles.cardBg
                          : 'bg-gray-50 dark:bg-gray-700';

                        return (
                          <div
                            key={task.id}
                            className={`p-3 rounded-lg border-l-4 transition-all ${borderClass} ${bgClass} relative`}
                          >
                            <div className="flex items-start gap-2">
                              <button
                                onClick={() => handleToggleTask(task.id, !task.completed)}
                                className="mt-0.5 flex-shrink-0"
                              >
                                {task.completed ? (
                                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                                ) : (
                                  <Circle className="w-5 h-5 text-gray-400 dark:text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400" />
                                )}
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTask(task.id);
                                }}
                                className="absolute bottom-2 right-2 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors z-10"
                                title="Delete task"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                              <div
                                className="flex-1 cursor-pointer"
                                onClick={() => router.push(`/meeting/${task.meetingId}`)}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <h3 className={`font-medium text-sm text-gray-900 dark:text-white mb-1 ${
                                    task.completed ? 'line-through' : ''
                                  }`}>
                                    {task.title}
                                  </h3>
                                  {!task.completed && isUrgent && (
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium flex-shrink-0 ${styles.badge}`}>
                                      {styles.icon}
                                    </span>
                                  )}
                                </div>
                                {task.description && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400 mb-1 line-clamp-2">
                                    {task.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300 flex-wrap">
                                  <Clock className="w-3 h-3" />
                                  {task.date.toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                  {task.category && (
                                    <span className="px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded text-xs">
                                      {task.category}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <CheckSquare className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        No tasks yet
                      </p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        Tasks will appear here from your meetings
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Role Configuration Modal */}
      <RoleConfigModal isOpen={showRoleModal} onClose={() => setShowRoleModal(false)} />
    </div>
  );
}
