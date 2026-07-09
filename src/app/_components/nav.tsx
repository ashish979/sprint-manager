import Image from "next/image";
import Link from "next/link";

import { signOut } from "@/auth";
import { getSession } from "@/lib/session";

/** Persistent top nav — every signed-in page links to every other page. */
export async function Nav() {
  const session = await getSession();
  if (!session?.user) return null;

  return (
    <nav className="flex items-center justify-between border-b border-zinc-200 px-6 py-3 dark:border-zinc-800">
      <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
        <Image
          src="/logo.png"
          alt=""
          width={24}
          height={24}
          unoptimized
          className="h-6 w-6 rounded-md object-cover"
        />
        Sprint Manager
      </Link>
      <div className="flex items-center gap-5 text-sm text-zinc-600 dark:text-zinc-400">
        <Link href="/standups" className="hover:text-black dark:hover:text-white">
          Standups
        </Link>
        <Link href="/rotations" className="hover:text-black dark:hover:text-white">
          Rotations
        </Link>
        <Link href="/preferences" className="hover:text-black dark:hover:text-white">
          My preferences
        </Link>
        {!session.isDev && (
          <form
            action={async () => {
              "use server";
              await signOut();
            }}
          >
            <button className="hover:text-black dark:hover:text-white">Sign out</button>
          </form>
        )}
      </div>
    </nav>
  );
}
