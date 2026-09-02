"use client"

import * as React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { TablePagination } from "@/components/ui/table-pagination"
import { PoItemAccountConfigTableCells } from "@/components/comprador/po-item-account-config-cells"
import {
  RequisitionLineItemsImportExcelDialog,
  type RequisitionLineImportPayload,
} from "@/components/comprador/requisition-line-items-import-excel-dialog"
import {
  emptyRequisitionAccountConfig,
  REQ_ITEMS_PAGE_SIZE,
  type RequisitionEditorLineItem,
} from "@/lib/requisitions/line-items-helpers"
import type {
  ItemAccountConfigEdit,
  ItemAccountConfigFieldErrors,
} from "@/lib/po-account-assignment"
import { QuantityInput } from "@/components/ui/numeric-field-inputs"
import { BranchSelect } from "@/components/ui/branch-select"
import { useNumericLimits } from "@/lib/hooks/use-numeric-limits"
import { useImplantationConfig } from "@/lib/hooks/use-implantation-config"
import { Trash2, Plus, PackageSearch, X, FileSpreadsheet } from "lucide-react"

type CatalogItem = {
  id: string
  code: string
  short_description: string
  long_description: string | null
  unit_of_measure: string | null
  commodity_group: string | null
}

const DEBOUNCE_MS = 400

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value)
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debouncedValue
}

type RequisitionLineItemsSectionProps = {
  companyId: string | null
  items: RequisitionEditorLineItem[]
  onItemsChange: React.Dispatch<React.SetStateAction<RequisitionEditorLineItem[]>>
  accountConfigs: Record<string, ItemAccountConfigEdit>
  onAccountConfigsChange: React.Dispatch<
    React.SetStateAction<Record<string, ItemAccountConfigEdit>>
  >
  accountConfigErrors?: Record<string, ItemAccountConfigFieldErrors>
  siteCodeFieldErrors?: Record<string, boolean>
  onAccountConfigChange?: (itemId: string, config: ItemAccountConfigEdit) => void
  title?: string
}

