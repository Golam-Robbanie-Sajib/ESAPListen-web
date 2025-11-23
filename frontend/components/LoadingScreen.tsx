'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 10;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl -top-48 -left-48 animate-pulse"></div>
        <div className="absolute w-96 h-96 bg-green-500/10 rounded-full blur-3xl -bottom-48 -right-48 animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 text-center">
        {/* Logo */}
        <div className="mb-8 animate-in fade-in slide-in-from-top-4">
          <img
            src="/esapai_logo.png"
            alt="ESAPListen"
            className="h-20 w-20 rounded-2xl shadow-2xl mx-auto mb-4"
          />
          <h1 className="text-4xl font-bold">
            <span className="text-emerald-400">ESAP</span>
            <span className="text-green-300">Listen</span>
          </h1>
          <p className="text-slate-400 mt-2">AI Meeting Analysis</p>
        </div>

        {/* Loading spinner */}
        <div className="mb-6">
          <Loader2 className="w-12 h-12 animate-spin text-emerald-400 mx-auto" />
        </div>

        {/* Progress bar */}
        <div className="w-64 mx-auto">
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-slate-400 text-sm mt-3">Loading your workspace...</p>
        </div>
      </div>
    </div>
  );
}
