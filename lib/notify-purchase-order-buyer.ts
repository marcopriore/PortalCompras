export type PurchaseOrderBuyerNotifyEvent =
  | "accepted"
  | "refused"
  | "delivery_updated"

export async function notifyPurchaseOrderBuyer(params: {
  orderId: string
  event: PurchaseOrderBuyerNotifyEvent
  estimatedDelivery?: string
  refuseReason?: string
  newDeliveryDate?: string
  deliveryReason?: string
}): Promise<void> {
  try {
    const res = await fetch("/api/notify-purchase-order-buyer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    })
    if (!res.ok) {
      console.error("notifyPurchaseOrderBuyer:", res.status, await res.text())
    }
  } catch (e) {
    console.error("notifyPurchaseOrderBuyer:", e)
  }
}
