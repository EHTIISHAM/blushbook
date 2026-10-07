/**
 * Shown the moment a tab is tapped, while that page's data loads, so the
 * dashboard answers straight away instead of looking stuck.
 */
export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse">
      <div className="h-7 w-44 rounded-full bg-bubble" />
      <div className="mt-3 h-4 w-72 max-w-full rounded-full bg-bubble" />
      <div className="mt-8 grid gap-3">
        {[0, 1, 2].map((row) => (
          <div key={row} className="card h-24 !shadow-none bg-bubble/60" />
        ))}
      </div>
    </div>
  );
}