export function RequisitionLineItemsSection({
  companyId,
  items,
  onItemsChange,
  accountConfigs,
  onAccountConfigsChange,
  accountConfigErrors = {},
  siteCodeFieldErrors = {},
  onAccountConfigChange,
  title = "Itens Solicitados",
}: RequisitionLineItemsSectionProps) {
  const { maxQuantity } = useNumericLimits()
  const { accountAssignmentEnabled } = useImplantationConfig()
  const [itemPage, setItemPage] = React.useState(1)
  const [searchTerm, setSearchTerm] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<CatalogItem[]>([])
  const [searchLoading, setSearchLoading] = React.useState(false)
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [importExcelOpen, setImportExcelOpen] = React.useState(false)
  const [defaultSiteCode, setDefaultSiteCode] = React.useState("")

  React.useEffect(() => {
    if (!companyId) {
      setDefaultSiteCode("")
      return
    }
    let alive = true
    void (async () => {
      const supabase = createClient()
      const { data } = await supabase
        .from("company_branches")
        .select("code")
        .eq("company_id", companyId)
        .eq("code", "MATRIZ")
        .eq("active", true)
        .maybeSingle()
      if (!alive) return
      setDefaultSiteCode((data as { code?: string } | null)?.code ?? "")
    })()
    return () => {
      alive = false
    }
  }, [companyId])
  const searchContainerRef = React.useRef<HTMLDivElement>(null)
  const debouncedSearch = useDebounce(searchTerm, DEBOUNCE_MS)

  const totalItemPages = Math.max(1, Math.ceil(items.length / REQ_ITEMS_PAGE_SIZE))
  const itemPageClamped = Math.min(Math.max(itemPage, 1), totalItemPages)
  const paginatedItems = React.useMemo(
    () =>
      items.slice(
        (itemPageClamped - 1) * REQ_ITEMS_PAGE_SIZE,
        itemPageClamped * REQ_ITEMS_PAGE_SIZE,
      ),
    [items, itemPageClamped],
  )

  React.useEffect(() => {
    if (itemPage > totalItemPages) {
      setItemPage(totalItemPages)
    }
  }, [itemPage, totalItemPages])

  React.useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!searchContainerRef.current?.contains(event.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [])

  React.useEffect(() => {
    if (!companyId || debouncedSearch.length < 2) {
      setSearchResults([])
      return
    }
    const run = async () => {
      setSearchLoading(true)
      const supabase = createClient()
      const term = `%${debouncedSearch.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`
      const { data, error } = await supabase
        .from("items")
        .select("id, code, short_description, long_description, unit_of_measure, commodity_group")
        .eq("company_id", companyId)
        .or(`code.ilike.${term},short_description.ilike.${term}`)
        .limit(20)

      setSearchLoading(false)
      if (error) {
        setSearchResults([])
        return
      }
      setSearchResults((data as CatalogItem[]) ?? [])
    }
    void run()
  }, [companyId, debouncedSearch])

  const addItem = (item: CatalogItem) => {
    if (items.some((i) => i.itemId === item.id)) return
    const lineId = crypto.randomUUID()
    onItemsChange((prev) => [
      ...prev,
      {
        id: lineId,
        itemId: item.id,
        materialCode: item.code,
        materialDescription: item.short_description,
        unitOfMeasure: item.unit_of_measure ?? "",
        commodityGroup: item.commodity_group ?? "",
        quantity: 1,
        observations: "",
        siteCode: defaultSiteCode,
      },
    ])
    onAccountConfigsChange((prev) => ({ ...prev, [lineId]: emptyRequisitionAccountConfig() }))
    setSearchOpen(false)
  }

  const importLines = (lines: RequisitionLineImportPayload[]) => {
    if (lines.length === 0) return
    onItemsChange((prev) => [
      ...prev,
      ...lines.map((line) => ({
        id: line.lineId,
        itemId: line.itemId,
        materialCode: line.materialCode,
        materialDescription: line.materialDescription,
        unitOfMeasure: line.unitOfMeasure,
        commodityGroup: line.commodityGroup,
        quantity: line.quantity,
        observations: line.observations,
        siteCode: line.siteCode || defaultSiteCode,
      })),
    ])
    onAccountConfigsChange((prev) => ({
      ...prev,
      ...Object.fromEntries(lines.map((line) => [line.lineId, emptyRequisitionAccountConfig()])),
    }))
  }

  const updateItem = (itemId: string, patch: Partial<RequisitionEditorLineItem>) => {
    onItemsChange((prev) => prev.map((i) => (i.id === itemId ? { ...i, ...patch } : i)))
  }

  const removeItem = (itemId: string) => {
    onItemsChange((prev) => prev.filter((i) => i.id !== itemId))
    onAccountConfigsChange((prev) => {
      const next = { ...prev }
      delete next[itemId]
      return next
    })
  }

  const handleAccountConfigChange = (itemId: string, config: ItemAccountConfigEdit) => {
    onAccountConfigsChange((prev) => ({ ...prev, [itemId]: config }))
    onAccountConfigChange?.(itemId, config)
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>{title}</CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setImportExcelOpen(true)}
            disabled={!companyId}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Importar Excel
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative" ref={searchContainerRef}>
            <Input
              placeholder="Buscar por código ou descrição..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setSearchOpen(true)
              }}
              onFocus={() => setSearchOpen(true)}
              className={searchTerm ? "pr-20" : "pr-10"}
            />
            {searchTerm ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => {
                  setSearchTerm("")
                  setSearchResults([])
                  setSearchOpen(false)
                }}
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
            {searchOpen && searchTerm.length >= 2 ? (
              <div
                className="absolute top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-card shadow-lg z-10"
                role="listbox"
              >
                {searchLoading ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">Buscando...</div>
                ) : searchResults.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Nenhum item encontrado
                  </div>
                ) : (
                  <ul className="py-2">
                    {searchResults.map((item) => {
                      const isAdded = items.some((i) => i.itemId === item.id)
                      return (
                        <li
                          key={item.id}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-muted/50"
                        >
                          {isAdded ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled
                                  className="shrink-0"
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Já adicionado</TooltipContent>
                            </Tooltip>
                          ) : (
                            <Button
                              type="button"
                              variant="default"
                              size="icon"
                              onClick={() => addItem(item)}
                              className="shrink-0"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="font-mono text-xs text-muted-foreground">
                              {item.code}
                            </span>
                            <span className="ml-2 text-sm text-foreground">
                              {item.short_description}
                            </span>
                            {item.unit_of_measure ? (
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({item.unit_of_measure})
                              </span>
                            ) : null}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            ) : null}
          </div>

          <p className="text-sm text-muted-foreground">{items.length} item(ns) adicionado(s)</p>

          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
              <PackageSearch className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                Nenhum item adicionado. Use a busca acima para adicionar materiais.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10" />
                      <TableHead>Código</TableHead>
                      <TableHead className="min-w-[10rem]">Descrição Curta</TableHead>
                      <TableHead className="text-center">Unidade</TableHead>
                      <TableHead>Grupo de Mercadoria</TableHead>
                      <TableHead className="min-w-[11rem] whitespace-nowrap">
                        Centro / Filial *
                      </TableHead>
                      {accountAssignmentEnabled ? (
                        <>
                          <TableHead className="text-center whitespace-nowrap min-w-[9rem]">
                            Classificação *
                          </TableHead>
                          <TableHead className="text-center whitespace-nowrap min-w-[8.5rem]">
                            Coletor *
                          </TableHead>
                          <TableHead className="text-center whitespace-nowrap min-w-[6.5rem]">
                            Rateio
                          </TableHead>
                        </>
                      ) : null}
                      <TableHead className="w-28">Quantidade *</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.map((it) => (
                      <TableRow key={it.id}>
                        <TableCell className="w-10">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(it.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{it.materialCode}</TableCell>
                        <TableCell className="text-sm">{it.materialDescription}</TableCell>
                        <TableCell className="text-center text-sm">
                          {it.unitOfMeasure || "—"}
                        </TableCell>
                        <TableCell className="text-sm">{it.commodityGroup || "—"}</TableCell>
                        <TableCell className="align-top min-w-[11rem]">
                          <BranchSelect
                            companyId={companyId}
                            value={it.siteCode}
                            onChange={(siteCode) => updateItem(it.id, { siteCode })}
                            hideLabel
                            required
                            invalid={Boolean(siteCodeFieldErrors[it.id])}
                            includeInactiveCodes={it.siteCode ? [it.siteCode] : []}
                            triggerClassName="h-8"
                          />
                        </TableCell>
                        {accountAssignmentEnabled ? (
                          <PoItemAccountConfigTableCells
                            companyId={companyId}
                            materialCode={it.materialCode}
                            config={accountConfigs[it.id] ?? emptyRequisitionAccountConfig()}
                            editable
                            fieldErrors={accountConfigErrors[it.id]}
                            onChange={(config) => handleAccountConfigChange(it.id, config)}
                          />
                        ) : null}
                        <TableCell className="align-top">
                          <QuantityInput
                            value={it.quantity}
                            maxQuantity={maxQuantity}
                            onValueChange={(quantity) =>
                              updateItem(it.id, {
                                quantity,
                              })
                            }
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell className="align-top relative pb-5">
                          <Input
                            value={it.observations}
                            maxLength={300}
                            onChange={(e) =>
                              updateItem(it.id, {
                                observations: e.target.value.slice(0, 300),
                              })
                            }
                            placeholder="Opcional"
                            className="h-8"
                          />
                          <p className="absolute bottom-0 right-2 text-[10px] text-muted-foreground">
                            {(it.observations ?? "").length}/300
                          </p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <TablePagination
                page={itemPageClamped}
                total={items.length}
                onPageChange={setItemPage}
                pageSize={REQ_ITEMS_PAGE_SIZE}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <RequisitionLineItemsImportExcelDialog
        open={importExcelOpen}
        onClose={() => setImportExcelOpen(false)}
        companyId={companyId ?? ""}
        existingItemIds={items.map((item) => item.itemId)}
        onImport={importLines}
      />
    </>
  )
}
