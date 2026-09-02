/** Rótulo curto para exibição de centro / filial (código — nome). */
export function formatBranchLabel(
  branch?: { code?: string | null; name?: string | null } | null,
): string {
  if (!branch) return "—"
  const code = branch.code?.trim()
  const name = branch.name?.trim()
  if (code && name) return `${code} — ${name}`
  return code || name || "—"
}
