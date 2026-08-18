"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Plug, Radio } from "lucide-react"

const links = [
  { href: "/admin/integracoes", label: "Configuração", icon: Plug },
  { href: "/admin/integracoes/monitor", label: "Monitor", icon: Radio },
]

export function AdminIntegracoesSubnav() {
  const pathname = usePathname()

  return (
    <div className="flex gap-1 border-b border-border">
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/admin/integracoes"
            ? pathname === href
            : pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        )
      })}
    </div>
  )
}
