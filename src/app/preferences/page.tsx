import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import { getUserProfile } from "@/lib/store/users";

import { clearOutOfOfficeAction, setOutOfOfficeAction, setPreferredTimeAction } from "./actions";

export const dynamic = "force-dynamic";

const SAVED_MESSAGE: Record<string, string> = {
  time: "✅ Preferred time saved.",
  ooo: "✅ Out-of-office set.",
  "ooo-cleared": "✅ Out-of-office cleared.",
};

const inputClass =
  "mt-1 w-full rounded border px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100";
const primaryButtonClass =
  "mt-4 rounded bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-80 dark:bg-white dark:text-black dark:hover:opacity-90";

export default async function PreferencesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const session = await getSession();
  if (!session?.user || !session.slackUserId) redirect("/standups");

  const profile = await getUserProfile(session.slackUserId);
  const { saved } = await searchParams;
  const savedMessage = saved ? SAVED_MESSAGE[saved] : undefined;

  return (
    <main className="mx-auto max-w-md p-8">
      <Link href="/standups" className="text-sm text-zinc-500 underline dark:text-zinc-400">
        ← All standups
      </Link>

      <h1 className="mt-2 text-2xl font-bold">My preferences</h1>

      {savedMessage && (
        <p className="mt-4 rounded bg-green-50 px-3 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-300">
          {savedMessage}
        </p>
      )}

      <form action={setPreferredTimeAction} className="mt-6">
        <label className="block text-sm font-medium">
          Preferred standup time (leave blank to use each standup&apos;s default)
          <input
            type="time"
            name="time"
            step={900}
            defaultValue={profile?.preferredTime ?? ""}
            className={inputClass}
          />
        </label>
        <button className={primaryButtonClass}>Save</button>
      </form>

      <h2 className="mt-8 text-lg font-semibold">Out of office</h2>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        You won&apos;t be prompted for any standup while away.
      </p>
      <form action={setOutOfOfficeAction} className="mt-3">
        <label className="block text-sm font-medium">
          From
          <input
            type="date"
            name="from"
            defaultValue={profile?.outOfOffice?.from ?? ""}
            className={inputClass}
          />
        </label>
        <label className="mt-2 block text-sm font-medium">
          To
          <input
            type="date"
            name="to"
            defaultValue={profile?.outOfOffice?.to ?? ""}
            className={inputClass}
          />
        </label>
        <button className={primaryButtonClass}>Set out-of-office</button>
      </form>
      {profile?.outOfOffice && (
        <form action={clearOutOfOfficeAction} className="mt-2">
          <button className="rounded border px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
            Clear out-of-office
          </button>
        </form>
      )}
    </main>
  );
}
