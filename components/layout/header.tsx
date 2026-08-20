"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, LogOut, User } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { NotificationBell } from "@/components/ui/notification-bell"
import { logAudit } from "@/lib/audit"

interface HeaderProps {
  userName: string
  userEmail: string
  userInitials: string
  tenantSelector?: React.ReactNode
}

export function Header({
  userName,
  userEmail,
  userInitials,
  tenantSelector,
}: HeaderProps) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleLogout = async () => {
    try {
      await logAudit({
        eventType: "user.logout",
        description: "Logout realizado",
        userName,
        metadata: { email: userEmail },
      })

      await fetch("/api/auth/logout", {
        method: "POST",
      })
    } catch {
      // ignore
    }
    window.location.href = "/login"
  }

  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1 max-w-xl">
        {tenantSelector}
      </div>

      <div className="flex items-center gap-2">
        {mounted ? (
          <>
            <NotificationBell />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center gap-2 pl-2 pr-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden md:flex flex-col items-start">
                    <span className="text-sm font-medium">{userName}</span>
                    <span className="text-xs text-muted-foreground">{userEmail}</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push("/comprador/configuracoes?tab=perfil")}
                >
                  <User className="mr-2 h-4 w-4" />
                  Perfil
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : (
          <div className="flex items-center gap-2" aria-hidden="true">
            <div className="h-9 w-9 rounded-md bg-muted/40 animate-pulse" />
            <div className="hidden h-9 w-32 rounded-md bg-muted/40 animate-pulse md:block" />
          </div>
        )}
      </div>
    </header>
  )
}
