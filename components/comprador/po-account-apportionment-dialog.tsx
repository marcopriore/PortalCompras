"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { PercentInput } from "@/components/ui/numeric-field-inputs"
import { useNumericLimits } from "@/lib/hooks/use-numeric-limits"
import { PoAccountPrimaryField } from "@/components/comprador/po-account-primary-field"
import {
  createEmptyAssignmentRow,
  getCategoryPrimaryLabel,
  readPrimaryValue,
  sumApportionmentPercent,
  writePrimaryValue,
  type ItemAccountConfigEdit,
  type ItemAccountConfigFieldErrors,
} from "@/lib/po-account-assignment"
import type {
  PurchaseOrderItemAccountAssignmentInput,
  SapAccountAssignmentCategory,
} from "@/types/po-account-assignment"

type PoAccountApportionmentDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string | null | undefined
  itemLabel: string
  category: SapAccountAssignmentCategory
  initialConfig: ItemAccountConfigEdit
  fieldErrors?: ItemAccountConfigFieldErrors
  onSave: (config: ItemAccountConfigEdit) => void
  /** Somente visualização (aprovação / detalhe). */
  readOnly?: boolean
}

export function PoAccountApportionmentDialog({
  open,
  onOpenChange,
  companyId,
  itemLabel,
  category,
  initialConfig,
  fieldErrors,
  onSave,
  readOnly = false,
}: PoAccountApportionmentDialogProps) {
  const { percentDecimalPlaces } = useNumericLimits()
  const [rows, setRows] = React.useState<PurchaseOrderItemAccountAssignmentInput[]>([])

  React.useEffect(() => {
    if (!open) return
    const source = initialConfig.assignments.length
      ? initialConfig.assignments
      : [createEmptyAssignmentRow(1, 100)]
    setRows(source.map((row, index) => ({ ...row, sequence: index + 1 })))
  }, [open, initialConfig])

  const totalPercent = sumApportionmentPercent(rows)
  const primaryLabel = getCategoryPrimaryLabel(category)

  const updateRow = (
    index: number,
    patch: Partial<PurchaseOrderItemAccountAssignmentInput>,
  ) => {
    setRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch, sequence: rowIndex + 1 } : row,
      ),
    )
  }

  const updatePrimary = (index: number, value: string) => {
    setRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index ? writePrimaryValue(category, row, value) : row,
      ),
    )
  }

  const handleAddRow = () => {
    const remaining = Math.max(0, 100 - totalPercent)
    if (remaining <= 0) return
    setRows((prev) => [
      ...prev,
      createEmptyAssignmentRow(prev.length + 1, remaining),
    ])
  }

  const handleRemoveRow = (index: number) => {
    setRows((prev) =>
      prev
        .filter((_, rowIndex) => rowIndex !== index)
        .map((row, rowIndex) => ({ ...row, sequence: rowIndex + 1 })),
    )
  }

  const handlePercentChange = (index: number, value: number) => {
    const otherTotal = rows.reduce(
      (sum, row, rowIndex) =>
        rowIndex === index ? sum : sum + Number(row.apportionment_percent ?? 0),
      0,
    )
    if (otherTotal + value > 100) return
    updateRow(index, { apportionment_percent: value })
  }

  const handleSave = () => {
    const normalized = rows.map((row, index) => ({
      ...row,
      sequence: index + 1,
      currency: row.currency?.trim() || "BRL",
    }))

    onSave({
      category,
      assignments: normalized,
      usesApportionment: normalized.length > 1,
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[min(64rem,calc(100vw-18rem))] !max-w-[min(64rem,calc(100vw-18rem))] sm:!max-w-[min(64rem,calc(100vw-18rem))]">
        <DialogHeader>
          <DialogTitle>
            {readOnly ? "Visualizar rateio contábil" : "Rateio contábil"}
          </DialogTitle>
          <DialogDescription>
            {itemLabel} · categoria {category} ({primaryLabel})
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10 whitespace-nowrap px-2">Linha</TableHead>
                <TableHead className="w-[4.5rem] whitespace-nowrap px-2">% *</TableHead>
                <TableHead className="w-[8.5rem] whitespace-nowrap px-2">{primaryLabel} *</TableHead>
                <TableHead className="w-[6.5rem] whitespace-nowrap px-2">Conta cont.</TableHead>
                <TableHead className="w-[5.5rem] whitespace-nowrap px-2">Área neg.</TableHead>
                <TableHead className="w-[5.5rem] whitespace-nowrap px-2">Área ctrl.</TableHead>
                <TableHead className="w-14 whitespace-nowrap px-2">Moeda</TableHead>
                <TableHead className="w-10 whitespace-nowrap px-2 text-right"> </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => {
                const rowErrors = fieldErrors?.rateioRows?.[index]
                return (
                  <TableRow key={`${row.sequence}-${index}`}>
                    <TableCell className="px-2 font-medium text-sm">{index + 1}</TableCell>
                    <TableCell className="px-2">
                      {readOnly ? (
                        <span className="text-xs">{row.apportionment_percent ?? 0}%</span>
                      ) : (
                        <PercentInput
                          value={Number(row.apportionment_percent ?? 0)}
                          decimalPlaces={percentDecimalPlaces}
                          onValueChange={(value) => handlePercentChange(index, value)}
                          invalid={Boolean(rowErrors?.percent)}
                          className="h-8 w-full min-w-0 px-2 text-xs"
                        />
                      )}
                    </TableCell>
                    <TableCell className="px-2">
                      {readOnly ? (
                        <span className="text-xs">{readPrimaryValue(category, row) || "—"}</span>
                      ) : (
                        <PoAccountPrimaryField
                          companyId={companyId}
                          category={category}
                          value={readPrimaryValue(category, row)}
                          onChange={(value) => updatePrimary(index, value)}
                          invalid={Boolean(rowErrors?.primary)}
                        />
                      )}
                    </TableCell>
                    <TableCell className="px-2">
                      {readOnly ? (
                        <span className="text-xs">{row.ledger_account_code ?? "—"}</span>
                      ) : (
                        <Input
                          value={row.ledger_account_code ?? ""}
                          onChange={(e) =>
                            updateRow(index, { ledger_account_code: e.target.value || null })
                          }
                          className="h-8 w-full min-w-0 px-2 text-xs"
                        />
                      )}
                    </TableCell>
                    <TableCell className="px-2">
                      {readOnly ? (
                        <span className="text-xs">{row.business_area ?? "—"}</span>
                      ) : (
                        <Input
                          value={row.business_area ?? ""}
                          onChange={(e) =>
                            updateRow(index, { business_area: e.target.value || null })
                          }
                          className="h-8 w-full min-w-0 px-2 text-xs"
                        />
                      )}
                    </TableCell>
                    <TableCell className="px-2">
                      {readOnly ? (
                        <span className="text-xs">{row.controlling_area ?? "—"}</span>
                      ) : (
                        <Input
                          value={row.controlling_area ?? ""}
                          onChange={(e) =>
                            updateRow(index, { controlling_area: e.target.value || null })
                          }
                          className="h-8 w-full min-w-0 px-2 text-xs"
                        />
                      )}
                    </TableCell>
                    <TableCell className="px-2">
                      {readOnly ? (
                        <span className="text-xs">{row.currency ?? "BRL"}</span>
                      ) : (
                        <Input
                          value={row.currency ?? "BRL"}
                          onChange={(e) =>
                            updateRow(index, { currency: e.target.value || "BRL" })
                          }
                          className="h-8 w-full min-w-0 px-2 text-xs"
                        />
                      )}
                    </TableCell>
                    <TableCell className="px-2 text-right">
                      {!readOnly && rows.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveRow(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            Total do rateio:{" "}
            <span
              className={cn(
                "font-medium",
                (totalPercent > 100 || fieldErrors?.rateioTotal) && "text-destructive",
                totalPercent === 100 && "text-foreground",
              )}
            >
              {totalPercent}%
            </span>
          </p>
          {!readOnly ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRow}
              disabled={totalPercent >= 100}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar linha
            </Button>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {readOnly ? "Fechar" : "Cancelar"}
          </Button>
          {!readOnly ? (
            <Button type="button" onClick={handleSave}>
              Salvar rateio
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
