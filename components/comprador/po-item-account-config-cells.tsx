"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { TableCell } from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Split } from "lucide-react"
import { cn } from "@/lib/utils"
import { PoAccountPrimaryField } from "@/components/comprador/po-account-primary-field"
import {
  SAP_ACCOUNT_ASSIGNMENT_CATEGORIES,
  SAP_ACCOUNT_ASSIGNMENT_CATEGORY_LABELS,
} from "@/types/po-account-assignment"
import {
  createEmptyAssignmentRow,
  readPrimaryValue,
  writePrimaryValue,
  type ItemAccountConfigEdit,
  type ItemAccountConfigFieldErrors,
} from "@/lib/po-account-assignment"
import { PoAccountApportionmentDialog } from "@/components/comprador/po-account-apportionment-dialog"
import type { SapAccountAssignmentCategory } from "@/types/po-account-assignment"

type PoItemAccountConfigCellsProps = {
  companyId: string | null | undefined
  materialCode: string
  config: ItemAccountConfigEdit
  editable: boolean
  fieldErrors?: ItemAccountConfigFieldErrors
  onChange: (config: ItemAccountConfigEdit) => void
}

export function PoItemAccountConfigTableCells({
  companyId,
  materialCode,
  config,
  editable,
  fieldErrors,
  onChange,
}: PoItemAccountConfigCellsProps) {
  const [rateioOpen, setRateioOpen] = React.useState(false)

  const category = config.category
  const assignments = config.assignments.length
    ? config.assignments
    : category
      ? [createEmptyAssignmentRow(1, 100)]
      : []

  const handleCategoryChange = (value: string) => {
    if (value === "__none__") {
      onChange({ category: null, assignments: [], usesApportionment: false })
      return
    }
    const nextCategory = value as SapAccountAssignmentCategory
    onChange({
      category: nextCategory,
      assignments: [createEmptyAssignmentRow(1, 100)],
      usesApportionment: false,
    })
  }

  const handlePrimaryChange = (value: string) => {
    if (!category) return
    const current = assignments[0] ?? createEmptyAssignmentRow(1, 100)
    onChange({
      category,
      assignments: [writePrimaryValue(category, current, value)],
      usesApportionment: false,
    })
  }

  const primaryValue =
    category && !config.usesApportionment
      ? readPrimaryValue(category, assignments[0] ?? createEmptyAssignmentRow(1, 100))
      : ""

  if (!editable) {
    const showRateio =
      Boolean(category) &&
      (config.usesApportionment || config.assignments.length > 1)

    return (
      <>
        <TableCell className="text-sm">
          {category ? `${category} — ${SAP_ACCOUNT_ASSIGNMENT_CATEGORY_LABELS[category]}` : "—"}
        </TableCell>
        <TableCell className="text-sm">
          {config.usesApportionment
            ? `Rateio (${config.assignments.length} linhas)`
            : primaryValue || "—"}
        </TableCell>
        <TableCell className="text-center">
          {showRateio ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => setRateioOpen(true)}
              >
                <Split className="mr-1 h-3.5 w-3.5" />
                Ver rateio
              </Button>
              <PoAccountApportionmentDialog
                open={rateioOpen}
                onOpenChange={setRateioOpen}
                companyId={companyId}
                itemLabel={materialCode}
                category={category!}
                initialConfig={config}
                onSave={() => {}}
                readOnly
              />
            </>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
      </>
    )
  }

  return (
    <>
      <TableCell className="min-w-[9rem]">
        <Select value={category ?? "__none__"} onValueChange={handleCategoryChange}>
          <SelectTrigger
            className={cn(
              "h-8 w-full text-xs",
              fieldErrors?.category && "border-destructive focus:ring-destructive",
            )}
          >
            <SelectValue placeholder="Classificação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">—</SelectItem>
            {SAP_ACCOUNT_ASSIGNMENT_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat} — {SAP_ACCOUNT_ASSIGNMENT_CATEGORY_LABELS[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="min-w-[8.5rem]">
        {!category ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : config.usesApportionment ? (
          <span
            className={cn(
              "text-xs text-muted-foreground",
              (fieldErrors?.rateioTotal || fieldErrors?.rateioRows) && "text-destructive",
            )}
          >
            Rateio ({config.assignments.length} linhas)
          </span>
        ) : (
          <PoAccountPrimaryField
            companyId={companyId}
            category={category}
            value={primaryValue}
            onChange={handlePrimaryChange}
            invalid={Boolean(fieldErrors?.primary)}
          />
        )}
      </TableCell>
      <TableCell className="min-w-[6.5rem]">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full px-2 text-xs"
          disabled={!category}
          onClick={() => setRateioOpen(true)}
        >
          <Split className="mr-1 h-3.5 w-3.5" />
          Rateio
        </Button>
        {category ? (
          <PoAccountApportionmentDialog
            open={rateioOpen}
            onOpenChange={setRateioOpen}
            companyId={companyId}
            itemLabel={materialCode}
            category={category}
            initialConfig={config}
            fieldErrors={fieldErrors}
            onSave={onChange}
          />
        ) : null}
      </TableCell>
    </>
  )
}
