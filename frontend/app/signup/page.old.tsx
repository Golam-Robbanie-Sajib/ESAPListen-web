'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { authAPI } from '@/lib/api';
import Link from 'next/link';

declare global {
  interface Window {
    google?: any;
  }
}

export default function SignUpPage() {
  const router = useRouter();
  const { user, login } = useAuth();
  const [signupMode, setSignupMode] = useState<'oauth' | 'email'>('oauth');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Email/Password form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // Track password length (Argon2 has no byte limit like bcrypt did)
  // Simple character count validation: 8-128 characters
  const passwordLength = formData.password.length;

  useEffect(() => {
    // Redirect if already logged in
    if (user) {
      router.push('/dashboard');
      return;
    }

    // Load Google Sign-In script
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
          callback: handleGoogleResponse,
        });

        window.google.accounts.id.renderButton(
          document.getElementById('googleSignUpButton'),
          {
            theme: 'outline',
            size: 'large',
            text: 'signup_with',
            width: 300,
          }
        );
      }
    };

    return () => {
      document.body.removeChild(script);
    };
  }, [user, router]);

  const handleGoogleResponse = async (response: any) => {
    try {
      setIsLoading(true);
      setError('');
      const result = await authAPI.googleAuth(response.credential);
      login(result);
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Google sign-up failed:', error);
      setError(error.response?.data?.detail || 'Sign-up failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGitHubSignUp = async () => {
    try {
      setIsLoading(true);
      setError('');
      const data = await authAPI.getGitHubAuthUrl();
      // Store state for verification after callback
      localStorage.setItem('github_oauth_state', data.state);
      // Redirect to GitHub OAuth
      window.location.href = data.authorization_url;
    } catch (error: any) {
      console.error('GitHub auth URL failed:', error);
      setError(error.response?.data?.detail || 'Failed to initiate GitHub sign-up. Please try again.');
      setIsLoading(false);
    }
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name || !formData.email || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    // Check for reasonable password length (Argon2 has no strict byte limit like bcrypt)
    if (passwordLength > 128) {
      setError(`Password is too long (${passwordLength} characters). Maximum is 128 characters.`);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      setIsLoading(true);
      const result = await authAPI.register(formData.email, formData.password, formData.name);

      // Store tokens and user data
      localStorage.setItem('access_token', result.access_token);
      localStorage.setItem('refresh_token', result.refresh_token);

      login(result);
      router.push('/dashboard');
    } catch (error: any) {
      console.error('Email sign-up failed:', error);
      console.error('Error response:', error.response?.data);
      const errorMessage = error.response?.data?.detail || error.message || 'Sign-up failed. Please try again.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Floating gradient orbs */}
        <div className="absolute top-20 left-10 w-96 h-96 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-40 right-10 w-96 h-96 bg-gradient-to-r from-blue-400 to-indigo-600 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-20 left-1/2 w-96 h-96 bg-gradient-to-r from-purple-400 to-pink-600 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>

        {/* Floating particles */}
        <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-emerald-400 rounded-full animate-float opacity-60"></div>
        <div className="absolute top-1/3 right-1/4 w-3 h-3 bg-blue-400 rounded-full animate-float animation-delay-1000 opacity-60"></div>
        <div className="absolute bottom-1/4 left-1/3 w-2 h-2 bg-purple-400 rounded-full animate-float animation-delay-2000 opacity-60"></div>
        <div className="absolute top-2/3 right-1/3 w-2 h-2 bg-pink-400 rounded-full animate-float animation-delay-3000 opacity-60"></div>

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b98120_1px,transparent_1px),linear-gradient(to_bottom,#10b98120_1px,transparent_1px)] bg-[size:4rem_4rem]"></div>
      </div>

      <div className="relative z-10 bg-slate-800/90 backdrop-blur-xl border border-emerald-500/20 p-10 rounded-2xl shadow-2xl shadow-emerald-500/10 max-w-md w-full mx-4 animate-fade-in-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block p-4 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl mb-4 animate-float-slow shadow-lg shadow-emerald-500/50">
            <svg
              className="w-12 h-12 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 via-blue-400 to-purple-400 bg-clip-text text-transparent mb-2 animate-gradient">
            Join <span className="text-green-600">ESAP</span><span className="text-green-400">Listen</span>
          </h1>
          <p className="text-slate-400">Start transforming your meetings into actionable insights</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-3 bg-red-500/10 border border-red-500/50 text-red-400 rounded-lg text-sm animate-shake">
            {error}
          </div>
        )}

        {/* Mode Toggle */}
        <div className="flex gap-2 mb-6 p-1 bg-slate-700/50 rounded-lg border border-slate-600/50">
          <button
            onClick={() => {
              setSignupMode('oauth');
              setError(''); // Clear errors when switching tabs
            }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-300 ${
              signupMode === 'oauth'
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-600/50'
            }`}
          >
            Quick Sign Up
          </button>
          <button
            onClick={() => {
              setSignupMode('email');
              setError(''); // Clear errors when switching tabs
            }}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all duration-300 ${
              signupMode === 'email'
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-600/50'
            }`}
          >
            Email & Password
          </button>
        </div>

        {signupMode === 'oauth' ? (
          /* OAuth Sign Up Options */
          <div className="space-y-4">
            {/* Google Sign Up */}
            <div className="flex flex-col items-center gap-4">
              <div id="googleSignUpButton" className="flex justify-center w-full"></div>
            </div>

            {/* GitHub Sign Up */}
            <button
              onClick={handleGitHubSignUp}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-slate-700/50 border-2 border-slate-600/50 rounded-lg hover:border-emerald-500/50 hover:bg-slate-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <svg className="w-5 h-5 text-slate-300 group-hover:text-white group-hover:scale-110 transition-all" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span className="font-medium text-slate-300 group-hover:text-white">Continue with GitHub</span>
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-600/50"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-slate-800/90 text-slate-400">Or sign up with email</span>
              </div>
            </div>

            <button
              onClick={() => setSignupMode('email')}
              className="w-full px-4 py-3 border-2 border-emerald-500/30 text-emerald-400 rounded-lg hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all duration-300 font-medium"
            >
              Sign up with Email & Password
            </button>
          </div>
        ) : (
          /* Email/Password Sign Up Form */
          <form onSubmit={handleEmailSignUp} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300 placeholder-slate-400"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300 placeholder-slate-400"
                placeholder="john@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={`w-full px-4 py-3 bg-slate-700/50 border text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300 placeholder-slate-400 ${
                  passwordLength > 128 ? 'border-red-500/50' : 'border-slate-600/50'
                }`}
                placeholder="8-128 characters"
                required
                minLength={8}
                maxLength={128}
              />
              {formData.password && (
                <p className={`text-xs mt-1 ${
                  passwordLength > 128 ? 'text-red-400' :
                  passwordLength > 110 ? 'text-yellow-400' :
                  'text-slate-400'
                }`}>
                  {passwordLength} / 128 characters
                  {passwordLength > 128 && ' - Password is too long!'}
                  {passwordLength > 110 && passwordLength <= 128 && ' - Getting close to limit'}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600/50 text-white rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all duration-300 placeholder-slate-400"
                placeholder="Confirm your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-700 transition-all duration-300 font-medium shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/50 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating Account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>

            <button
              type="button"
              onClick={() => setSignupMode('oauth')}
              className="w-full px-4 py-3 text-slate-300 hover:text-white transition-all duration-200 text-sm"
            >
              Back to Quick Sign Up
            </button>
          </form>
        )}

        {/* Divider */}
        <div className="mt-8 pt-6 border-t border-slate-700/50">
          {/* Features */}
          <div className="space-y-3 text-sm text-slate-300 mb-6">
            <div className="flex items-start gap-2 group">
              <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="group-hover:text-white transition-colors">AI-powered transcription and analysis</span>
            </div>
            <div className="flex items-start gap-2 group">
              <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="group-hover:text-white transition-colors">Automatic calendar event creation</span>
            </div>
            <div className="flex items-start gap-2 group">
              <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="group-hover:text-white transition-colors">Multi-language support (English & Arabic)</span>
            </div>
          </div>

          {/* Sign In Link */}
          <div className="text-center">
            <p className="text-sm text-slate-400">
              Already have an account?{' '}
              <Link href="/signin" className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0%, 100% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
        }
        @keyframes float {
          0%, 100% {
            transform: translateY(0px) translateX(0px);
          }
          50% {
            transform: translateY(-20px) translateX(10px);
          }
        }
        @keyframes float-slow {
          0%, 100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes gradient {
          0%, 100% {
            background-size: 200% 200%;
            background-position: left center;
          }
          50% {
            background-size: 200% 200%;
            background-position: right center;
          }
        }
        @keyframes shake {
          0%, 100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-10px);
          }
          75% {
            transform: translateX(10px);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-slow {
          animation: float-slow 3s ease-in-out infinite;
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out;
        }
        .animate-gradient {
          animation: gradient 3s ease infinite;
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
        .animation-delay-1000 {
          animation-delay: 1s;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-3000 {
          animation-delay: 3s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
