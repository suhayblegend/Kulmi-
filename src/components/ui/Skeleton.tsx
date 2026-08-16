import React from 'react';

// A single shimmering placeholder block. Uses a calm pulse (not a spinner) so
// page loads feel like the content is arriving, not like the app is stuck.
export function Skeleton({ className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`animate-pulse bg-[#EFEAE1] rounded-lg ${className}`} {...rest} />;
}

// Skeleton for a single Discover profile card.
export function DiscoverCardSkeleton() {
  return (
    <div className="w-full overflow-hidden border border-[#E5E0D8] bg-white shadow-sm rounded-3xl">
      <Skeleton className="w-full h-72 sm:h-96 rounded-none" />
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-5 w-5 rounded-full" />
        </div>
        <Skeleton className="h-4 w-56" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-12 flex-1 rounded-xl" />
          <Skeleton className="h-12 w-24 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

// Skeleton row for lists (chats, activity, wards…).
export function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4">
      <Skeleton className="w-16 h-16 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-2/3" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  );
}
