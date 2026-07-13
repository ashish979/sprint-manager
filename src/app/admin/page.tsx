import Link from "next/link";
import { redirect } from "next/navigation";

import { ConfirmSubmitButton } from "@/app/_components/confirm-submit-button";
import { ParticipantPicker } from "@/app/_components/participant-picker";
import { SubmitButton } from "@/app/_components/submit-button";
import { isAdminSession } from "@/lib/authz";
import { getTeamSettings } from "@/lib/db";
import { getSession } from "@/lib/session";
import { listUserOptions } from "@/lib/slack/directory";

import { grantRoleAction, revokeRoleAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!(await isAdminSession())) redirect("/standups");

  const [settings, users] = await Promise.all([getTeamSettings(), listUserOptions()]);
  const nameOf = (id: string) => users?.find((u) => u.id === id)?.name ?? id;
  const options = users?.map((u) => ({ value: u.id, label: u.name })) ?? [];

  return (
    <main className="mx-auto max-w-2xl p-6">
      <Link href="/standups" className="link link-hover text-sm text-base-content/60">
        ← Back
      </Link>

      <h1 className="mt-3 text-2xl font-bold">Team &amp; roles</h1>
      <p className="mt-1 text-sm text-base-content/60">
        Everyone in the workspace can view. <strong>Editors</strong> create standups/rotations and
        manage the ones they own; <strong>admins</strong> manage everything and grant roles. Role
        changes take effect on the person&apos;s next sign-in.
      </p>

      <RoleCard
        title="Admins"
        role="admin"
        ids={settings.adminSlackIds}
        nameOf={nameOf}
        options={options}
        selfId={session?.slackUserId}
      />
      <RoleCard
        title="Editors"
        role="editor"
        ids={settings.editorSlackIds}
        nameOf={nameOf}
        options={options}
        selfId={session?.slackUserId}
      />
    </main>
  );
}

function RoleCard({
  title,
  role,
  ids,
  nameOf,
  options,
  selfId,
}: {
  title: string;
  role: "admin" | "editor";
  ids: string[];
  nameOf: (id: string) => string;
  options: { value: string; label: string }[];
  selfId?: string;
}) {
  return (
    <section className="card mt-6 border border-base-300 bg-base-100 shadow-sm">
      <div className="card-body">
        <h2 className="text-lg font-semibold">{title}</h2>

        {ids.length === 0 ? (
          <p className="text-sm text-base-content/50">None yet.</p>
        ) : (
          <ul className="divide-y divide-base-200">
            {ids.map((id) => {
              const isSelf = role === "admin" && id === selfId;
              return (
                <li key={id} className="flex items-center justify-between py-2">
                  <span className="text-sm">
                    {nameOf(id)} <span className="text-base-content/40">{id}</span>
                    {isSelf && <span className="ml-1 text-base-content/40">(you)</span>}
                  </span>
                  {/* Can't remove yourself from Admins — avoids locking everyone out. */}
                  {!isSelf && (
                    <form action={revokeRoleAction}>
                      <input type="hidden" name="role" value={role} />
                      <input type="hidden" name="userId" value={id} />
                      <ConfirmSubmitButton
                        confirmText={`Remove ${nameOf(id)} from ${title.toLowerCase()}?`}
                        className="btn btn-ghost btn-xs text-error"
                      >
                        Remove
                      </ConfirmSubmitButton>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <form action={grantRoleAction} className="mt-3 flex items-end gap-2">
          <input type="hidden" name="role" value={role} />
          <div className="min-w-56 flex-1">
            {options.length > 0 ? (
              <ParticipantPicker name="userId" multi={false} options={options} />
            ) : (
              <input name="userId" placeholder="U0123ABC" className="input input-sm w-full" />
            )}
          </div>
          <SubmitButton className="btn btn-primary btn-sm" pendingText="Adding…">
            Add
          </SubmitButton>
        </form>
      </div>
    </section>
  );
}
