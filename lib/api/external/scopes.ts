export const API_SCOPES = [
  "items:read",
  "items:write",
  "suppliers:read",
  "suppliers:write",
  "requisitions:read",
  "requisitions:write",
  "quotations:read",
  "orders:read",
  "contracts:read",
  "approvals:read",
  "approvals:write",
] as const

export type ApiScope = (typeof API_SCOPES)[number]

export function isApiScope(value: string): value is ApiScope {
  return (API_SCOPES as readonly string[]).includes(value)
}

export function parseApiScopes(values: string[] | null | undefined): ApiScope[] {
  if (!values?.length) return []
  return values.filter(isApiScope)
}

export function hasApiScope(scopes: readonly string[], required: ApiScope): boolean {
  return scopes.includes(required)
}
