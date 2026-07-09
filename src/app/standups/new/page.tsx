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

      <p className="mt-4 text-sm font-medium text-zinc-500 dark:text-zinc-400">
        Start from a template
      </p>
      <div className="mt-2 flex gap-2">
        {STANDUP_TEMPLATES.map((t) => (
          <Link
            key={t.id}
            href={`/standups/new?template=${t.id}`}
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

      <StandupForm action={createStandupAction} templateId={template} submitLabel="Create standup" />
    </main>
  );
}
