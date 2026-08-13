import type { SupabaseClient } from "@supabase/supabase-js"
import type { PasswordPolicy } from "@/lib/settings/password-policy-registry"
import { validatePasswordAgainstPolicy } from "@/lib/settings/password-policy-registry"
import {
  hashPasswordForHistory,
  verifyPasswordAgainstHistoryHash,
} from "@/lib/auth/password-hash"

export async function isPasswordInHistory(
  supabase: SupabaseClient,
  userId: string,
  password: string,
  historyCount: number,
): Promise<boolean> {
  if (historyCount <= 0) return false

  const { data, error } = await supabase
    .from("user_password_history")
    .select("password_hash")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(historyCount)

  if (error) {
    console.error("isPasswordInHistory:", error)
    return false
  }

  return (data ?? []).some((row) =>
    verifyPasswordAgainstHistoryHash(password, String(row.password_hash)),
  )
}

export async function validateNewPasswordForTenant(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  password: string,
  policy: PasswordPolicy,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const basic = validatePasswordAgainstPolicy(password, policy)
  if (!basic.ok) return basic

  if (policy.historyCount > 0) {
    const reused = await isPasswordInHistory(
      supabase,
      userId,
      password,
      policy.historyCount,
    )
    if (reused) {
      return {
        ok: false,
        error: `Não é permitido reutilizar as últimas ${policy.historyCount} senha(s).`,
      }
    }
  }

  return { ok: true }
}

export async function recordPasswordHistory(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  password: string,
  historyCount: number,
): Promise<void> {
  const passwordHash = hashPasswordForHistory(password)
  const { error: insertError } = await supabase
    .from("user_password_history")
    .insert({
      user_id: userId,
      company_id: companyId,
      password_hash: passwordHash,
    })

  if (insertError) {
    console.error("recordPasswordHistory insert:", insertError)
    return
  }

  if (historyCount <= 0) return

  const { data: rows, error: listError } = await supabase
    .from("user_password_history")
    .select("id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (listError || !rows) return

  const toDelete = rows.slice(historyCount).map((r) => r.id)
  if (toDelete.length === 0) return

  await supabase.from("user_password_history").delete().in("id", toDelete)
}

export async function applyPasswordChange(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  newPassword: string,
  policy: PasswordPolicy,
): Promise<void> {
  await recordPasswordHistory(
    supabase,
    userId,
    companyId,
    newPassword,
    policy.historyCount,
  )

  const { error } = await supabase
    .from("profiles")
    .update({ password_changed_at: new Date().toISOString() })
    .eq("id", userId)

  if (error) {
    console.error("applyPasswordChange profiles:", error)
  }
}
