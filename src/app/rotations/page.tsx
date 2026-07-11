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
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold">Rotations</h1>
        <p className="mt-4 text-base-content/60">
          <Link href="/" className="link link-primary">
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
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rotations</h1>
          <p className="text-sm text-base-content/50">On-call &amp; duty schedules.</p>
        </div>
        {admin && (
          <Link href="/rotations/new" className="btn btn-primary btn-sm">
            + New rotation
          </Link>
        )}
      </div>

      {rotations.length === 0 ? (
        <div className="mt-8 rounded-box border border-dashed border-base-300 bg-base-100 p-10 text-center text-base-content/60">
          No rotations yet{admin ? " — create the first one." : "."}
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {rotations.map((r, i) => (
            <li key={r.id}>
              <Link
                href={`/rotations/${r.id}`}
                className="card border border-base-300 bg-base-100 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="card-body flex-row items-center justify-between gap-4 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{r.name}</div>
                    <div className="mt-1 text-sm text-base-content/60">
                      {r.cadence} · {r.members.length} member{r.members.length === 1 ? "" : "s"}
                    </div>
                  </div>
                  {onDuty[i] ? (
                    <span className="badge badge-primary badge-outline shrink-0">
                      On duty: {profiles[i]?.name ?? onDuty[i]!.assignee}
                    </span>
                  ) : (
                    <span className="badge badge-ghost shrink-0">not rotated yet</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
