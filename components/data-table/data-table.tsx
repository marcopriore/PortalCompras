"use client"

import { useEffect, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, Filter } from "lucide-react"
import { TABLE_PAGE_SIZE, TablePagination } from "@/components/ui/table-pagination"

export interface Column<T> {
  key: keyof T | string
  header: string
  cell?: (item: T) => React.ReactNode
  className?: string
}

interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  searchPlaceholder?: string
  searchKey?: keyof T
  filterOptions?: { label: string; value: string }[]
  filterKey?: keyof T
  onRowClick?: (item: T) => void
  actions?: (item: T) => React.ReactNode
  pageSize?: number
  toolbarRight?: React.ReactNode
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  searchPlaceholder = "Buscar...",
  searchKey,
  filterOptions,
  filterKey,
  onRowClick,
  actions,
  pageSize = TABLE_PAGE_SIZE,
  toolbarRight,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)

  const filteredData = data.filter((item) => {
    const matchesSearch = searchKey
      ? String(item[searchKey]).toLowerCase().includes(search.toLowerCase())
      : true
    const matchesFilter = filter === "all" || (filterKey && String(item[filterKey]) === filter)
    return matchesSearch && matchesFilter
  })

  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize))
  const pageClamped = Math.min(currentPage, totalPages)
  const startIndex = (pageClamped - 1) * pageSize
  const paginatedData = filteredData.slice(startIndex, startIndex + pageSize)

  useEffect(() => {
    setCurrentPage(1)
  }, [data, search, filter])

  const getValue = (item: T, key: string) => {
    const keys = key.split(".")
    let value: unknown = item
    for (const k of keys) {
      value = (value as Record<string, unknown>)?.[k]
    }
    return value
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          {searchKey && (
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setCurrentPage(1)
                }}
                className="pl-9"
              />
            </div>
          )}
          {filterOptions && filterKey && (
            <Select
              value={filter}
              onValueChange={(value) => {
                setFilter(value)
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filtrar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {filterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground">
            {filteredData.length} resultado(s)
          </div>
          {toolbarRight}
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={String(column.key)} className={column.className}>
                  {column.header}
                </TableHead>
              ))}
              {actions && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="h-24 text-center"
                >
                  Nenhum resultado encontrado.
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((item) => (
                <TableRow
                  key={item.id}
                  className={onRowClick ? "cursor-pointer hover:bg-muted/50" : ""}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map((column) => (
                    <TableCell key={String(column.key)} className={column.className}>
                      {column.cell
                        ? column.cell(item)
                        : String(getValue(item, String(column.key)) ?? "")}
                    </TableCell>
                  ))}
                  {actions && (
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      {actions(item)}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <TablePagination
        page={pageClamped}
        total={filteredData.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
      />
    </div>
  )
}
