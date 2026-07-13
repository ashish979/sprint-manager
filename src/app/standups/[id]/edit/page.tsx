import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { canManage } from "@/lib/authz";
import { getSession } from "@/lib/session";
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
  const session = await getSession();
  if (!session?.user) redirect("/standups");

  const { id } = await params;
  const standup = await getStandup(id);
  if (!standup) notFound();
  if (!canManage(session, standup.ownerId)) redirect(`/standups/${id}`);

  const [{ template }, users] = await Promise.all([searchParams, listUserOptions()]);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href={`/standups/${id}`} className="link link-hover text-sm text-base-content/60">
        ← {standup.name}
      </Link>

      <h1 className="mt-3 text-2xl font-bold">Edit standup</h1>
      <p className="mt-1 text-sm text-base-content/60">
        Removing a participant marks their currently pending report(s) as skipped so
        today&apos;s standup can still close.
      </p>

      <p className="mt-4 text-sm font-medium text-base-content/60">
        Replace questions from a template
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {STANDUP_TEMPLATES.map((t) => (
          <Link
            key={t.id}
            href={`/standups/${id}/edit?template=${t.id}`}
            className={`btn btn-sm ${template === t.id ? "btn-primary" : "btn-outline"}`}
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
