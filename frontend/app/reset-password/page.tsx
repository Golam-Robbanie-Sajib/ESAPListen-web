import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import VerifyEmailContent from './VerifyEmailContent';

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-900 to-slate-900 flex items-center justify-center">
      <Loader2 className="w-16 h-16 animate-spin text-emerald-400" />
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}
