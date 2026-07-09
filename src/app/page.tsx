import Link from "next/link";

import { signIn, signOut } from "@/auth";
import { getSession } from "@/lib/session";

// Session-dependent; never prerender (also keeps builds env-free).
export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8 text-center">
      <div>
        <h1 className="text-5xl font-bold tracking-tight">Sprint Manager</h1>
        <p className="mt-3 text-lg text-zinc-500 dark:text-zinc-400">
          Standups and duty rotations for your team, right inside Slack.
        </p>
      </div>

      {session?.user ? (
        <div className="flex flex-col items-center gap-4">
          <p className="text-zinc-600 dark:text-zinc-300">
            Welcome back, <strong className="text-black dark:text-white">{session.user.name}</strong>
            {session.isAdmin && (
              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                Admin
              </span>
            )}
          </p>

          <div className="flex gap-3">
            <Link
              href="/standups"
              className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-80 dark:bg-white dark:text-black dark:hover:opacity-90"
            >
              Go to Standups
            </Link>
            <Link
              href="/rotations"
              className="rounded border px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
            >
              Go to Rotations
            </Link>
          </div>

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
              <button className="text-sm text-zinc-500 underline hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
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
          <button className="rounded bg-[#4A154B] px-5 py-2.5 text-sm font-medium text-white hover:opacity-90">
            Sign in with Slack
          </button>
        </form>
      )}
    </main>
  );
}
