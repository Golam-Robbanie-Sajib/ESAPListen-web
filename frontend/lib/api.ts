/**
 * API client for backend communication
 */
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Create axios instance
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh with rotation
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If token expired, try to refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/api/auth/refresh`, {
            refresh_token: refreshToken,
          });

          const { access_token, refresh_token: new_refresh_token } = response.data;

          // Store both new tokens (implements refresh token rotation)
          if (typeof window !== 'undefined') {
            localStorage.setItem('access_token', access_token);
            if (new_refresh_token) {
              localStorage.setItem('refresh_token', new_refresh_token);
            }
          }

          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, redirect to login
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/signin';
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Authentication API
export const authAPI = {
  googleAuth: async (token: string) => {
    const response = await api.post('/api/auth/google', { token });
    return response.data;
  },

  register: async (email: string, password: string, name?: string) => {
    const response = await api.post('/api/auth/register', { email, password, name });
    return response.data;
  },

  login: async (email: string, password: string) => {
    const response = await api.post('/api/auth/login', { email, password });
    return response.data;
  },

  getGitHubAuthUrl: async () => {
    const response = await api.get('/api/auth/github/url');
    return response.data;
  },

  githubAuth: async (code: string) => {
    const response = await api.post('/api/auth/github', { code });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await api.get('/api/auth/me');
    return response.data;
  },

  refreshToken: async (refreshToken: string) => {
    const response = await api.post('/api/auth/refresh', { refresh_token: refreshToken });
    return response.data;
  },

  updateProfile: async (name: string) => {
    const response = await api.patch('/api/auth/profile', { name });
    return response.data;
  },

  forgotPassword: async (email: string) => {
    const response = await api.post('/api/auth/forgot-password', { email });
    return response.data;
  },

  resetPassword: async (token: string, new_password: string) => {
    const response = await api.post('/api/auth/reset-password', { token, new_password });
    return response.data;
  },

  // Aliases for consistency
  emailRegister: async (email: string, password: string, name?: string) => {
    const response = await api.post('/api/auth/register', { email, password, name });
    return response.data;
  },

  emailLogin: async (email: string, password: string) => {
    const response = await api.post('/api/auth/login', { email, password });
    return response.data;
  },

  verifyEmail: async (token: string) => {
    const response = await api.post('/api/auth/verify-email', { token });
    return response.data;
  },

  resendVerification: async (email: string) => {
    const response = await api.post('/api/auth/resend-verification', { email });
    return response.data;
  },
};

// Meetings API
export const meetingsAPI = {
  uploadAudio: async (file: File, config: any) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('config', JSON.stringify(config));

    const response = await api.post('/api/process-audio', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getJobStatus: async (jobId: string) => {
    const response = await api.get(`/api/job/${jobId}/status`);
    return response.data;
  },

  getJobResult: async (jobId: string) => {
    const response = await api.get(`/api/job/${jobId}/result`);
    return response.data;
  },

  getMeetings: async (limit = 50, offset = 0) => {
    const response = await api.get('/api/meetings', { params: { limit, offset } });
    return response.data;
  },

  getAllMeetings: async () => {
    const response = await api.get('/api/meetings', { params: { limit: 1000, offset: 0 } });
    return response.data.meetings || response.data;
  },

  getMeetingDetails: async (jobId: string) => {
    const response = await api.get(`/api/meetings/${jobId}`);
    return response.data;
  },

  deleteMeeting: async (jobId: string) => {
    const response = await api.delete(`/api/meetings/${jobId}`);
    return response.data;
  },

  syncToCalendar: async (jobId: string) => {
    const response = await api.post(`/api/meetings/${jobId}/sync-calendar`);
    return response.data;
  },

  createNote: async (jobId: string, noteData: { title: string; description: string; category: string }) => {
    const response = await api.post(`/api/meetings/${jobId}/notes`, noteData);
    return response.data;
  },

  toggleTaskCompletion: async (eventId: number, completed: boolean) => {
    const response = await api.patch(`/api/events/${eventId}/toggle-complete`, { completed });
    return response.data;
  },

  deleteEvent: async (eventId: number) => {
    const response = await api.delete(`/api/events/${eventId}`);
    return response.data;
  },

  deleteNote: async (noteId: number) => {
    const response = await api.delete(`/api/notes/${noteId}`);
    return response.data;
  },
};

// Analytics API
export const analyticsAPI = {
  getAnalytics: async () => {
    const response = await api.get('/api/analytics');
    return response.data;
  },
};

// Presets API
export const presetsAPI = {
  getPresets: async () => {
    const response = await api.get('/api/presets');
    return response.data;
  },

  createPreset: async (data: { name: string; config: any; is_default?: boolean }) => {
    const response = await api.post('/api/presets', data);
    return response.data;
  },

  updatePreset: async (id: number, data: { name?: string; config?: any; is_default?: boolean }) => {
    const response = await api.put(`/api/presets/${id}`, data);
    return response.data;
  },

  deletePreset: async (id: number) => {
    const response = await api.delete(`/api/presets/${id}`);
    return response.data;
  },
};

// Calendar API
export const calendarAPI = {
  getAuthUrl: async () => {
    const response = await api.get('/api/calendar/auth-url');
    return response.data;
  },

  handleCallback: async (code: string, state: string) => {
    const response = await api.post('/api/calendar/callback', { code, state });
    return response.data;
  },

  disconnect: async () => {
    const response = await api.post('/api/calendar/disconnect');
    return response.data;
  },
};
