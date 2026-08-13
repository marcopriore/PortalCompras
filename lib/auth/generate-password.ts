import type { PasswordPolicy } from "@/lib/settings/password-policy-registry"
import { validatePasswordAgainstPolicy } from "@/lib/settings/password-policy-registry"

export function generatePasswordForPolicy(policy: PasswordPolicy): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
  const lower = "abcdefghjkmnpqrstuvwxyz"
  const digits = "23456789"
  const special = "@#$%&*"
  const all = upper + lower + digits + special
  const rand = (chars: string) =>
    chars[Math.floor(Math.random() * chars.length)]

  const required: string[] = []
  if (policy.requireUppercase) required.push(rand(upper))
  if (policy.requireLowercase) required.push(rand(lower))
  if (policy.requireDigit) required.push(rand(digits))
  if (policy.requireSpecial) required.push(rand(special))

  const minLen = Math.max(policy.minLength, required.length)
  const base = [...required]
  while (base.length < minLen) {
    base.push(rand(all))
  }

  let candidate = base.sort(() => Math.random() - 0.5).join("")
  let attempts = 0
  while (
    validatePasswordAgainstPolicy(candidate, policy).ok !== true &&
    attempts < 20
  ) {
    candidate = base.sort(() => Math.random() - 0.5).join("")
    attempts++
  }
  return candidate
}
