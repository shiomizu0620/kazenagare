import type { User } from "@supabase/supabase-js";

export function isAnonymousSupabaseUser(user: User | null | undefined) {
  if (!user) {
    return false;
  }

  const userWithAnonymousFlag = user as User & {
    is_anonymous?: boolean;
  };

  if (userWithAnonymousFlag.is_anonymous) {
    return true;
  }

  if (user.app_metadata?.provider === "anonymous") {
    return true;
  }

  return user.identities?.some((identity) => identity.provider === "anonymous") ?? false;
}