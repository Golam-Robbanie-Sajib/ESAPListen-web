'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Navigation from '@/components/Navigation';
import { calendarAPI, authAPI } from '@/lib/api';
import { Calendar, Loader2, Check, X, Edit2 } from 'lucide-react';

export default function SettingsPage() {
  const router = useRouter();
  const { user, loading, refreshUser } = useAuth();
  const [connectingCalendar, setConnectingCalendar] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signin');
    }
  }, [user, loading, router]);

  useEffect(() => {
    // Handle calendar OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');

    if (code && state) {
      handleCalendarCallback(code, state);
    }
  }, []);

  const handleConnectCalendar = async () => {
    setConnectingCalendar(true);
    try {
      const data = await calendarAPI.getAuthUrl();
      window.location.href = data.authorization_url;
    } catch (error) {
      console.error('Failed to get calendar auth URL:', error);
      alert('Failed to connect calendar');
      setConnectingCalendar(false);
    }
  };

  const handleCalendarCallback = async (code: string, state: string) => {
    try {
      await calendarAPI.handleCallback(code, state);
      await refreshUser();
      // Clean up URL
      window.history.replaceState({}, document.title, '/settings');
      alert('Calendar connected successfully!');
    } catch (error) {
      console.error('Calendar callback failed:', error);
      alert('Failed to connect calendar');
    }
  };

  const handleDisconnectCalendar = async () => {
    if (!confirm('Are you sure you want to disconnect your calendar?')) return;

    try {
      await calendarAPI.disconnect();
      await refreshUser();
      alert('Calendar disconnected');
    } catch (error) {
      console.error('Failed to disconnect calendar:', error);
      alert('Failed to disconnect calendar');
    }
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      alert('Please enter a name');
      return;
    }

    try {
      await authAPI.updateProfile(newName);
      await refreshUser();
      setEditingName(false);
      setNewName('');
    } catch (error) {
      console.error('Failed to update name:', error);
      alert('Failed to update name');
    }
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

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Manage your account and preferences</p>
        </div>

        <div className="space-y-6">
          {/* Profile */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Profile</h2>
            <div className="flex items-center gap-4">
              {user?.picture && (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-16 h-16 rounded-full"
                />
              )}
              <div className="flex-1">
                {editingName ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      placeholder="Enter new name"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdateName}
                        className="px-3 py-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          setEditingName(false);
                          setNewName('');
                        }}
                        className="px-3 py-1 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-gray-900">{user?.name}</p>
                      <p className="text-sm text-gray-600">{user?.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setEditingName(true);
                        setNewName(user?.name || '');
                      }}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-md flex items-center gap-2 text-sm text-gray-700 transition-colors"
                      title="Edit name"
                    >
                      <Edit2 className="w-4 h-4" />
                      Edit
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Google Calendar */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Google Calendar Integration
            </h2>

            {user?.calendar_connected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600 bg-green-50 px-4 py-3 rounded-lg">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">Calendar Connected</span>
                </div>
                <p className="text-sm text-gray-600">
                  Meeting events will be automatically synced to your Google Calendar when you enable "Calendar Sync" in the output fields.
                </p>
                <button
                  onClick={handleDisconnectCalendar}
                  className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-50 transition-colors"
                >
                  Disconnect Calendar
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-yellow-600 bg-yellow-50 px-4 py-3 rounded-lg">
                  <X className="w-5 h-5" />
                  <span className="font-medium">Calendar Not Connected</span>
                </div>
                <p className="text-sm text-gray-600">
                  Connect your Google Calendar to automatically create events from meeting
                  action items when you enable "Calendar Sync" in the output fields.
                </p>
                <button
                  onClick={handleConnectCalendar}
                  disabled={connectingCalendar}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {connectingCalendar ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    'Connect Google Calendar'
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
