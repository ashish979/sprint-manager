/** App-wide navigation fallback (nav stays; only the page area swaps). */
export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <span className="loading loading-spinner loading-lg text-primary" aria-label="Loading" />
    </div>
  );
}
