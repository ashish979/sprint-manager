import Image from "next/image";
import Link from "next/link";

import { signIn, signOut } from "@/auth";
import { getSession } from "@/lib/session";

import { CursorGlow } from "./_components/cursor-glow";

// Session-dependent; never prerender (also keeps builds env-free).
export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-8 text-center">
      <div
        aria-hidden
        className="glow-drift pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[840px] rounded-full bg-[#4A154B]/15 blur-3xl dark:bg-[#4A154B]/28"
      />
      <CursorGlow />

      <div className="relative flex flex-col items-center gap-8">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Sprint Manager logo"
            width={44}
            height={44}
            unoptimized
            className="h-11 w-11 rounded-xl object-cover"
          />
          <h1 className="text-4xl font-bold tracking-tight">Sprint Manager</h1>
        </div>

        <p className="max-w-sm text-lg text-zinc-500 dark:text-zinc-400">
          Standups and duty rotations for your team, right inside Slack.
        </p>

        {session?.user ? (
          <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-2xl border border-zinc-200 bg-white/80 p-6 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.06]">
            <p className="text-zinc-600 dark:text-zinc-300">
              Welcome back, <strong className="text-black dark:text-white">{session.user.name}</strong>
              {session.isAdmin && (
                <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
                  Admin
                </span>
              )}
            </p>

            <div className="flex gap-3">
              <Link
                href="/standups"
                className="rounded bg-black px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-80 dark:bg-white dark:text-black dark:hover:opacity-90"
              >
                Go to Standups
              </Link>
              <Link
                href="/rotations"
                className="rounded border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-700"
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
            <button className="rounded bg-[#4A154B] px-6 py-3 text-sm font-medium text-white shadow-sm hover:opacity-90">
              Sign in with Slack
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
