"use client"

import * as React from "react"
import { Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type SupplierCategoriesProps = {
  supplierId: string
  companyId: string
  readOnly?: boolean
}

export function SupplierCategories({
  supplierId,
  companyId,
  readOnly = false,
}: SupplierCategoriesProps) {
  const [categories, setCategories] = React.useState<string[]>([])
  const [available, setAvailable] = React.useState<string[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [selectedToAdd, setSelectedToAdd] = React.useState("")

  const loadData = React.useCallback(async () => {
    if (!supplierId || !companyId) return
    setLoading(true)
    try {
      const response = await fetch(
        `/api/supplier-categories?supplier_id=${supplierId}&available=true`,
      )
      const data = (await response.json()) as {
        categories?: string[]
        available?: string[]
      }

      if (!response.ok) {
        setCategories([])
        setAvailable([])
        return
      }

      setCategories(data.categories ?? [])
      setAvailable(data.available ?? [])
    } finally {
      setLoading(false)
    }
  }, [supplierId, companyId])

  React.useEffect(() => {
    void loadData()
  }, [loadData])

  async function handleAdd() {
    if (!selectedToAdd || saving) return
    setSaving(true)
    try {
      const response = await fetch("/api/supplier-categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          supplier_id: supplierId,
          category: selectedToAdd,
        }),
      })

      if (!response.ok) return

      setCategories((prev) =>
        prev.includes(selectedToAdd) ? prev : [...prev, selectedToAdd],
      )
      setSelectedToAdd("")
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(category: string) {
    if (saving) return
    setSaving(true)
    try {
      const response = await fetch("/api/supplier-categories", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          supplier_id: supplierId,
          category,
        }),
      })
      if (!response.ok) return
      setCategories((prev) => prev.filter((cat) => cat !== category))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando categorias...</p>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Categorias Atendidas</p>
        <span className="text-xs text-muted-foreground">{categories.length} categoria(s)</span>
      </div>

      {categories.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhuma categoria vinculada.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <span
              key={cat}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-medium"
            >
              {cat}
              {!readOnly && (
                <button
                  onClick={() => void handleRemove(cat)}
                  className="hover:text-destructive ml-1"
                  disabled={saving}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {!readOnly && (
        <div className="flex gap-2">
          <Select value={selectedToAdd} onValueChange={setSelectedToAdd}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Selecionar categoria..." />
            </SelectTrigger>
            <SelectContent>
              {available
                .filter((cat) => !categories.includes(cat))
                .map((cat) => (
                  <SelectItem key={cat} value={cat} className="text-xs">
                    {cat}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs"
            onClick={() => void handleAdd()}
            disabled={!selectedToAdd || saving}
          >
            <Plus className="h-3 w-3 mr-1" />
            Adicionar
          </Button>
        </div>
      )}
    </div>
  )
}
