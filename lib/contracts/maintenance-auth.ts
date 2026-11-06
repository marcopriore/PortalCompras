/**
 * Auth for server-to-server contract/cron jobs.
 * Same rules as `/api/cron/background-jobs`.
 */
export function isContractMaintenanceAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  const maintenanceSecret = process.env.CONTRACT_MAINTENANCE_SECRET

  const auth = request.headers.get("authorization")
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true
  if (
    maintenanceSecret &&
    request.headers.get("x-maintenance-key") === maintenanceSecret
  ) {
    return true
  }

  if (
    request.headers.get("x-vercel-cron") === "1" &&
    process.env.VERCEL === "1"
  ) {
    return true
  }

  if (!cronSecret && !maintenanceSecret) return true

  return false
}
