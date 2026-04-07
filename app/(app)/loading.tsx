export default function AppSegmentLoading() {
  return (
    <div
      className="flex min-h-[40vh] flex-col items-center justify-center gap-3 px-4 py-16"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-slate-700/80 border-t-teal-400"
        aria-hidden
      />
      <p className="text-sm text-slate-400">Loading workspace...</p>
    </div>
  );
}


