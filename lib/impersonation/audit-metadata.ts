import type { ImpersonationSession } from "@/lib/impersonation/constants"

export function withImpersonationAuditMetadata(
  metadata: Record<string, unknown> | undefined,
  session: ImpersonationSession | null,
): Record<string, unknown> | undefined {
  if (!session) return metadata

  const base = metadata ?? {}
  return {
    ...base,
    actingAsUserId: session.impersonatedUserId,
    actingAsUserName: session.impersonatedName,
    impersonation: true,
  }
}
