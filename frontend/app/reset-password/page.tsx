'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { authAPI } from '@/lib/api';
import { useToast } from '@/components/Toast';
import { Loader2, Lock, AlertCircle, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();

  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    const tokenFromUrl = searchParams.get('token');
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    } else {
      toast.error('Invalid reset link');
    }
  }, [searchParams]);

  // Password strength validation
  const passwordLength = password.length;
  const hasMinLength = passwordLength >= 8;
  const hasMaxLength = passwordLength <= 128;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const passwordStrength = [hasMinLength, hasUpperCase, hasLowerCase, hasNumber].filter(Boolean).length;
  const isPasswordValid = hasMinLength && hasMaxLength;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordLength < 8) {
      const errorMsg = 'Password must be at least 8 characters long';
      toast.error(errorMsg);
      return;
    }

    if (passwordLength > 128) {
      const errorMsg = `Password is too long (${passwordLength} characters). Maximum is 128 characters.`;
      toast.error(errorMsg);
      return;
    }

    if (password !== confirmPassword) {
      const errorMsg = 'Passwords do not match';
      toast.error(errorMsg);
      return;
    }

    setIsLoading(true);

    try {
      await authAPI.resetPassword(token, password);
      toast.success('Password reset successfully!');
      setResetSuccess(true);

      // Redirect to signin after 2 seconds
      setTimeout(() => {
        router.push('/signin');
      }, 2000);
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Failed to reset password. The link may be invalid or expired.';
      toast.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const PasswordRequirement = ({ met, text }: { met: boolean; text: string }) => (
    <div className={`flex items-center gap-2 text-sm transition-colors ${met ? 'text-emerald-400' : 'text-slate-400'}`}>
      {met ? (
        <CheckCircle2 className="w-4 h-4" />
      ) : (
        <XCircle className="w-4 h-4" />
      )}
      <span>{text}</span>
    </div>
  );

  if (resetSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 text-center">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Password Reset Successful!</h2>
            <p className="text-slate-300 mb-4">Redirecting to sign in...</p>
            <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mx-auto" />
          </div>
        </div>
      </div>
    );
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
          <p className="text-slate-300 text-lg">Create your new password</p>
        </div>

        {/* Main Card */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8">
          {!token ? (
            <div className="p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-200 text-sm font-medium mb-2">Invalid Reset Link</p>
                <p className="text-red-200 text-xs">
                  This password reset link is invalid or has expired. Please request a new one.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Password Input */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full pl-12 pr-12 py-4 bg-white/5 border rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                      password.length > 0 && !isPasswordValid
                        ? 'border-red-500/50 focus:ring-red-500'
                        : 'border-white/10 focus:ring-emerald-500'
                    }`}
                    placeholder="Create a strong password"
                    required
                    minLength={8}
                    maxLength={128}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {password && (
                  <div className="mt-3 space-y-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            passwordStrength >= level
                              ? passwordStrength <= 2
                                ? 'bg-red-500'
                                : passwordStrength === 3
                                ? 'bg-yellow-500'
                                : 'bg-emerald-500'
                              : 'bg-white/10'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <PasswordRequirement met={hasMinLength} text="8+ characters" />
                      <PasswordRequirement met={hasUpperCase} text="Uppercase" />
                      <PasswordRequirement met={hasLowerCase} text="Lowercase" />
                      <PasswordRequirement met={hasNumber} text="Number" />
                    </div>
                    {password.length > 0 && (
                      <p className={`text-xs ${
                        passwordLength > 128 ? 'text-red-400' :
                        passwordLength > 110 ? 'text-yellow-400' :
                        'text-slate-400'
                      }`}>
                        {passwordLength} / 128 characters
                        {passwordLength > 128 && ' - Too long!'}
                        {passwordLength > 110 && passwordLength <= 128 && ' - Getting close to limit'}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Confirm Password Input */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`w-full pl-12 pr-12 py-4 bg-white/5 border rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                      confirmPassword.length > 0 && !passwordsMatch
                        ? 'border-red-500/50 focus:ring-red-500'
                        : 'border-white/10 focus:ring-emerald-500'
                    }`}
                    placeholder="Confirm your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {confirmPassword.length > 0 && (
                  <p className={`text-xs mt-2 ${passwordsMatch ? 'text-emerald-400' : 'text-red-400'}`}>
                    {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !isPasswordValid || !passwordsMatch}
                className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-emerald-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Resetting password...</span>
                  </>
                ) : (
                  <span>Reset Password</span>
                )}
              </button>
            </form>
          )}

          {/* Back to Sign In */}
          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <Link
              href="/signin"
              className="text-slate-300 hover:text-white transition-colors"
            >
              Back to sign in
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
