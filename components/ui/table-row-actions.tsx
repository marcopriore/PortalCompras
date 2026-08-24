"use client"

import Link from "next/link"
import * as React from "react"
import type { LucideIcon } from "lucide-react"
import { MoreHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export type TableRowAction = {
  label: string
  icon?: LucideIcon
  href?: string
  onClick?: () => void
  disabled?: boolean
  destructive?: boolean
  hidden?: boolean
  title?: string
  className?: string
  separatorBefore?: boolean
}

type TableRowActionsProps = {
  actions: TableRowAction[]
  align?: "start" | "center" | "end"
  "aria-label"?: string
}

/**
 * Padrão único de ações em grids do Valore (referência: listagem de Cotações).
 * Trigger ghost + ícone MoreHorizontal; itens com ícone + rótulo.
 */
export function TableRowActions({
  actions,
  align = "end",
  "aria-label": ariaLabel = "Ações",
}: TableRowActionsProps) {
  const visible = actions.filter((action) => !action.hidden)
  if (visible.length === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={ariaLabel}>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align}>
        {visible.map((action, index) => {
          const Icon = action.icon
          const content = (
            <>
              {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
              {action.label}
            </>
          )
          const className = cn(
            action.destructive && "text-destructive focus:text-destructive",
            action.className,
          )
          const key = `${action.label}-${action.href ?? index}`

          const item = action.href ? (
            <DropdownMenuItem
              key={key}
              asChild
              disabled={action.disabled}
              title={action.title}
              className={className}
            >
              <Link href={action.href}>{content}</Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              key={key}
              disabled={action.disabled}
              title={action.title}
              className={cn("cursor-pointer", className)}
              onClick={action.onClick}
            >
              {content}
            </DropdownMenuItem>
          )

          if (action.separatorBefore) {
            return (
              <React.Fragment key={`${key}-wrap`}>
                <DropdownMenuSeparator />
                {item}
              </React.Fragment>
            )
          }

          return item
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
