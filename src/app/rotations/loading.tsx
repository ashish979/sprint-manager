/** List skeleton for /rotations and its child routes while they load. */
export default function Loading() {
  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="skeleton h-8 w-40" />
          <div className="skeleton mt-2 h-4 w-56" />
        </div>
        <div className="skeleton h-9 w-32 rounded-field" />
      </div>
      <div className="mt-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-20 w-full rounded-box" />
        ))}
      </div>
    </main>
  );
}
