import { signIn, signOut } from "@/auth";
import { getSession } from "@/lib/session";

// Session-dependent; never prerender (also keeps builds env-free).
export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold">Sprint Manager</h1>
      <p className="text-lg text-zinc-500 dark:text-zinc-400">
        Async standups &amp; duty rotations — Slack-first, in-house.
      </p>

      {session?.user ? (
        <div className="flex flex-col items-center gap-2">
          <p>
            Signed in as <strong>{session.user.name}</strong>
            {session.isAdmin ? " · admin" : ""}
          </p>
          {session.isDev ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              dev session via DEV_USER — no Slack sign-in
            </p>
          ) : (
            <form
              action={async () => {
                "use server";
                await signOut();
              }}
            >
              <button className="rounded border px-4 py-2 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
                Sign out
              </button>
            </form>
          )}
        </div>
      ) : (
        <form
          action={async () => {
            "use server";
            await signIn("slack");
          }}
        >
          <button className="rounded bg-[#4A154B] px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            Sign in with Slack
          </button>
        </form>
      )}

      <p className="text-sm text-zinc-400 dark:text-zinc-500">Phase 3 · standups + rotations MVP</p>
    </main>
  );
}
