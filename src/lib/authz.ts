import { getSession } from "@/lib/session";

/**
 * Dashboard authorization. Members can view; admins manage
 * (allowlist in TEAM#SETTINGS, snapshotted into the session JWT).
 *
 * DEV_ADMIN=true in .env.local makes any signed-in user an admin —
 * development only, for working without a seeded allowlist.
 */

function devAdminBypass(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEV_ADMIN === "true";
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) throw new Error("unauthorized: sign in first");
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (!session.isAdmin && !devAdminBypass()) {
    throw new Error("forbidden: admin access required");
  }
  return session;
}

export async function isAdminSession(): Promise<boolean> {
  const session = await getSession();
  return Boolean(session?.user && (session.isAdmin || devAdminBypass()));
}
