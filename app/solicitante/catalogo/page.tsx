"use client"

import { PurchaseCatalogPage } from "@/components/catalog/purchase-catalog-page"

export default function SolicitanteCatalogoPage() {
  return (
    <PurchaseCatalogPage
      portal="solicitante"
      requisitionDetailBasePath="/solicitante"
    />
  )
}
