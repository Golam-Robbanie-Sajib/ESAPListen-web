'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authAPI } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { useAuth } from '@/lib/auth-context';
import { Loader2, CheckCircle2, AlertCircle, Mail } from 'lucide-react';

export default function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { refreshUser } = useAuth();

  const [token, setToken] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'pending' | 'success' | 'error'>('pending');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const tokenFromUrl = searchParams?.get('token');
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
            <div className="flex flex-col items-center text-center space-y-4 animate-in fade-in">
              <CheckCircle2 className="w-16 h-16 text-emerald-400" />
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Email Verified!</h3>
                <p className="text-slate-300">Your email has been successfully verified. Redirecting to dashboard...</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {verificationStatus === 'error' && (
            <div className="flex flex-col items-center text-center space-y-6 animate-in fade-in">
              <AlertCircle className="w-16 h-16 text-red-400" />
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Verification Failed</h3>
                <p className="text-slate-300 mb-4">{errorMessage}</p>
              </div>

              <div className="w-full space-y-3">
                <Link
                  href="/signin"
                  className="block w-full px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-colors text-center"
                >
                  Back to Sign In
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
