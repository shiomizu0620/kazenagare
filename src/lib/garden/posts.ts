export type GardenPostRecord = {
  userId: string;
  backgroundId: string;
  seasonId: string;
  timeSlotId: string;
  publishedAt: string | null;
};

type SupabaseGardenPostRow = {
  user_id?: unknown;
  background_id?: unknown;
  season_id?: unknown;
  time_slot_id?: unknown;
  published_at?: unknown;
};

function normalizePostRow(row: SupabaseGardenPostRow): GardenPostRecord | null {
  if (
    typeof row.user_id !== "string" ||
    typeof row.background_id !== "string" ||
    typeof row.season_id !== "string" ||
    typeof row.time_slot_id !== "string"
  ) {
    return null;
  }

  return {
    userId: row.user_id,
    backgroundId: row.background_id,
    seasonId: row.season_id,
    timeSlotId: row.time_slot_id,
    publishedAt: typeof row.published_at === "string" ? row.published_at : null,
  };
}

export async function fetchPublishedGardenPosts(limit = 24) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return [] as GardenPostRecord[];
  }

  const requestUrl = new URL(`${supabaseUrl}/rest/v1/garden_posts`);
  requestUrl.searchParams.set(
    "select",
    "user_id,background_id,season_id,time_slot_id,published_at",
  );
  requestUrl.searchParams.set("published_at", "not.is.null");
  requestUrl.searchParams.set("order", "published_at.desc");
  requestUrl.searchParams.set("limit", String(limit));

  try {
    const response = await fetch(requestUrl.toString(), {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      next: {
        revalidate: 0,
      },
    });

    if (!response.ok) {
      return [] as GardenPostRecord[];
    }

    const data: unknown = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return [] as GardenPostRecord[];
    }

    return data
      .map((row) => normalizePostRow(row as SupabaseGardenPostRow))
      .filter((row): row is GardenPostRecord => row !== null);
  } catch {
    return [] as GardenPostRecord[];
  }
}

export async function fetchPublishedGardenPostByUserId(userId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !userId) {
    return null;
  }

  const requestUrl = new URL(`${supabaseUrl}/rest/v1/garden_posts`);
  requestUrl.searchParams.set("select", "user_id,background_id,season_id,time_slot_id,published_at");
  requestUrl.searchParams.set("user_id", `eq.${userId}`);
  requestUrl.searchParams.set("published_at", "not.is.null");
  requestUrl.searchParams.set("order", "published_at.desc");
  requestUrl.searchParams.set("limit", "1");

  try {
    const response = await fetch(requestUrl.toString(), {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      next: {
        revalidate: 0,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: unknown = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    return normalizePostRow(data[0] as SupabaseGardenPostRow);
  } catch {
    return null;
  }
}
