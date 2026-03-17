import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }

  return supabaseClient;
}

function isInvalidRefreshTokenError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";
  const code =
    "code" in error && typeof error.code === "string"
      ? error.code.toLowerCase()
      : "";
  const errorDescription =
    "error_description" in error && typeof error.error_description === "string"
      ? error.error_description.toLowerCase()
      : "";

  return (
    message.includes("invalid refresh token") ||
    message.includes("refresh token not found") ||
    message.includes("refresh_token_not_found") ||
    message.includes("invalid_grant") ||
    code.includes("refresh_token_not_found") ||
    code.includes("invalid_grant") ||
    errorDescription.includes("refresh token not found") ||
    errorDescription.includes("refresh_token_not_found") ||
    errorDescription.includes("invalid_grant")
  );
}

function getSupabaseAuthStorageKey(): string | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return null;
  }

  try {
    const host = new URL(supabaseUrl).hostname;
    const projectRef = host.split(".")[0];
    if (!projectRef) {
      return null;
    }

    return `sb-${projectRef}-auth-token`;
  } catch {
    return null;
  }
}

function clearSupabaseAuthStorageFallback() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const authStorageKey = getSupabaseAuthStorageKey();
    if (authStorageKey) {
      window.localStorage.removeItem(authStorageKey);
      return;
    }

    const keysToRemove: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      window.localStorage.removeItem(key);
    }
  } catch {
    // Ignore storage cleanup failures.
  }
}

async function clearLocalSupabaseSession(supabase: SupabaseClient) {
  try {
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      clearSupabaseAuthStorageFallback();
    }
  } catch {
    clearSupabaseAuthStorageFallback();
  }
}

export async function getSupabaseSessionOrNull(
  supabase: SupabaseClient | null,
): Promise<Session | null> {
  if (!supabase) {
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      if (isInvalidRefreshTokenError(error)) {
        await clearLocalSupabaseSession(supabase);
      }

      return null;
    }

    return data.session ?? null;
  } catch (error) {
    if (isInvalidRefreshTokenError(error)) {
      await clearLocalSupabaseSession(supabase);
    }

    return null;
  }
}
