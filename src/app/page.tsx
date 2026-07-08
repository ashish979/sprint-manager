import Link from "next/link";

import { auth, signIn, signOut } from "@/auth";

// Session-dependent; never prerender (also keeps builds env-free).
export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-4xl font-bold">Sprint Manager</h1>
      <p className="text-lg text-gray-500">
        Async standups &amp; duty rotations — Slack-first, in-house.
      </p>

      {session?.user ? (
        <div className="flex flex-col items-center gap-2">
          <p>
            Signed in as <strong>{session.user.name}</strong>
            {session.isAdmin ? " · admin" : ""}
          </p>
          <Link href="/standups" className="text-sm underline">
            Go to standups →
          </Link>
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button className="rounded border px-4 py-2 text-sm hover:bg-gray-50">
              Sign out
            </button>
          </form>
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

      <p className="text-sm text-gray-400">Phase 2 · standups MVP</p>
    </main>
  );
}
