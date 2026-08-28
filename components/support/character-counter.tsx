import { cn } from "@/lib/utils"

type CharacterCounterProps = {
  current: number
  max: number
  className?: string
}

export function CharacterCounter({ current, max, className }: CharacterCounterProps) {
  const isNearLimit = current > max * 0.9
  const isOver = current > max

  return (
    <p
      className={cn(
        "text-xs text-right",
        isOver
          ? "text-destructive"
          : isNearLimit
            ? "text-warning-foreground"
            : "text-muted-foreground",
        className,
      )}
    >
      {current}/{max}
    </p>
  )
}
