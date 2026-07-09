import Link from "next/link";

import { isAdminSession } from "@/lib/authz";
import { getSession } from "@/lib/session";
import { ensureChannelInfo } from "@/lib/store/channels";
import { listStandups } from "@/lib/store/standups";
import { formatTime12h } from "@/lib/tz";

export const dynamic = "force-dynamic";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default async function StandupsPage() {
  const session = await getSession();
  if (!session?.user) {
    return (
      <main className="mx-auto max-w-3xl p-8">
        <h1 className="text-2xl font-bold">Standups</h1>
        <p className="mt-4 text-zinc-500 dark:text-zinc-400">
          <Link href="/" className="underline">
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

  return (
    <main className="mx-auto max-w-3xl p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Standups</h1>
        {admin && (
          <Link
            href="/standups/new"
            className="rounded bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-80 dark:bg-white dark:text-black dark:hover:opacity-90"
          >
            New standup
          </Link>
        )}
      </div>

      {standups.length === 0 ? (
        <p className="mt-8 text-zinc-500 dark:text-zinc-400">
          No standups yet{admin ? " — create the first one." : "."}
        </p>
      ) : (
        <ul className="mt-6 divide-y rounded border dark:divide-zinc-800 dark:border-zinc-800">
          {standups.map((s) => (
            <li key={s.id}>
              <Link
                href={`/standups/${s.id}`}
                className="flex items-center justify-between gap-6 p-5 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{s.name}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
                    <span>#{channelNameById.get(s.channel) ?? s.channel}</span>
                    <span aria-hidden>·</span>
                    <span>{formatTime12h(s.time)}</span>
                    <span aria-hidden>·</span>
                    <span>{s.weekdays.map((d) => WEEKDAY_LABELS[d]).join(" ")}</span>
                  </div>
                </div>
                <span className="shrink-0 text-sm text-zinc-500 dark:text-zinc-400">
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
