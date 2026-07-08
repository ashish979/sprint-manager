import Link from "next/link";

import { auth } from "@/auth";
import { isAdminSession } from "@/lib/authz";
import { listStandups } from "@/lib/store/standups";

export const dynamic = "force-dynamic";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default async function StandupsPage() {
  const session = await auth();
  if (!session?.user) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-bold">Standups</h1>
        <p className="mt-4 text-gray-500">
          <Link href="/" className="underline">
            Sign in with Slack
          </Link>{" "}
          to view standups.
        </p>
      </main>
    );
  }

  const [standups, admin] = await Promise.all([listStandups(), isAdminSession()]);

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Standups</h1>
        {admin && (
          <Link
            href="/standups/new"
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-80"
          >
            New standup
          </Link>
        )}
      </div>

      {standups.length === 0 ? (
        <p className="mt-8 text-gray-500">
          No standups yet{admin ? " — create the first one." : "."}
        </p>
      ) : (
        <ul className="mt-6 divide-y rounded border">
          {standups.map((s) => (
            <li key={s.id}>
              <Link
                href={`/standups/${s.id}`}
                className="flex items-baseline justify-between gap-4 p-4 hover:bg-gray-50"
              >
                <div>
                  <span className="font-medium">{s.name}</span>
                  <span className="ml-3 text-sm text-gray-500">
                    {s.time} local · {s.weekdays.map((d) => WEEKDAY_LABELS[d]).join(" ")}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {s.participants.length} participant{s.participants.length === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
