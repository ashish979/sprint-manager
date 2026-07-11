import Link from "next/link";
import { redirect } from "next/navigation";

import { isAdminSession } from "@/lib/authz";
import { listUserOptions } from "@/lib/slack/directory";
import { STANDUP_TEMPLATES } from "@/lib/types";

import { createAndStartStandupAction, createStandupAction } from "../actions";
import { StandupForm } from "../_components/standup-form";

export const dynamic = "force-dynamic";

export default async function NewStandupPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  if (!(await isAdminSession())) redirect("/standups");
  const [{ template }, users] = await Promise.all([searchParams, listUserOptions()]);
  // "Daily Standup" is the implicit default template — make that explicit so
  // its pill shows as selected instead of landing with nothing highlighted.
  const activeTemplate = template ?? "daily";

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/standups" className="link link-hover text-sm text-base-content/60">
        ← All standups
      </Link>

      <h1 className="mt-3 text-2xl font-bold">New standup</h1>

      <p className="mt-4 text-sm font-medium text-base-content/60">Start from a template</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {STANDUP_TEMPLATES.map((t) => (
          <Link
            key={t.id}
            href={`/standups/new?template=${t.id}`}
            className={`btn btn-sm ${activeTemplate === t.id ? "btn-primary" : "btn-outline"}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <StandupForm
        action={createStandupAction}
        secondaryAction={createAndStartStandupAction}
        secondaryLabel="Create and start"
        templateId={activeTemplate}
        submitLabel="Create standup"
        users={users}
      />
    </main>
  );
}
