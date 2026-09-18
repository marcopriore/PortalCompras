/**
 * Best-effort rollback of draft POs from a partial split-by-site_code run.
 * Releases contract reservation (no-op when the PO has no contract lines) then
 * deletes the order. The contract-balance trigger only runs on status UPDATE,
 * so DELETE alone would leave a ghost reservation.
 */
export type DraftPurchaseOrderRollbackClient = {
  rpc: (
    fn: "release_contract_balance",
    args: { p_order_id: string },
  ) => PromiseLike<unknown>
  from: (table: "purchase_orders") => {
    delete: () => {
      eq: (column: "id", value: string) => PromiseLike<unknown>
    }
  }
}

export async function rollbackDraftPurchaseOrders(
  db: DraftPurchaseOrderRollbackClient,
  orderIds: string[],
): Promise<void> {
  for (const orderId of orderIds) {
    try {
      await db.rpc("release_contract_balance", { p_order_id: orderId })
    } catch {
      /* best-effort: still delete the orphan PO */
    }
    await db.from("purchase_orders").delete().eq("id", orderId)
  }
}
