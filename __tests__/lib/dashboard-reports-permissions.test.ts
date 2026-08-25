import { describe, expect, it } from "vitest"
import {
  adaptiveMetricGridClass,
  adaptivePairGridClass,
} from "@/lib/permissions/dashboard-reports"
import { PERMISSION_CATALOG } from "@/lib/permissions/catalog"

describe("dashboard-reports layout helpers", () => {
  it("adapta grid de métricas", () => {
    expect(adaptiveMetricGridClass(1)).toContain("grid-cols-1")
    expect(adaptiveMetricGridClass(2)).toContain("md:grid-cols-2")
    expect(adaptiveMetricGridClass(3)).toContain("lg:grid-cols-3")
    expect(adaptiveMetricGridClass(4)).toContain("lg:grid-cols-4")
  })

  it("adapta grid de pares", () => {
    expect(adaptivePairGridClass(1)).toContain("grid-cols-1")
    expect(adaptivePairGridClass(2)).toContain("lg:grid-cols-2")
  })
})

describe("permission catalog dashboard/reports", () => {
  it("inclui keys de dashboard e relatórios", () => {
    const keys = PERMISSION_CATALOG.map((p) => p.key)
    expect(keys).toContain("dashboard.metrics")
    expect(keys).toContain("dashboard.roi")
    expect(keys).toContain("reports.saving")
    expect(keys).toContain("reports.export.process_time")
  })
})
