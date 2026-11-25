import { describe, expect, it } from "vitest"
import {
  nextEqualizationItemSelections,
  nextEqualizationTargetPrices,
} from "@/lib/quotations/equalization-item-selections"

describe("nextEqualizationItemSelections", () => {
  const itemIds = ["qi-1", "qi-2", "qi-3"]
  const previous = { "qi-1": "prop-a", "qi-2": "prop-b" }

  it("preserves picks when the DTO refreshes on the same round (polling)", () => {
    expect(
      nextEqualizationItemSelections({
        itemIds,
        previous,
        roundChanged: false,
        quotationCompleted: false,
      }),
    ).toEqual({
      "qi-1": "prop-a",
      "qi-2": "prop-b",
      "qi-3": null,
    })
  })

  it("drops stale picks for items that left the quotation", () => {
    expect(
      nextEqualizationItemSelections({
        itemIds: ["qi-1"],
        previous,
        roundChanged: false,
        quotationCompleted: false,
      }),
    ).toEqual({ "qi-1": "prop-a" })
  })

  it("clears picks when the active round changes", () => {
    expect(
      nextEqualizationItemSelections({
        itemIds,
        previous,
        roundChanged: true,
        quotationCompleted: false,
      }),
    ).toEqual({
      "qi-1": null,
      "qi-2": null,
      "qi-3": null,
    })
  })

  it("restores accepted winners on a completed quotation", () => {
    expect(
      nextEqualizationItemSelections({
        itemIds,
        previous,
        roundChanged: false,
        quotationCompleted: true,
        acceptedByItemId: { "qi-1": "prop-winner", "qi-3": "prop-c" },
      }),
    ).toEqual({
      "qi-1": "prop-winner",
      "qi-2": null,
      "qi-3": "prop-c",
    })
  })
})

describe("nextEqualizationTargetPrices", () => {
  it("keeps in-progress edits over DTO values", () => {
    expect(
      nextEqualizationTargetPrices({
        fromDto: { "qi-1": 10, "qi-2": 20 },
        pending: { "qi-1": 15 },
      }),
    ).toEqual({ "qi-1": 15, "qi-2": 20 })
  })

  it("ignores pending keys that are not in the DTO", () => {
    expect(
      nextEqualizationTargetPrices({
        fromDto: { "qi-1": 10 },
        pending: { "qi-gone": 99 },
      }),
    ).toEqual({ "qi-1": 10 })
  })
})
