export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-700 rounded ${className}`}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <Skeleton className="h-6 w-3/4 mb-4" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-5/6 mb-2" />
      <Skeleton className="h-4 w-4/6" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <Skeleton className="h-8 w-16 mb-2" />
      <Skeleton className="h-4 w-24" />
    </div>
  );
}

export function TaskCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border-l-4 border-gray-300 p-4">
      <div className="flex items-start gap-4">
        <Skeleton className="w-6 h-6 rounded-full flex-shrink-0 mt-1" />
        <div className="flex-1">
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-4 w-full mb-2" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-sm border-l-4 border-gray-300 p-4">
      <Skeleton className="h-5 w-2/3 mb-2" />
      <Skeleton className="h-4 w-full mb-3" />
      <div className="flex gap-3">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-20" />
      </div>
    </div>
  );
}
