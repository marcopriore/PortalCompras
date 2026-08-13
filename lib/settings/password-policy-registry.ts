export type PasswordPolicyKey =
  | "password_min_length"
  | "password_require_uppercase"
  | "password_require_lowercase"
  | "password_require_digit"
  | "password_require_special"
  | "password_expiry_days"
  | "password_history_count"

export type PasswordPolicy = {
  minLength: number
  requireUppercase: boolean
  requireLowercase: boolean
  requireDigit: boolean
  requireSpecial: boolean
  expiryDays: number
  historyCount: number
}

export type PasswordPolicyFieldType = "number" | "boolean"

export type PasswordPolicyDefinition = {
  key: PasswordPolicyKey
  label: string
  description: string
  type: PasswordPolicyFieldType
  defaultValue: number | boolean
  min?: number
  max?: number
  unit?: string
}

export const PASSWORD_POLICY_REGISTRY: PasswordPolicyDefinition[] = [
  {
    key: "password_min_length",
    label: "Comprimento mínimo",
    description: "Quantidade mínima de caracteres da senha.",
    type: "number",
    defaultValue: 8,
    min: 8,
    max: 32,
    unit: "caracteres",
  },
  {
    key: "password_require_uppercase",
    label: "Exigir letra maiúscula",
    description: "Pelo menos uma letra maiúscula (A–Z).",
    type: "boolean",
    defaultValue: true,
  },
  {
    key: "password_require_lowercase",
    label: "Exigir letra minúscula",
    description: "Pelo menos uma letra minúscula (a–z).",
    type: "boolean",
    defaultValue: true,
  },
  {
    key: "password_require_digit",
    label: "Exigir número",
    description: "Pelo menos um dígito (0–9).",
    type: "boolean",
    defaultValue: true,
  },
  {
    key: "password_require_special",
    label: "Exigir caractere especial",
    description: "Pelo menos um caractere especial (@#$%&* etc.).",
    type: "boolean",
    defaultValue: true,
  },
  {
    key: "password_expiry_days",
    label: "Expiração programada",
    description:
      "Dias até a senha expirar. 0 = desabilitado. Usuário é obrigado a trocar ao expirar.",
    type: "number",
    defaultValue: 0,
    min: 0,
    max: 365,
    unit: "dias",
  },
  {
    key: "password_history_count",
    label: "Histórico de senhas",
    description:
      "Quantidade de senhas anteriores que não podem ser reutilizadas. 0 = desabilitado.",
    type: "number",
    defaultValue: 5,
    min: 0,
    max: 24,
    unit: "senhas",
  },
]

export const PASSWORD_POLICY_KEYS = PASSWORD_POLICY_REGISTRY.map((d) => d.key)

export function isPasswordPolicyKey(key: string): key is PasswordPolicyKey {
  return (PASSWORD_POLICY_KEYS as string[]).includes(key)
}

export function getPasswordPolicyDefinition(key: PasswordPolicyKey) {
  return PASSWORD_POLICY_REGISTRY.find((d) => d.key === key)
}

const SPECIAL_CHARS = /[@#$%^&*()_+\-=[\]{};':"\\|,.<>/?!~`]/

export function passwordPolicyToRules(policy: PasswordPolicy): string[] {
  const rules: string[] = [`Mínimo de ${policy.minLength} caracteres`]
  if (policy.requireUppercase) rules.push("Pelo menos uma letra maiúscula")
  if (policy.requireLowercase) rules.push("Pelo menos uma letra minúscula")
  if (policy.requireDigit) rules.push("Pelo menos um número")
  if (policy.requireSpecial) rules.push("Pelo menos um caractere especial")
  if (policy.historyCount > 0) {
    rules.push(
      `Não reutilizar as últimas ${policy.historyCount} senha(s)`,
    )
  }
  return rules
}

export function validatePasswordAgainstPolicy(
  password: string,
  policy: PasswordPolicy,
): { ok: true } | { ok: false; error: string } {
  if (password.length < policy.minLength) {
    return {
      ok: false,
      error: `A senha deve ter no mínimo ${policy.minLength} caracteres.`,
    }
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    return {
      ok: false,
      error: "A senha deve conter pelo menos uma letra maiúscula.",
    }
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    return {
      ok: false,
      error: "A senha deve conter pelo menos uma letra minúscula.",
    }
  }
  if (policy.requireDigit && !/\d/.test(password)) {
    return {
      ok: false,
      error: "A senha deve conter pelo menos um número.",
    }
  }
  if (policy.requireSpecial && !SPECIAL_CHARS.test(password)) {
    return {
      ok: false,
      error: "A senha deve conter pelo menos um caractere especial.",
    }
  }
  return { ok: true }
}

export { SPECIAL_CHARS }
