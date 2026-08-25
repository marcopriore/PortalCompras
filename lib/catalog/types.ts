import type { ContractKind } from "@/types/contracts"

export type CatalogOffer = {
  contractItemId: string
  contractId: string
  contractCode: string
  contractTitle: string
  contractKind: ContractKind
  supplierId: string
  supplierName: string
  supplierCode: string
  materialCode: string
  materialDescription: string
  longDescription: string | null
  unitOfMeasure: string | null
  commodityGroup: string | null
  unitPrice: number
  deliveryDays: number | null
  availableQuantity: number | null
  availableValue: number
  contractEndDate: string | null
  paymentConditionCode: string | null
  paymentConditionDescription: string | null
}

export type CatalogCartItem = {
  id: string
  contractId: string
  contractItemId: string
  supplierId: string
  materialCode: string
  materialDescription: string
  unitOfMeasure: string | null
  unitPrice: number
  contractKind: ContractKind
  quantity: number
  lineTotal: number
}

export type CatalogCart = {
  id: string
  items: CatalogCartItem[]
  itemCount: number
  totalAmount: number
}

export type CatalogCheckoutInput = {
  title: string
  costCenter: string
  neededBy?: string | null
  priority?: "normal" | "urgent" | "critical"
  description?: string | null
}
