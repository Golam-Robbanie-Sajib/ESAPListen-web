'use client';

import { useState } from 'react';
import Link from 'next/link';
import { authAPI } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Loader2, Mail, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';

export default function ForgotPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [resetUrl, setResetUrl] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const result = await authAPI.forgotPassword(email);
      toast.success('Password reset instructions sent to your email');
      setSubmitted(true);

      // For development: show the reset URL
      if (result.reset_url) {
        setResetUrl(result.reset_url);
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Failed to send reset instructions';
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

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
          <p className="text-slate-300 text-lg">Reset your password</p>
        </div>

        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8">
          {!submitted ? (
            <>
              <div className="mb-6 text-center">
                <p className="text-slate-300">
                  Enter your email address and we'll send you instructions to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email Input */}
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
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
                      <span>Sending...</span>
                    </>
                  ) : (
                    <span>Send Reset Instructions</span>
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
              {/* Success Message */}
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Check your email</h3>
                  <p className="text-slate-300">
                    If an account exists with <span className="font-medium text-emerald-400">{email}</span>,
                    you will receive password reset instructions shortly.
                  </p>
                </div>
              </div>

              {/* Development Only: Show Reset URL */}
              {resetUrl && (
                <div className="p-4 bg-blue-500/10 border border-blue-500/50 rounded-xl">
                  <div className="flex items-start gap-3 mb-2">
                    <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-blue-200 text-sm font-medium mb-2">Email Not Configured</p>
                      <p className="text-blue-200 text-xs mb-2">
                        SMTP is not configured. Click the link below to reset your password:
                      </p>
                      <Link
                        href={resetUrl.replace(window.location.origin, '')}
                        className="text-emerald-400 hover:text-emerald-300 text-sm break-all underline"
                      >
                        {resetUrl}
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Back to Sign In */}
          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <Link
              href="/signin"
              className="inline-flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to sign in</span>
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-400 text-sm mt-8">
          Remember your password?{' '}
          <Link href="/signin" className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
