import { describe, expect, it } from "vitest"
import { abandonFailedRequisitionCreate } from "@/lib/requisitions/rollback-create"
import { validateRequisitionLineSiteCodes } from "@/lib/requisitions/line-items-helpers"

describe("validateRequisitionLineSiteCodes", () => {
  it("rejects blank site_code (empty string fails FK after header insert)", () => {
    const result = validateRequisitionLineSiteCodes([
      {
        id: "i1",
        itemId: "cat1",
        materialCode: "M1",
        materialDescription: "Item",
        unitOfMeasure: "UN",
        commodityGroup: "",
        quantity: 1,
        observations: "",
        siteCode: "",
      },
    ])
    expect(result.ok).toBe(false)
    expect(result.errors.i1).toBe(true)
  })

  it("allows draft with no items", () => {
    expect(validateRequisitionLineSiteCodes([]).ok).toBe(true)
  })
})

describe("abandonFailedRequisitionCreate", () => {
  it("deletes items then the header when DELETE is allowed", async () => {
    const calls: string[] = []
    const supabase = {
      from(table: string) {
        calls.push(`from:${table}`)
        return {
          delete() {
            calls.push(`delete:${table}`)
            return {
              eq(column: string, value: string) {
                calls.push(`eq:${table}:${column}:${value}`)
                return { error: null }
              },
            }
          },
          update() {
            throw new Error("should not cancel when delete succeeds")
          },
        }
      },
    }

    await abandonFailedRequisitionCreate(
      supabase as never,
      "req-1",
    )

    expect(calls).toEqual([
      "from:requisition_items",
      "delete:requisition_items",
      "eq:requisition_items:requisition_id:req-1",
      "from:requisitions",
      "delete:requisitions",
      "eq:requisitions:id:req-1",
    ])
  })

  it("cancels the header when DELETE is blocked by RLS", async () => {
    const updates: Array<{ status: string }> = []
    const supabase = {
      from(table: string) {
        return {
          delete() {
            return {
              eq() {
                return {
                  error:
                    table === "requisitions"
                      ? { message: "new row violates RLS" }
                      : null,
                }
              },
            }
          },
          update(payload: { status: string }) {
            updates.push(payload)
            return {
              eq() {
                return { error: null }
              },
            }
          },
        }
      },
    }

    await abandonFailedRequisitionCreate(supabase as never, "req-2")
    expect(updates).toEqual([{ status: "cancelled" }])
  })
})
