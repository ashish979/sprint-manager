import Link from "next/link";

import { signOut } from "@/auth";
import { getSession } from "@/lib/session";

import { Logo } from "./logo";
import { SubmitButton } from "./submit-button";

/** Persistent top nav — every signed-in page links to every other page. */
export async function Nav() {
  const session = await getSession();
  if (!session?.user) return null;

  return (
    <header className="navbar sticky top-0 z-20 border-b border-base-300 bg-base-100/90 px-4 backdrop-blur sm:px-6">
      <div className="navbar-start">
        <Link href="/" className="flex items-center gap-2 text-base font-semibold">
          <Logo className="h-6 w-6 rounded-lg" />
          Josys Sprint Manager
        </Link>
      </div>
      <nav className="navbar-end gap-1 text-sm font-medium">
        <Link href="/standups" className="btn btn-ghost btn-sm">
          Standups
        </Link>
        <Link href="/rotations" className="btn btn-ghost btn-sm">
          Rotations
        </Link>
        <Link href="/preferences" className="btn btn-ghost btn-sm">
          Preferences
        </Link>
        {session.isAdmin && (
          <Link href="/admin" className="btn btn-ghost btn-sm">
            Admin
          </Link>
        )}
        {!session.isDev && (
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <SubmitButton className="btn btn-ghost btn-sm text-base-content/60">
              Sign out
            </SubmitButton>
          </form>
        )}
      </nav>
    </header>
  );
}
