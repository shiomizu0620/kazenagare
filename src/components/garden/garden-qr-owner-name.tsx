"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient, getSupabaseSessionOrNull } from "@/lib/supabase/client";

type GardenQrOwnerNameProps = {
  userId: string;
  fallbackName: string;
};

function normalizeLabel(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function resolveDisplayName(sessionUser: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
} | null | undefined) {
  if (!sessionUser) {
    return null;
  }

  const userMetadata = sessionUser.user_metadata;
  const candidateKeys = [
    "display_name",
    "displayName",
    "full_name",
    "fullName",
    "name",
    "user_name",
    "username",
  ];

  for (const key of candidateKeys) {
    const candidateValue = normalizeLabel(userMetadata?.[key]);
    if (candidateValue) {
      return candidateValue;
    }
  }

  if (typeof sessionUser.email === "string") {
    const emailLocalPart = normalizeLabel(sessionUser.email.split("@")[0]);
    if (emailLocalPart) {
      return emailLocalPart;
    }
  }

  return null;
}

export function GardenQrOwnerName({ userId, fallbackName }: GardenQrOwnerNameProps) {
  const [ownerName, setOwnerName] = useState(fallbackName);

  useEffect(() => {
    setOwnerName(fallbackName);
  }, [fallbackName]);

  useEffect(() => {
    if (userId !== "me") {
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return;
    }

    let isCancelled = false;

    void getSupabaseSessionOrNull(supabase).then((session) => {
      if (isCancelled) {
        return;
      }

      const resolvedName = resolveDisplayName(session?.user);
      if (resolvedName) {
        setOwnerName(resolvedName);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [userId]);

  return <>{ownerName}</>;
}
