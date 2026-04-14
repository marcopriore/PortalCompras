"use client"

import * as React from "react"
import { Plus, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type Suggestion = {
  id: string
  name: string
  code: string
  origin: "cadastro" | "historico"
}

type SuggestSuppliersButtonProps = {
  quotationId?: string
  category?: string
  excludeSupplierIds?: string[]
  onAddSupplier: (supplier: { id: string; name: string; code: string }) => void
}

export function SuggestSuppliersButton({
  quotationId,
  category: categoryProp,
  excludeSupplierIds,
  onAddSupplier,
}: SuggestSuppliersButtonProps) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([])
  const [resolvedCategory, setResolvedCategory] = React.useState("")
  const [idleHint, setIdleHint] = React.useState(false)

  async function loadSuggestions() {
    setLoading(true)
    setIdleHint(false)
    try {
      if (quotationId) {
        const response = await fetch(
          `/api/suggest-suppliers?quotation_id=${encodeURIComponent(quotationId)}`,
        )
        const data = (await response.json()) as {
          category?: string
          suggestions?: Suggestion[]
        }
        if (!response.ok) {
          setResolvedCategory("")
          setSuggestions([])
          return
        }
        setResolvedCategory(data.category ?? "")
        setSuggestions(data.suggestions ?? [])
        return
      }

      if (categoryProp) {
        const params = new URLSearchParams()
        params.set("category", categoryProp)
        const exclude = excludeSupplierIds?.filter(Boolean).join(",") ?? ""
        if (exclude) params.set("exclude_ids", exclude)
        const response = await fetch(`/api/suggest-suppliers?${params.toString()}`)
        const data = (await response.json()) as {
          category?: string
          suggestions?: Suggestion[]
        }
        if (!response.ok) {
          setResolvedCategory("")
          setSuggestions([])
          return
        }
        setResolvedCategory(data.category ?? "")
        setSuggestions(data.suggestions ?? [])
        return
      }

      setIdleHint(true)
      setResolvedCategory("")
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }

  async function handleOpen() {
    setOpen(true)
    await loadSuggestions()
  }

  function handleAdd(suggestion: Suggestion) {
    onAddSupplier({
      id: suggestion.id,
      name: suggestion.name,
      code: suggestion.code,
    })
    setSuggestions((prev) => prev.filter((s) => s.id !== suggestion.id))
  }

  const canRequest = Boolean(quotationId || categoryProp)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={!canRequest}
          onClick={() => void handleOpen()}
        >
          <Sparkles className="h-4 w-4 mr-2 text-violet-500" />
          Sugerir Fornecedores
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-3" align="start">
        <div className="space-y-3">
          <p className="text-sm font-medium">
            Sugestões para {resolvedCategory || categoryProp || "categoria"}
          </p>

          {loading ? (
            <div className="space-y-2 animate-pulse">
              {[...Array(3)].map((_, idx) => (
                <div key={idx} className="h-8 bg-muted rounded-md" />
              ))}
            </div>
          ) : idleHint ? (
            <p className="text-sm text-muted-foreground">
              Selecione uma categoria primeiro
            </p>
          ) : suggestions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum fornecedor encontrado para esta categoria.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {suggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border p-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{suggestion.name}</p>
                    <p className="text-xs text-muted-foreground">{suggestion.code}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        suggestion.origin === "cadastro"
                          ? "bg-green-100 text-green-700 hover:bg-green-100"
                          : "bg-blue-100 text-blue-700 hover:bg-blue-100"
                      }
                    >
                      {suggestion.origin === "cadastro" ? "Cadastro" : "Histórico"}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => handleAdd(suggestion)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
