"use client"

import { Button } from "@/components/ui/button"

export const TABLE_PAGE_SIZE = 25

type TablePaginationProps = {
  page: number
  total: number
  onPageChange: (page: number) => void
  pageSize?: number
  disabled?: boolean
}

export function TablePagination({
  page,
  total,
  onPageChange,
  pageSize = TABLE_PAGE_SIZE,
  disabled = false,
}: TablePaginationProps) {
  if (total <= 0) return null

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pageClamped = Math.min(Math.max(page, 1), totalPages)
  const from = (pageClamped - 1) * pageSize + 1
  const to = Math.min(pageClamped * pageSize, total)
  const multiPage = totalPages > 1

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-3">
      <p className="text-xs text-muted-foreground">
        Exibindo {from}–{to} de {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !multiPage || pageClamped === 1}
          onClick={() => onPageChange(Math.max(1, pageClamped - 1))}
        >
          ← Anterior
        </Button>
        <span className="text-xs text-muted-foreground">
          Página {pageClamped} de {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || !multiPage || pageClamped >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, pageClamped + 1))}
        >
          Próximo →
        </Button>
      </div>
    </div>
  )
}
