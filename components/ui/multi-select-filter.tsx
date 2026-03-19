"use client"

import * as React from "react"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface MultiSelectFilterProps {
  label: string
  options: {
    value: string
    label: string
    badge?: React.ReactNode
  }[]
  selected: string[]
  onChange: (values: string[]) => void
  width?: string
}

export default function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  width = "w-40",
}: MultiSelectFilterProps) {
  const [open, setOpen] = React.useState(false)
  const containerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleMouseDown)
    return () => document.removeEventListener("mousedown", handleMouseDown)
  }, [])

  const handleToggleOption = (value: string) => {
    if (value === "__todos__") {
      onChange([])
      return
    }
    const idx = selected.indexOf(value)
    if (idx >= 0) {
      onChange(selected.filter((v) => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const triggerText = React.useMemo(() => {
    if (selected.length === 0) {
      return `${label}: Todos`
    }
    if (selected.length === 1) {
      const opt = options.find((o) => o.value === selected[0])
      return opt?.label ?? `${label}: 1 selecionado`
    }
    return `${label}: ${selected.length} selecionados`
  }, [label, selected, options])

  return (
    <div ref={containerRef} className={cn("relative", width)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between gap-2 border border-border rounded-md px-3 py-2 text-sm bg-background",
          selected.length === 0 && "text-muted-foreground",
        )}
      >
        <span className="truncate text-left">{triggerText}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 bg-card border border-border rounded-xl shadow-lg min-w-[160px] py-1">
          <div
            role="option"
            aria-selected={selected.length === 0}
            onClick={() => handleToggleOption("__todos__")}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/60",
              selected.length === 0 && "bg-primary/5",
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border",
                selected.length === 0 && "bg-primary",
              )}
            >
              {selected.length === 0 ? (
                <Check className="h-3 w-3 text-primary-foreground" />
              ) : null}
            </span>
            <span>Todos</span>
          </div>

          {options.map((opt) => {
            const isSelected = selected.includes(opt.value)
            return (
              <div
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleToggleOption(opt.value)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-muted/60",
                  isSelected && "bg-primary/5",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border",
                    isSelected && "bg-primary",
                  )}
                >
                  {isSelected ? (
                    <Check className="h-3 w-3 text-primary-foreground" />
                  ) : null}
                </span>
                <span>{opt.label}</span>
                {opt.badge != null ? (
                  <span className="ml-auto">{opt.badge}</span>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
