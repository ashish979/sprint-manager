import Link from "next/link";

import { isAdminSession } from "@/lib/authz";
import { getSession } from "@/lib/session";
import { ensureChannelInfo } from "@/lib/store/channels";
import { getDay } from "@/lib/store/reports";
import { listStandups } from "@/lib/store/standups";
import { formatTime12h, todayIst } from "@/lib/tz";

export const dynamic = "force-dynamic";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const STATUS_BADGE = {
  closed: { label: "Closed", className: "badge-ghost" },
  open: { label: "In progress", className: "badge-success" },
  notStarted: { label: "Not started", className: "badge-ghost" },
} as const;

export default async function StandupsPage() {
  const session = await getSession();
  if (!session?.user) {
    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-bold">Standups</h1>
        <p className="mt-4 text-base-content/60">
          <Link href="/" className="link link-primary">
            Sign in with Slack
          </Link>{" "}
          to view standups.
        </p>
      </main>
    );
  }

  const [standups, admin] = await Promise.all([listStandups(), isAdminSession()]);

  // Several standups can share a channel — look each unique id up once.
  const uniqueChannelIds = [...new Set(standups.map((s) => s.channel))];
  const channelInfos = await Promise.all(uniqueChannelIds.map((id) => ensureChannelInfo(id)));
  const channelNameById = new Map(uniqueChannelIds.map((id, i) => [id, channelInfos[i]?.name]));

  const today = todayIst();
  const todaysDays = await Promise.all(standups.map((s) => getDay(s.id, today)));
  const statusById = new Map(
    standups.map((s, i) => [s.id, todaysDays[i] ? todaysDays[i]!.status : "notStarted"] as const),
  );

  return (
    <main className="mx-auto max-w-3xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Standups</h1>
          <p className="text-sm text-base-content/50">Async daily check-ins in Slack.</p>
        </div>
        {admin && (
          <Link href="/standups/new" className="btn btn-primary btn-sm">
            + New standup
          </Link>
        )}
      </div>

      {standups.length === 0 ? (
        <div className="mt-8 rounded-box border border-dashed border-base-300 bg-base-100 p-10 text-center text-base-content/60">
          No standups yet{admin ? " — create the first one." : "."}
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {standups.map((s) => {
            const status = STATUS_BADGE[statusById.get(s.id) ?? "notStarted"];
            return (
              <li key={s.id}>
                <Link
                  href={`/standups/${s.id}`}
                  className="card border border-base-300 bg-base-100 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="card-body flex-row items-center justify-between gap-6 p-5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{s.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-base-content/60">
                        <span>#{channelNameById.get(s.channel) ?? s.channel}</span>
                        <span aria-hidden>·</span>
                        <span>{formatTime12h(s.time)}</span>
                        <span aria-hidden>·</span>
                        <span>{s.weekdays.map((d) => WEEKDAY_LABELS[d]).join(" ")}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className={`badge badge-sm ${status.className}`}>{status.label}</span>
                      <span className="text-sm text-base-content/50">
                        {s.participants.length} member{s.participants.length === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
