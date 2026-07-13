import Link from "next/link";
import { redirect } from "next/navigation";

import { isEditorSession } from "@/lib/authz";
import { listUserOptions } from "@/lib/slack/directory";

import { createRotationAction } from "../actions";
import { RotationForm } from "../_components/rotation-form";

export const dynamic = "force-dynamic";

export default async function NewRotationPage() {
  if (!(await isEditorSession())) redirect("/rotations");
  const users = await listUserOptions();

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/rotations" className="link link-hover text-sm text-base-content/60">
        ← All rotations
      </Link>

      <h1 className="mt-3 text-2xl font-bold">New rotation</h1>

      <RotationForm action={createRotationAction} submitLabel="Create rotation" users={users} />
    </main>
  );
}
