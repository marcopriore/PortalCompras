"use client"

import { PurchaseCatalogPage } from "@/components/catalog/purchase-catalog-page"

export default function CompradorCatalogoPage() {
  return (
    <PurchaseCatalogPage
      portal="comprador"
      requisitionDetailBasePath="/comprador/requisicoes"
    />
  )
}
