import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { isAdminSession } from "@/lib/authz";
import { listUserOptions } from "@/lib/slack/directory";
import { getStandup } from "@/lib/store/standups";
import { STANDUP_TEMPLATES } from "@/lib/types";

import { updateStandupAction } from "../../actions";
import { StandupForm } from "../../_components/standup-form";

export const dynamic = "force-dynamic";

export default async function EditStandupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  if (!(await isAdminSession())) redirect("/standups");

  const { id } = await params;
  const standup = await getStandup(id);
  if (!standup) notFound();

  const [{ template }, users] = await Promise.all([searchParams, listUserOptions()]);

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Link href={`/standups/${id}`} className="text-sm text-zinc-500 underline dark:text-zinc-400">
        ← {standup.name}
      </Link>

      <h1 className="mt-2 text-2xl font-bold">Edit standup</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Removing a participant marks their currently pending report(s) as skipped so
        today&apos;s standup can still close.
      </p>

      <p className="mt-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
        Replace questions from a template
      </p>
      <div className="mt-2 flex gap-2">
        {STANDUP_TEMPLATES.map((t) => (
          <Link
            key={t.id}
            href={`/standups/${id}/edit?template=${t.id}`}
            className={`rounded border px-3 py-1 text-sm dark:border-zinc-700 ${
              template === t.id
                ? "bg-black text-white dark:bg-white dark:text-black"
                : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <StandupForm
        action={updateStandupAction}
        standup={standup}
        templateId={template}
        submitLabel="Save changes"
        users={users}
      />
    </main>
  );
}
