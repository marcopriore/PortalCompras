import type { SupabaseClient } from "@supabase/supabase-js"

type ProfileNameRow = {
  id: string
  full_name: string | null
}

/**
 * Batch-loads profile full names for the given user ids (.in).
 * Missing ids or null names map to an empty string.
 */
export async function enrichProfileNames(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))]
  if (unique.length === 0) {
    return new Map()
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", unique)

  if (error) {
    throw error
  }

  return new Map(
    ((data ?? []) as ProfileNameRow[]).map((p) => [p.id, p.full_name ?? ""]),
  )
}