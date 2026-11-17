export type CronAuthEnv = {
  cronSecret?: string
  maintenanceSecret?: string
  vercel?: string
  nodeEnv?: string
}

export function readCronAuthEnv(): CronAuthEnv {
  return {
    cronSecret: process.env.CRON_SECRET,
    maintenanceSecret: process.env.CONTRACT_MAINTENANCE_SECRET,
    vercel: process.env.VERCEL,
    nodeEnv: process.env.NODE_ENV,
  }
}

/**
 * Autoriza jobs de cron / manutenção.
 * Em Vercel e production exige CRON_SECRET ou CONTRACT_MAINTENANCE_SECRET.
 * O header `x-vercel-cron` não é autenticador — é spoofable em qualquer request HTTP.
 * Sem secrets, só libera em dev local (não Vercel / não production).
 */
export function isCronAuthorized(
  request: Request,
  env: CronAuthEnv = readCronAuthEnv(),
): boolean {
  const cronSecret = env.cronSecret?.trim() || ""
  const maintenanceSecret = env.maintenanceSecret?.trim() || ""

  const auth = request.headers.get("authorization")
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true
  if (
    maintenanceSecret &&
    request.headers.get("x-maintenance-key") === maintenanceSecret
  ) {
    return true
  }

  const isHosted = env.vercel === "1" || env.nodeEnv === "production"
  if (!cronSecret && !maintenanceSecret && !isHosted) {
    return true
  }

  return false
}
