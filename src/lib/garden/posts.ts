import type { ObjectType } from "@/types/garden";

export type GardenPostPlacedObject = {
  id: string;
  objectType: ObjectType;
  recordingId: string | null;
  recordingUrl?: string;
  x: number;
  y: number;
  createdAt: string;
};

export type GardenPostRecord = {
  userId: string;
  backgroundId: string;
  seasonId: string;
  timeSlotId: string;
  ownerDisplayName?: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  placedObjects: GardenPostPlacedObject[];
};

type SupabaseGardenPostRow = {
  user_id?: unknown;
  background_id?: unknown;
  season_id?: unknown;
  time_slot_id?: unknown;
  owner_display_name?: unknown;
  published_at?: unknown;
  updated_at?: unknown;
  placed_objects?: unknown;
};

function isObjectType(value: unknown): value is ObjectType {
  return (
    value === "furin" ||
    value === "shishi-odoshi" ||
    value === "hanabi" ||
    value === "kane" ||
    value === "obake" ||
    value === "tyo-tyo" ||
    value === "kaeru" ||
    value === "hue" ||
    value === "suzume" ||
    value === "sansin" ||
    value === "mattya" ||
    value === "semi" ||
    value === "takibi" ||
    value === "akimusi" ||
    value === "ka"
  );
}

function isGardenPostPlacedObject(value: unknown): value is GardenPostPlacedObject {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<GardenPostPlacedObject>;

  return (
    typeof candidate.id === "string" &&
    isObjectType(candidate.objectType) &&
    typeof candidate.x === "number" &&
    Number.isFinite(candidate.x) &&
    typeof candidate.y === "number" &&
    Number.isFinite(candidate.y) &&
    (typeof candidate.recordingId === "string" || candidate.recordingId === null ||
      candidate.recordingId === undefined) &&
    (typeof candidate.recordingUrl === "string" || candidate.recordingUrl === undefined) &&
    typeof candidate.createdAt === "string"
  );
}

export function parseGardenPostPlacedObjects(rawValue: unknown): GardenPostPlacedObject[] {
  let parsedValue = rawValue;

  if (typeof rawValue === "string") {
    try {
      parsedValue = JSON.parse(rawValue) as unknown;
    } catch {
      return [];
    }
  }

  if (!Array.isArray(parsedValue)) {
    return [];
  }

  return parsedValue
    .filter(isGardenPostPlacedObject)
    .map((item) => ({
      ...item,
      recordingId: typeof item.recordingId === "string" ? item.recordingId : null,
      recordingUrl: typeof item.recordingUrl === "string" ? item.recordingUrl : undefined,
    }));
}

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
    ownerDisplayName: typeof row.owner_display_name === "string" ? row.owner_display_name : undefined,
    publishedAt: typeof row.published_at === "string" ? row.published_at : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    placedObjects: parseGardenPostPlacedObjects(row.placed_objects),
  };
}

export async function fetchPublishedGardenPosts(limit = 24) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return [] as GardenPostRecord[];
  }

  const requestUrl = new URL(`${supabaseUrl}/rest/v1/garden_posts`);
  const staleThresholdIso = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  requestUrl.searchParams.set(
    "select",
    "user_id,background_id,season_id,time_slot_id,owner_display_name,published_at,updated_at",
  );
  requestUrl.searchParams.set("published_at", "not.is.null");
  requestUrl.searchParams.set("updated_at", `gte.${staleThresholdIso}`);
  requestUrl.searchParams.set("order", "published_at.desc");
  requestUrl.searchParams.set("limit", String(limit));

  try {
    const response = await fetch(requestUrl.toString(), {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
      next: {
        revalidate: 30,
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
  const staleThresholdIso = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  requestUrl.searchParams.set(
    "select",
    "user_id,background_id,season_id,time_slot_id,owner_display_name,published_at,updated_at,placed_objects",
  );
  requestUrl.searchParams.set("user_id", `eq.${userId}`);
  requestUrl.searchParams.set("published_at", "not.is.null");
  requestUrl.searchParams.set("updated_at", `gte.${staleThresholdIso}`);
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
