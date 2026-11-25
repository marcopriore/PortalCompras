/**
 * Who may replace the PDF of a contract via POST /api/contracts/[id]/upload.
 * Requesters can SELECT contracts (RLS 083 / catálogo) but must not write files.
 * Permission `contract.edit` is checked separately (and respects view_only).
 */
export function isContractUploadActor(profile: {
  profile_type?: string | null
  is_superadmin?: boolean | null
}): boolean {
  if (Boolean(profile.is_superadmin)) return true
  return profile.profile_type === "buyer"
}
