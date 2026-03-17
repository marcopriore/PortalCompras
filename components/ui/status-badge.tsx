import { cn } from "@/lib/utils"

type StatusType = 
  | "pendente" 
  | "em_andamento" 
  | "concluido" 
  | "cancelado" 
  | "aguardando" 
  | "aprovado" 
  | "rejeitado"
  | "rascunho"
  | "enviado"

type VariantType = 
  | "default"
  | "success"
  | "warning"
  | "destructive"
  | "info"
  | "muted"

const statusStyles: Record<StatusType, { bg: string; text: string; label: string }> = {
  pendente: { bg: "bg-warning/15", text: "text-warning-foreground", label: "Pendente" },
  em_andamento: { bg: "bg-primary/15", text: "text-primary", label: "Em Andamento" },
  concluido: { bg: "bg-success/15", text: "text-success", label: "Concluído" },
  cancelado: { bg: "bg-destructive/15", text: "text-destructive", label: "Cancelado" },
  aguardando: { bg: "bg-muted", text: "text-muted-foreground", label: "Aguardando" },
  aprovado: { bg: "bg-success/15", text: "text-success", label: "Aprovado" },
  rejeitado: { bg: "bg-destructive/15", text: "text-destructive", label: "Rejeitado" },
  rascunho: { bg: "bg-muted", text: "text-muted-foreground", label: "Rascunho" },
  enviado: { bg: "bg-primary/15", text: "text-primary", label: "Enviado" },
}

const variantStyles: Record<VariantType, { bg: string; text: string }> = {
  default: { bg: "bg-secondary", text: "text-secondary-foreground" },
  success: { bg: "bg-success/15", text: "text-success" },
  warning: { bg: "bg-warning/15", text: "text-warning-foreground" },
  destructive: { bg: "bg-destructive/15", text: "text-destructive" },
  info: { bg: "bg-primary/15", text: "text-primary" },
  muted: { bg: "bg-muted", text: "text-muted-foreground" },
}

interface StatusBadgeProps {
  status?: StatusType
  variant?: VariantType
  className?: string
  children?: React.ReactNode
}

export function StatusBadge({ status, variant, className, children }: StatusBadgeProps) {
  let bg: string
  let text: string
  let label: React.ReactNode

  if (status && statusStyles[status]) {
    const style = statusStyles[status]
    bg = style.bg
    text = style.text
    label = children || style.label
  } else if (variant && variantStyles[variant]) {
    const style = variantStyles[variant]
    bg = style.bg
    text = style.text
    label = children
  } else {
    bg = variantStyles.default.bg
    text = variantStyles.default.text
    label = children
  }
  
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        bg,
        text,
        className
      )}
    >
      {label}
    </span>
  )
}
