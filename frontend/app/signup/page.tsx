'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { authAPI, calendarAPI } from '@/lib/api';
import { useToast } from '@/components/Toast';
import FeatureHighlights from '@/components/FeatureHighlights';
import Link from 'next/link';
import { Loader2, Mail, Lock, User, AlertCircle, Eye, EyeOff, CheckCircle2, XCircle } from 'lucide-react';

export default function SignUpPage() {
  const router = useRouter();
  const { login } = useAuth();
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const redirectAfterLogin = async (userData: any) => {
    // Always redirect to calendar OAuth for new users
    if (!userData.user.calendar_connected) {
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

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  // Password strength validation
  const passwordLength = formData.password.length;
  const hasMinLength = passwordLength >= 8;
  const hasMaxLength = passwordLength <= 128;
  const hasUpperCase = /[A-Z]/.test(formData.password);
  const hasLowerCase = /[a-z]/.test(formData.password);
  const hasNumber = /[0-9]/.test(formData.password);
  const passwordsMatch = formData.password === formData.confirmPassword && formData.confirmPassword.length > 0;

  const passwordStrength = [hasMinLength, hasUpperCase, hasLowerCase, hasNumber].filter(Boolean).length;
  const isPasswordValid = hasMinLength && hasMaxLength;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.name.trim()) {
      const errorMsg = 'Please enter your name';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    if (passwordLength < 8) {
      const errorMsg = 'Password must be at least 8 characters long';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    if (passwordLength > 128) {
      const errorMsg = `Password is too long (${passwordLength} characters). Maximum is 128 characters.`;
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      const errorMsg = 'Passwords do not match';
      setError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    setIsLoading(true);

    try {
      const result = await authAPI.emailRegister(
        formData.email,
        formData.password,
        formData.name
      );
      login(result);
      toast.success('Account created successfully! Welcome to ESAPListen');
      await redirectAfterLogin(result);
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Sign up failed. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
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
          <p className="text-slate-300 text-lg">Create your account to get started</p>
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

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Name Input */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="John Doe"
                  required
                />
              </div>
            </div>

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
                  className={`w-full pl-12 pr-12 py-4 bg-white/5 border rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                    formData.password.length > 0 && !isPasswordValid
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
              {formData.password && (
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
                  {formData.password.length > 0 && (
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
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className={`w-full pl-12 pr-12 py-4 bg-white/5 border rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                    formData.confirmPassword.length > 0 && !passwordsMatch
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
              {formData.confirmPassword.length > 0 && (
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
                  <span>Creating account...</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>
          </form>

          {/* Sign In Link */}
          <div className="mt-8 pt-6 border-t border-white/10 text-center">
            <p className="text-slate-300">
              Already have an account?{' '}
              <Link
                href="/signin"
                className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
              >
                Sign in
              </Link>
            </p>
          </div>

          {/* Feature Highlights */}
          <FeatureHighlights />
        </div>

        {/* Footer */}
        <p className="text-center text-slate-400 text-sm mt-8">
          By creating an account, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}
