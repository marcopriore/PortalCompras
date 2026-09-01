import * as React from "react"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

type RequiredLabelProps = React.ComponentProps<typeof Label> & {
  required?: boolean
}

export function RequiredLabel({
  required = false,
  children,
  className,
  ...props
}: RequiredLabelProps) {
  return (
    <Label className={cn(className)} {...props}>
      {children}
      {required ? <span className="text-destructive ml-0.5">*</span> : null}
    </Label>
  )
}
