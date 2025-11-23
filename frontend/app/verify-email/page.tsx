'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authAPI } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/auth-context';
import { Loader2, CheckCircle2, AlertCircle, Mail } from 'lucide-react';
export const dynamic = 'force-dynamic';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { refreshUser } = useAuth();

  const [token, setToken] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
      handleVerification(tokenFromUrl);
    } else {
      setVerificationStatus('error');
      setErrorMessage('Invalid verification link - no token provided');
    }
  }, [searchParams]);

  const handleVerification = async (verificationToken: string) => {
    setIsVerifying(true);

    try {
      await authAPI.verifyEmail(verificationToken);
      toast.success('Email verified successfully!');
      setVerificationStatus('success');

      // Refresh user data to update email_verified status
      await refreshUser();

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Failed to verify email. The link may be invalid or expired.';
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
      setVerificationStatus('error');
    } finally {
      setIsVerifying(false);
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
          <p className="text-slate-300 text-lg">Email Verification</p>
        </div>

        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8">
          {/* Verifying State */}
          {isVerifying && verificationStatus === 'pending' && (
            <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in">
              <Loader2 className="w-16 h-16 animate-spin text-emerald-400" />
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Verifying your email...</h3>
                <p className="text-slate-300">Please wait while we verify your email address.</p>
              </div>
            </div>
          )}

          {/* Success State */}
          {verificationStatus === 'success' && (
            <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in slide-in-from-top-4">
              <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Email Verified!</h3>
                <p className="text-slate-300 mb-4">
                  Your email has been successfully verified. You now have full access to all features.
                </p>
                <div className="flex items-center justify-center gap-2 text-emerald-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Redirecting to dashboard...</span>
                </div>
              </div>
            </div>
          )}

          {/* Error State */}
          {verificationStatus === 'error' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-8 h-8 text-red-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-white mb-2">Verification Failed</h3>
                  <p className="text-slate-300 mb-4">{errorMessage}</p>
                </div>
              </div>

              <div className="p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-xl">
                <div className="flex items-start gap-3">
                  <Mail className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-yellow-200 text-sm">
                      The verification link may have expired or is invalid. You can request a new verification email from your account settings.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 pt-6 border-t border-white/10 text-center space-y-3">
            <Link
              href="/dashboard"
              className="inline-block px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-emerald-500/50 transition-all duration-300"
            >
              Go to Dashboard
            </Link>
            <div>
              <Link
                href="/signin"
                className="text-slate-300 hover:text-white transition-colors text-sm"
              >
                Back to sign in
              </Link>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-400 text-sm mt-8">
          Need help?{' '}
          <Link href="/settings" className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
            Contact Support
          </Link>
        </p>
      </div>
    </div>
  );
}
