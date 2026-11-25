/**
 * Writes for "Salvar e Reenviar" on a refused purchase order.
 *
 * `trg_po_contract_balance_on_status_change` (migration 082) runs
 * `reserve_contract_balance` on refused → sent using the current
 * `purchase_order_items.quantity`. If status is flipped first, the reserve
 * uses the old quantity and later consume-on-accept uses the new quantity,
 * corrupting contract reserved/consumed balances (and stealing sibling
 * reservations via GREATEST(0, reserved - new_qty)).
 */
export async function persistLineEditsThenSendRefusedOrder(ops: {
  persistLineEdits: () => Promise<boolean>
  sendToSupplier: () => Promise<void>
}): Promise<boolean> {
  const persisted = await ops.persistLineEdits()
  if (!persisted) return false
  await ops.sendToSupplier()
  return true
}
