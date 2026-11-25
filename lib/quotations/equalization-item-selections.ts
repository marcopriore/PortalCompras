/** Winner pick keyed by quotation item id (proposal id or null). */
export type EqualizationItemSelections = Record<string, string | null>

/**
 * Next equalização winner map after a DTO refresh.
 *
 * Polling / Query `setQueryData` must not wipe in-progress picks. Reset only
 * when the active round changes (proposal ids are per-round) or when the
 * quotation is completed (restore accepted lines from the server).
 */
export function nextEqualizationItemSelections(params: {
  itemIds: string[]
  previous: EqualizationItemSelections
  roundChanged: boolean
  quotationCompleted: boolean
  acceptedByItemId?: Record<string, string>
}): EqualizationItemSelections {
  const {
    itemIds,
    previous,
    roundChanged,
    quotationCompleted,
    acceptedByItemId = {},
  } = params

  const next: EqualizationItemSelections = {}
  for (const id of itemIds) {
    if (quotationCompleted) {
      next[id] = acceptedByItemId[id] ?? null
      continue
    }
    if (roundChanged) {
      next[id] = null
      continue
    }
    next[id] = previous[id] ?? null
  }
  return next
}

/** Keep in-progress target-price edits over values coming from a DTO refresh. */
export function nextEqualizationTargetPrices(params: {
  fromDto: Record<string, number | null>
  pending: Record<string, number | null>
}): Record<string, number | null> {
  const next = { ...params.fromDto }
  for (const [id, value] of Object.entries(params.pending)) {
    if (Object.prototype.hasOwnProperty.call(next, id)) {
      next[id] = value
    }
  }
  return next
}
