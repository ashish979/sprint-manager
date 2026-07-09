import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { isAdminSession } from "@/lib/authz";
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

  const { template } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">Edit standup</h1>
      <p className="mt-1 text-sm text-gray-500">
        Removing a participant marks their currently pending report(s) as skipped so
        today&apos;s standup can still close.
      </p>

      <div className="mt-4 flex gap-2">
        {STANDUP_TEMPLATES.map((t) => (
          <Link
            key={t.id}
            href={`/standups/${id}/edit?template=${t.id}`}
            className={`rounded border px-3 py-1 text-sm ${
              template === t.id ? "bg-black text-white" : "hover:bg-gray-50"
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
      />
    </main>
  );
}
