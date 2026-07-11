import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { isAdminSession } from "@/lib/authz";
import { listUserOptions } from "@/lib/slack/directory";
import { getRotation } from "@/lib/store/rotations";

import { updateRotationAction } from "../../actions";
import { RotationForm } from "../../_components/rotation-form";

export const dynamic = "force-dynamic";

export default async function EditRotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!(await isAdminSession())) redirect("/rotations");

  const { id } = await params;
  const rotation = await getRotation(id);
  if (!rotation) notFound();
  const users = await listUserOptions();

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href={`/rotations/${id}`} className="link link-hover text-sm text-base-content/60">
        ← {rotation.name}
      </Link>

      <h1 className="mt-3 text-2xl font-bold">Edit rotation</h1>
      <p className="mt-1 text-sm text-base-content/60">
        Changing the member list keeps everyone&apos;s relative order but may shift who&apos;s
        next up.
      </p>

      <RotationForm
        action={updateRotationAction}
        rotation={rotation}
        submitLabel="Save changes"
        users={users}
      />
    </main>
  );
}
