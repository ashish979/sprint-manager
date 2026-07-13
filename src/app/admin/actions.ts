"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/authz";
import { getTeamSettings, putTeamSettings } from "@/lib/db";

function roleKey(formData: FormData): "adminSlackIds" | "editorSlackIds" {
  return formData.get("role") === "admin" ? "adminSlackIds" : "editorSlackIds";
}

/** Add a Slack user to the admin or editor allowlist (admins only). */
export async function grantRoleAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) throw new Error("pick a user");
  const key = roleKey(formData);
  const settings = await getTeamSettings();
  await putTeamSettings({ ...settings, [key]: [...new Set([...settings[key], userId])] });
  revalidatePath("/admin");
}

/** Remove a Slack user from the admin or editor allowlist (admins only). */
export async function revokeRoleAction(formData: FormData): Promise<void> {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "").trim();
  const key = roleKey(formData);
  const settings = await getTeamSettings();
  await putTeamSettings({ ...settings, [key]: settings[key].filter((id) => id !== userId) });
  revalidatePath("/admin");
}
