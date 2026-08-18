import type { IntegrationEndpointAuthType } from "@/lib/integrations/types"

const SENSITIVE_AUTH_KEYS = new Set(["token", "password", "headerValue"])

export function maskEndpointAuthConfig(
  authType: IntegrationEndpointAuthType,
  authConfig: Record<string, string> | null | undefined,
): Record<string, string> {
  const cfg = authConfig ?? {}
  const masked: Record<string, string> = {}

  for (const [key, value] of Object.entries(cfg)) {
    if (SENSITIVE_AUTH_KEYS.has(key) && value) {
      masked[key] = "••••••••"
    } else {
      masked[key] = value
    }
  }

  if (authType === "bearer" && !masked.token) masked.token = ""
  if (authType === "basic") {
    if (!masked.username) masked.username = ""
    if (!masked.password) masked.password = ""
  }
  if (authType === "api_key_header") {
    if (!masked.headerName) masked.headerName = ""
    if (!masked.headerValue) masked.headerValue = ""
  }

  return masked
}

export function mergeEndpointAuthConfig(
  authType: IntegrationEndpointAuthType,
  existing: Record<string, string> | null | undefined,
  incoming: Record<string, string> | null | undefined,
): Record<string, string> {
  const base = { ...(existing ?? {}) }
  const next = { ...(incoming ?? {}) }

  for (const [key, value] of Object.entries(next)) {
    if (SENSITIVE_AUTH_KEYS.has(key) && (value === "••••••••" || value === "")) {
      continue
    }
    base[key] = value
  }

  if (authType === "none") return {}

  return base
}

export function buildAuthConfigFromBody(
  authType: IntegrationEndpointAuthType,
  raw: unknown,
): Record<string, string> | string {
  if (authType === "none") return {}

  if (!raw || typeof raw !== "object") {
    return "auth_config inválido."
  }

  const cfg = raw as Record<string, unknown>

  switch (authType) {
    case "bearer": {
      const token = String(cfg.token ?? "").trim()
      if (!token || token === "••••••••") return "token é obrigatório para auth bearer."
      return { token }
    }
    case "basic": {
      const username = String(cfg.username ?? "").trim()
      const password = String(cfg.password ?? "").trim()
      if (!username) return "username é obrigatório para auth basic."
      if (!password || password === "••••••••") {
        return "password é obrigatório para auth basic."
      }
      return { username, password }
    }
    case "api_key_header": {
      const headerName = String(cfg.headerName ?? "").trim()
      const headerValue = String(cfg.headerValue ?? "").trim()
      if (!headerName) return "headerName é obrigatório."
      if (!headerValue || headerValue === "••••••••") {
        return "headerValue é obrigatório."
      }
      return { headerName, headerValue }
    }
    default:
      return {}
  }
}
