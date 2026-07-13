import type { Session } from "next-auth";

import { getSession } from "@/lib/session";

/**
 * Dashboard authorization — three tiers:
 *  - Viewer: any signed-in workspace member. Read-only.
 *  - Editor: create standups/rotations and manage the ones they own.
 *  - Admin: manage everything and grant roles (allowlists in TEAM#SETTINGS,
 *    snapshotted into the session JWT at sign-in).
 *
 * DEV_ADMIN=true in .env makes any signed-in user an admin — development only,
 * for working without a seeded allowlist.
 */

function devAdminBypass(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.DEV_ADMIN === "true";
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session?.user) throw new Error("unauthorized: sign in first");
  return session;
}

// --- Admin (manage everything, grant roles) ---

export async function requireAdmin(): Promise<Session> {
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

// --- Editor (write access: create + manage own) ---

export async function requireEditor(): Promise<Session> {
  const session = await requireSession();
  if (!session.isEditor && !session.isAdmin && !devAdminBypass()) {
    throw new Error("forbidden: write access required");
  }
  return session;
}

export async function isEditorSession(): Promise<boolean> {
  const session = await getSession();
  return Boolean(session?.user && (session.isEditor || session.isAdmin || devAdminBypass()));
}

// --- Ownership (manage a specific item) ---

/** Admins manage anything; everyone else only what they created. */
export function canManage(session: Session, ownerId?: string): boolean {
  if (session.isAdmin || devAdminBypass()) return true;
  return Boolean(ownerId && session.slackUserId && session.slackUserId === ownerId);
}

export async function requireManage(ownerId?: string): Promise<Session> {
  const session = await requireSession();
  if (!canManage(session, ownerId)) {
    throw new Error("forbidden: you can only manage items you created");
  }
  return session;
}
