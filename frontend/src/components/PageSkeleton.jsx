import { Skeleton } from "@/components/ui/skeleton";

// Header: title + subtitle
function HeaderSkeleton() {
  return (
    <div className="mb-8">
      <Skeleton className="h-3 w-24 mb-2" />
      <Skeleton className="h-9 w-48 mb-2" />
      <Skeleton className="h-4 w-72" />
    </div>
  );
}

// Row of stat cards
function StatCardsSkeleton({ count = 3 }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-${count} gap-5 mb-8`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-[#E2E0D8] rounded-xl p-5">
          <Skeleton className="h-8 w-8 rounded-md mb-4" />
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-8 w-16" />
        </div>
      ))}
    </div>
  );
}

// List of card rows
function CardListSkeleton({ count = 4 }) {
  return (
    <div className="bg-white border border-[#E2E0D8] rounded-xl p-5">
      <Skeleton className="h-6 w-32 mb-4" />
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b border-[#E2E0D8]/50 last:border-0">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <div>
                <Skeleton className="h-4 w-40 mb-1" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

// Grid of doc/folder cards
function CardGridSkeleton({ count = 6 }) {
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-[#E2E0D8] rounded-xl p-5">
          <div className="flex items-start justify-between mb-3">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 w-4 rounded" />
          </div>
          <Skeleton className="h-5 w-3/4 mb-1" />
          <Skeleton className="h-4 w-1/2 mb-3" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Friends / user list rows
function UserListSkeleton({ count = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between p-3 bg-white border border-[#E2E0D8] rounded-xl">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div>
              <Skeleton className="h-4 w-32 mb-1" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      ))}
    </div>
  );
}

// Quiz history rows
function QuizListSkeleton({ count = 5 }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white border border-[#E2E0D8] rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <Skeleton className="h-4 w-48 mb-2" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-8 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Profile page
function ProfileSkeleton() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white border border-[#E2E0D8] rounded-xl p-6 mb-6 flex items-center gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div>
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-28" />
        </div>
      </div>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white border border-[#E2E0D8] rounded-xl p-5 mb-4">
          <Skeleton className="h-4 w-24 mb-3" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
      ))}
    </div>
  );
}

export default function PageSkeleton({ variant = "dashboard" }) {
  if (variant === "profile") return <ProfileSkeleton />;

  if (variant === "friends") {
    return (
      <div className="w-full">
        <HeaderSkeleton />
        <UserListSkeleton />
      </div>
    );
  }

  if (variant === "quiz-history") {
    return (
      <div className="w-full">
        <HeaderSkeleton />
        <QuizListSkeleton />
      </div>
    );
  }

  if (variant === "grid") {
    return (
      <div className="w-full">
        <HeaderSkeleton />
        <CardGridSkeleton />
      </div>
    );
  }

  if (variant === "list") {
    return (
      <div className="w-full">
        <HeaderSkeleton />
        <CardListSkeleton />
      </div>
    );
  }

  // dashboard (default) — stats + list
  return (
    <div className="w-full">
      <HeaderSkeleton />
      <StatCardsSkeleton count={variant === "teacher-dashboard" ? 4 : 3} />
      <CardListSkeleton />
    </div>
  );
}
