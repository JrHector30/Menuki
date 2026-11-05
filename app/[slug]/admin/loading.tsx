export default function AdminLoading() {
  return (
    <div className="space-y-6 pb-20 sm:pb-6 animate-pulse">
      {/* Title & description skeleton */}
      <div className="space-y-2">
        <div className="h-7 w-48 rounded-xl bg-neutral-200" />
        <div className="h-4 w-72 rounded-lg bg-neutral-200/70" />
      </div>

      {/* Metrics or Filters Row Skeleton */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="h-28 rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm">
          <div className="h-3 w-20 rounded bg-neutral-200" />
          <div className="mt-3 h-8 w-16 rounded-lg bg-neutral-200" />
        </div>
        <div className="h-28 rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm">
          <div className="h-3 w-24 rounded bg-neutral-200" />
          <div className="mt-3 h-8 w-20 rounded-lg bg-neutral-200" />
        </div>
        <div className="h-28 rounded-3xl border border-neutral-200/80 bg-white p-5 shadow-sm">
          <div className="h-3 w-20 rounded bg-neutral-200" />
          <div className="mt-3 h-8 w-14 rounded-lg bg-neutral-200" />
        </div>
      </div>

      {/* Main Content / Table Skeleton */}
      <div className="rounded-3xl border border-neutral-200/80 bg-white p-6 shadow-sm space-y-4">
        <div className="h-5 w-36 rounded-lg bg-neutral-200" />
        <div className="space-y-3 pt-2">
          <div className="h-12 w-full rounded-2xl bg-neutral-100" />
          <div className="h-12 w-full rounded-2xl bg-neutral-100" />
          <div className="h-12 w-full rounded-2xl bg-neutral-100" />
          <div className="h-12 w-full rounded-2xl bg-neutral-100" />
        </div>
      </div>
    </div>
  );
}
