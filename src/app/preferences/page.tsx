import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import { getUserProfile } from "@/lib/store/users";

import { clearOutOfOfficeAction, setOutOfOfficeAction, setPreferredTimeAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function PreferencesPage() {
  const session = await getSession();
  if (!session?.user || !session.slackUserId) redirect("/standups");

  const profile = await getUserProfile(session.slackUserId);

  return (
    <main className="mx-auto max-w-md p-8">
      <Link href="/standups" className="text-sm text-gray-500 underline">
        ← All standups
      </Link>

      <h1 className="mt-2 text-2xl font-bold">My preferences</h1>

      <form action={setPreferredTimeAction} className="mt-6">
        <label className="block text-sm font-medium">
          Preferred standup time (leave blank to use each standup&apos;s default)
          <input
            type="time"
            name="time"
            step={900}
            defaultValue={profile?.preferredTime ?? ""}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </label>
        <button className="mt-4 rounded bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-80">
          Save
        </button>
      </form>

      <h2 className="mt-8 text-lg font-semibold">Out of office</h2>
      <p className="mt-1 text-sm text-gray-500">
        You won&apos;t be prompted for any standup while away.
      </p>
      <form action={setOutOfOfficeAction} className="mt-3">
        <label className="block text-sm font-medium">
          From
          <input
            type="date"
            name="from"
            defaultValue={profile?.outOfOffice?.from ?? ""}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </label>
        <label className="mt-2 block text-sm font-medium">
          To
          <input
            type="date"
            name="to"
            defaultValue={profile?.outOfOffice?.to ?? ""}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
          />
        </label>
        <button className="mt-4 rounded bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-80">
          Set out-of-office
        </button>
      </form>
      {profile?.outOfOffice && (
        <form action={clearOutOfOfficeAction} className="mt-2">
          <button className="rounded border px-3 py-1.5 text-sm hover:bg-gray-50">
            Clear out-of-office
          </button>
        </form>
      )}
    </main>
  );
}
