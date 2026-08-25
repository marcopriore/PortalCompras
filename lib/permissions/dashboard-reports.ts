import type { PermissionKey } from "@/lib/hooks/usePermissions"

/** Permissões de widgets do Dashboard. */
export const DASHBOARD_WIDGET_PERMISSIONS = [
  "dashboard.metrics",
  "dashboard.spend_category",
  "dashboard.quotation_status",
  "dashboard.recent_activity",
  "dashboard.lead_time",
  "dashboard.roi",
] as const satisfies readonly PermissionKey[]

/** Permissões de seções e exports de Relatórios. */
export const REPORTS_PERMISSIONS = [
  "reports.saving",
  "reports.spend",
  "reports.orders",
  "reports.quotations",
  "reports.export.spend_category",
  "reports.export.supplier_performance",
  "reports.export.saving",
  "reports.export.process_time",
] as const satisfies readonly PermissionKey[]

/** Classes de grid adaptativas conforme quantidade de itens visíveis. */
export function adaptiveMetricGridClass(count: number): string {
  if (count <= 1) return "grid gap-4 grid-cols-1"
  if (count === 2) return "grid gap-4 md:grid-cols-2"
  if (count === 3) return "grid gap-4 md:grid-cols-2 lg:grid-cols-3"
  return "grid gap-4 md:grid-cols-2 lg:grid-cols-4"
}

export function adaptivePairGridClass(count: number): string {
  if (count <= 1) return "grid gap-4 grid-cols-1"
  return "grid gap-4 lg:grid-cols-2"
}
