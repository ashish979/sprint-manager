import Link from "next/link";

import { isAdminSession } from "@/lib/authz";
import { getSession } from "@/lib/session";
import { listRotations } from "@/lib/store/rotations";
import { getLatestShift } from "@/lib/store/shifts";
import { getUserProfile } from "@/lib/store/users";

export const dynamic = "force-dynamic";

export default async function RotationsPage() {
  const session = await getSession();
  if (!session?.user) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-bold">Rotations</h1>
        <p className="mt-4 text-gray-500">
          <Link href="/" className="underline">
            Sign in with Slack
          </Link>{" "}
          to view rotations.
        </p>
      </main>
    );
  }

  const [rotations, admin] = await Promise.all([listRotations(), isAdminSession()]);
  const onDuty = await Promise.all(rotations.map((r) => getLatestShift(r.id)));
  const profiles = await Promise.all(
    onDuty.map((s) => (s ? getUserProfile(s.assignee) : Promise.resolve(undefined))),
  );

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rotations</h1>
        {admin && (
          <Link
            href="/rotations/new"
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-80"
          >
            New rotation
          </Link>
        )}
      </div>

      {rotations.length === 0 ? (
        <p className="mt-8 text-gray-500">
          No rotations yet{admin ? " — create the first one." : "."}
        </p>
      ) : (
        <ul className="mt-6 divide-y rounded border">
          {rotations.map((r, i) => (
            <li key={r.id}>
              <Link
                href={`/rotations/${r.id}`}
                className="flex items-baseline justify-between gap-4 p-4 hover:bg-gray-50"
              >
                <div>
                  <span className="font-medium">{r.name}</span>
                  <span className="ml-3 text-sm text-gray-500">
                    {r.cadence} · {r.members.length} member{r.members.length === 1 ? "" : "s"}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {onDuty[i]
                    ? `on duty: ${profiles[i]?.name ?? onDuty[i]!.assignee}`
                    : "not rotated yet"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
