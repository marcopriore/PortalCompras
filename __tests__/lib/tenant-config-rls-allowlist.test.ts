import { describe, expect, it } from "vitest"
import { CONTRACT_PO_LINK_PROMPT_KEY } from "@/lib/contracts/contract-balance-settings"

/**
 * Allowlists da migration 085 — escrita autenticada (anon/JWT).
 * Demais chaves só via service role (/api/admin/tenant-settings, create-tenant).
 */
export const CLIENT_WRITABLE_COMPANY_SETTING_KEYS = [
  "lead_time_target_days",
  CONTRACT_PO_LINK_PROMPT_KEY,
] as const

export const TENANT_ADMIN_WRITABLE_FEATURE_KEYS = [
  "approval_requisition",
  "approval_order",
  "approval_catalog_order",
] as const

const SUPERADMIN_ONLY_COMPANY_SETTING_KEYS = [
  "catalog_post_checkout_mode",
  "erp_integration_enabled",
  "erp_vendor",
  "por_enabled",
  "account_assignment_enabled",
  "api_capabilities",
  "password_min_length",
  "password_require_uppercase",
  "numeric_price_decimal_places",
] as const

const SUPERADMIN_ONLY_FEATURE_KEYS = [
  "ai_negotiation_autonomous",
  "ai_analytics",
  "purchase_catalog",
  "api_integrations",
  "quotations",
  "orders",
] as const

describe("tenant config RLS allowlists (migration 085)", () => {
  it("client may only upsert operational company_settings keys", () => {
    expect(CLIENT_WRITABLE_COMPANY_SETTING_KEYS).toEqual([
      "lead_time_target_days",
      "contract_po_link_prompt_enabled",
    ])
    for (const key of SUPERADMIN_ONLY_COMPANY_SETTING_KEYS) {
      expect(CLIENT_WRITABLE_COMPANY_SETTING_KEYS).not.toContain(key)
    }
  })

  it("tenant admin may only toggle approval feature keys from the client", () => {
    expect(TENANT_ADMIN_WRITABLE_FEATURE_KEYS).toEqual([
      "approval_requisition",
      "approval_order",
      "approval_catalog_order",
    ])
    for (const key of SUPERADMIN_ONLY_FEATURE_KEYS) {
      expect(TENANT_ADMIN_WRITABLE_FEATURE_KEYS).not.toContain(key)
    }
  })
})
