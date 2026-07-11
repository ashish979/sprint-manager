import Link from "next/link";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import { getUserProfile } from "@/lib/store/users";

import { clearOutOfOfficeAction, setOutOfOfficeAction, setPreferredTimeAction } from "./actions";

export const dynamic = "force-dynamic";

const SAVED_MESSAGE: Record<string, string> = {
  time: "Preferred time saved.",
  ooo: "Out-of-office set.",
  "ooo-cleared": "Out-of-office cleared.",
};

const inputClass = "input w-full mt-1";

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
    <main className="mx-auto max-w-md p-6">
      <Link href="/standups" className="link link-hover text-sm text-base-content/60">
        ← All standups
      </Link>

      <h1 className="mt-3 text-2xl font-bold">My preferences</h1>

      {savedMessage && (
        <div role="alert" className="alert alert-success mt-4 py-2 text-sm">
          <span>{savedMessage}</span>
        </div>
      )}

      <div className="card mt-6 border border-base-300 bg-base-100 shadow-sm">
        <form action={setPreferredTimeAction} className="card-body">
          <label className="block text-sm font-medium">
            Preferred standup time
            <span className="block text-xs font-normal text-base-content/50">
              Leave blank to use each standup&apos;s default.
            </span>
            <input
              type="time"
              name="time"
              step={900}
              defaultValue={profile?.preferredTime ?? ""}
              className={inputClass}
            />
          </label>
          <button className="btn btn-primary btn-sm mt-3 w-fit">Save</button>
        </form>
      </div>

      <div className="card mt-4 border border-base-300 bg-base-100 shadow-sm">
        <div className="card-body">
          <h2 className="text-lg font-semibold">Out of office</h2>
          <p className="text-sm text-base-content/60">
            You won&apos;t be prompted for any standup while away.
          </p>
          <form action={setOutOfOfficeAction} className="mt-2">
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
            <button className="btn btn-primary btn-sm mt-3 w-fit">Set out-of-office</button>
          </form>
          {profile?.outOfOffice && (
            <form action={clearOutOfOfficeAction} className="mt-2">
              <button className="btn btn-ghost btn-sm">Clear out-of-office</button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
