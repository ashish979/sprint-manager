import { slack } from "@/lib/slack/client";

export interface UserOption {
  id: string;
  name: string;
}

/**
 * Participant picker for dashboard forms. Returns null (not an empty
 * array) on failure — e.g. missing scope — so the form can omit the
 * picker entirely rather than show one with no options.
 */
export async function listUserOptions(): Promise<UserOption[] | null> {
  try {
    const users = await slack.listUsers();
    return users.map((u) => ({ id: u.id, name: u.real_name || u.name }));
  } catch (error) {
    console.error("users.list failed:", error);
    return null;
  }
}
