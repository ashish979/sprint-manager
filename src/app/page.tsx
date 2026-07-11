import Image from "next/image";
import Link from "next/link";

import { signIn, signOut } from "@/auth";
import { getSession } from "@/lib/session";

// Session-dependent; never prerender (also keeps builds env-free).
export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();

  return (
    <main className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl flex-col items-center justify-center gap-8 p-6 text-center">
      <div className="flex flex-col items-center gap-4">
        <Image
          src="/logo.png"
          alt="Sprint Manager logo"
          width={56}
          height={56}
          unoptimized
          className="h-14 w-14 rounded-2xl object-cover shadow-sm"
        />
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Sprint Manager</h1>
        <p className="max-w-sm text-base-content/60">
          Async standups and duty rotations for your team, right inside Slack.
        </p>
      </div>

      {session?.user ? (
        <div className="card w-full max-w-sm border border-base-300 bg-base-100 shadow-sm">
          <div className="card-body items-center gap-5 text-center">
            <p className="text-base-content/70">
              Welcome back, <strong className="text-base-content">{session.user.name}</strong>
              {session.isAdmin && <span className="badge badge-primary badge-sm ml-2">Admin</span>}
            </p>

            <div className="flex gap-2">
              <Link href="/standups" className="btn btn-primary btn-sm">
                Go to Standups
              </Link>
              <Link href="/rotations" className="btn btn-outline btn-sm">
                Go to Rotations
              </Link>
            </div>

            {session.isDev ? (
              <p className="text-xs text-warning">dev session via DEV_USER — no Slack sign-in</p>
            ) : (
              <form
                action={async () => {
                  "use server";
                  await signOut();
                }}
              >
                <button className="link link-hover text-sm text-base-content/50">Sign out</button>
              </form>
            )}
          </div>
        </div>
      ) : (
        <form
          action={async () => {
            "use server";
            await signIn("slack");
          }}
        >
          <button className="btn btn-primary">Sign in with Slack</button>
        </form>
      )}
    </main>
  );
}
