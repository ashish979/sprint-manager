import Link from "next/link";
import { redirect } from "next/navigation";

import { isAdminSession } from "@/lib/authz";

import { createRotationAction } from "../actions";
import { RotationForm } from "../_components/rotation-form";

export const dynamic = "force-dynamic";

export default async function NewRotationPage() {
  if (!(await isAdminSession())) redirect("/rotations");

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Link href="/rotations" className="text-sm text-zinc-500 underline dark:text-zinc-400">
        ← All rotations
      </Link>

      <h1 className="mt-2 text-2xl font-bold">New rotation</h1>

      <RotationForm action={createRotationAction} submitLabel="Create rotation" />
    </main>
  );
}
