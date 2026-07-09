import Link from "next/link";
import { redirect } from "next/navigation";

import { isAdminSession } from "@/lib/authz";
import { STANDUP_TEMPLATES } from "@/lib/types";

import { createStandupAction } from "../actions";
import { StandupForm } from "../_components/standup-form";

export const dynamic = "force-dynamic";

export default async function NewStandupPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  if (!(await isAdminSession())) redirect("/standups");
  const { template } = await searchParams;

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-bold">New standup</h1>

      <div className="mt-4 flex gap-2">
        {STANDUP_TEMPLATES.map((t) => (
          <Link
            key={t.id}
            href={`/standups/new?template=${t.id}`}
            className={`rounded border px-3 py-1 text-sm ${
              template === t.id ? "bg-black text-white" : "hover:bg-gray-50"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <StandupForm action={createStandupAction} templateId={template} submitLabel="Create standup" />
    </main>
  );
}
