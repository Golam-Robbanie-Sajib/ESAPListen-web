'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { authAPI, calendarAPI } from '@/lib/api';
import { useToast } from '@/components/Toast';
import FeatureHighlights from '@/components/FeatureHighlights';
import LoadingScreen from '@/components/LoadingScreen';
import Link from 'next/link';
import { Loader2, Mail, Lock, Github, Chrome, AlertCircle, Eye, EyeOff } from 'lucide-react';

declare global {
  interface Window {
    google?: any;
  }
}

export default function SignInPage() {
  const router = useRouter();
  const { user, login, refreshUser } = useAuth();
  const toast = useToast();
  const [isConnectingCalendar, setIsConnectingCalendar] = useState(false);
  const [signinMode, setSigninMode] = useState<'oauth' | 'email'>('oauth');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });

  useEffect(() => {
    let cancelled = false;

    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      const githubState = localStorage.getItem('github_oauth_state');
      if (code && state && githubState === state) {
        localStorage.removeItem('github_oauth_state');
        if (!cancelled) {
          await handleGitHubCallback(code);
        }
        return;
      }

      if (code && state && !githubState) {
        if (!cancelled) {
          await handleCalendarCallback(code, state);
        }
        return;
      }

      if (user) {
        router.push('/dashboard');
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);

      script.onload = () => {
        if (window.google && !cancelled) {
          window.google.accounts.id.initialize({
            client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
            callback: handleGoogleResponse,
          });

          window.google.accounts.id.renderButton(
            document.getElementById('googleSignInButton'),
            {
              theme: 'outline',
              size: 'large',
              text: 'signin_with',
              shape: 'rectangular',
            }
          );
        }
      };

      return () => {
        cancelled = true;
        if (document.body.contains(script)) {
          document.body.removeChild(script);
        }
      };
    };

    handleOAuthCallback();
  }, [user, router]);

  const redirectAfterLogin = async (userData: any) => {
    // Check if calendar is connected
    if (!userData.user.calendar_connected) {
      // Redirect to calendar OAuth
      toast.info('Connect your Google Calendar to sync meetings');
      try {
        const { authorization_url } = await calendarAPI.getAuthUrl();
        window.location.href = authorization_url;
      } catch (error) {
        console.error('Failed to get calendar auth URL:', error);
        // If calendar OAuth fails, still redirect to dashboard
        router.push('/dashboard');
      }
    } else {
      // Calendar already connected, go to dashboard
      router.push('/dashboard');
    }
  };

  const handleGoogleResponse = async (response: any) => {
    try {
      const result = await authAPI.googleAuth(response.credential);
      login(result);
      toast.success('Welcome back! Signed in successfully');
      await redirectAfterLogin(result);
    } catch (error) {
      console.error('Google sign in failed:', error);
      const errorMsg = 'Failed to sign in with Google';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleGitHubCallback = async (code: string) => {
    try {
      const result = await authAPI.githubAuth(code);
      login(result);
      toast.success('Welcome back! Signed in with GitHub');
      await redirectAfterLogin(result);
    } catch (error) {
      console.error('GitHub auth failed:', error);
      const errorMsg = 'Failed to authenticate with GitHub';
      setError(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleCalendarCallback = async (code: string, state: string) => {
    setIsConnectingCalendar(true);
    try {
      await calendarAPI.handleCallback(code, state);
      await refreshUser();
      toast.success('Calendar connected successfully!');
      window.history.replaceState({}, document.title, '/dashboard');
      router.push('/dashboard');
    } catch (error) {
      console.error('Calendar callback failed:', error);
      const errorMsg = 'Failed to connect calendar';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsConnectingCalendar(false);
    }
  };

  const handleGitHubSignIn = () => {
    const state = Math.random().toString(36).substring(7);
    localStorage.setItem('github_oauth_state', state);
    const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID}&redirect_uri=${window.location.origin}/signin&state=${state}&scope=user:email`;
    window.location.href = githubAuthUrl;
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await authAPI.emailLogin(formData.email, formData.password);
      login(result);
      toast.success('Welcome back! Signed in successfully');
      await redirectAfterLogin(result);
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Invalid email or password';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  if (isConnectingCalendar) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -top-48 -left-48 animate-pulse"></div>
        <div className="absolute w-96 h-96 bg-green-500/10 rounded-full blur-3xl -bottom-48 -right-48 animate-pulse delay-1000"></div>
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-6">
            <img
              src="/esapai_logo.png"
              alt="ESAPListen"
              className="h-16 w-16 rounded-2xl shadow-2xl"
            />
            <h1 className="text-4xl font-bold">
              <span className="text-emerald-400">ESAP</span>
              <span className="text-green-300">Listen</span>
            </h1>
          </div>
          <p className="text-slate-300 text-lg">Welcome back! Sign in to continue</p>
        </div>

        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8">
          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-200 text-sm">{error}</p>
            </div>
          )}

          {/* Tab Switcher */}
          <div className="flex gap-2 mb-8 bg-white/5 p-1.5 rounded-xl">
            <button
              onClick={() => {
                setSigninMode('oauth');
                setError('');
              }}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-300 ${
                signinMode === 'oauth'
                  ? 'bg-emerald-500 text-white shadow-lg'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Quick Sign In
            </button>
            <button
              onClick={() => {
                setSigninMode('email');
                setError('');
              }}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all duration-300 ${
                signinMode === 'email'
                  ? 'bg-emerald-500 text-white shadow-lg'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Email / Password
            </button>
          </div>

          {/* OAuth Mode */}
          {signinMode === 'oauth' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
              {/* Google Sign In */}
              <div className="flex justify-center">
                <div id="googleSignInButton"></div>
              </div>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-slate-800/50 text-slate-400">Or continue with</span>
                </div>
              </div>

              {/* GitHub Sign In */}
              <div className="flex justify-center">
                <button
                  onClick={handleGitHubSignIn}
                  className="flex items-center justify-center gap-3 px-6 py-4 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-xl border border-white/10 hover:border-white/20 transition-all duration-300 group w-full max-w-xs"
                >
                  <Github className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span className="font-medium">Sign in with GitHub</span>
                </button>
              </div>
            </div>
          )}

          {/* Email/Password Mode */}
          {signinMode === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-5 animate-in fade-in slide-in-from-top-4">
              {/* Email Input */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-12 pr-12 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Forgot Password Link */}
              <div className="flex justify-end">
                <Link
                  href="/forgot-password"
                  className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-emerald-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>
          )}

          {/* Sign Up Link */}
          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <p className="text-slate-300">
              Don't have an account?{' '}
              <Link
                href="/signup"
                className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
              >
                Sign up for free
              </Link>
            </p>
          </div>

          {/* Feature Highlights */}
          <FeatureHighlights />
        </div>

        {/* Footer */}
        <p className="text-center text-slate-400 text-sm mt-8">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
