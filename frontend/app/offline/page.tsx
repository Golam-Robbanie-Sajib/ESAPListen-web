'use client';

import Link from 'next/link';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 text-center">
          {/* Icon */}
          <div className="w-20 h-20 bg-slate-700/50 rounded-full flex items-center justify-center mx-auto mb-6">
            <WifiOff className="w-10 h-10 text-slate-400" />
          </div>

          {/* Logo */}
          <div className="inline-flex items-center gap-3 mb-6">
            <img
              src="/esapai_logo.png"
              alt="ESAPListen"
              className="h-12 w-12 rounded-xl shadow-lg"
            />
            <h1 className="text-2xl font-bold">
              <span className="text-emerald-400">ESAP</span>
              <span className="text-green-300">Listen</span>
            </h1>
          </div>

          {/* Message */}
          <h2 className="text-xl font-semibold text-white mb-3">You're Offline</h2>
          <p className="text-slate-300 mb-8">
            It looks like you've lost your internet connection. Please check your network and try again.
          </p>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleRefresh}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-emerald-500/50 transition-all duration-300 flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              <span>Try Again</span>
            </button>

            <Link
              href="/"
              className="block w-full py-4 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl border border-white/10 hover:border-white/20 transition-all duration-300"
            >
              Go to Home
            </Link>
          </div>

          {/* Info */}
          <div className="mt-8 pt-6 border-t border-white/10">
            <p className="text-slate-400 text-sm">
              Don't worry, your data is safe. You can continue working once you're back online.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
