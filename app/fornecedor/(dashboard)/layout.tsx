import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"

export default function FornecedorDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar type="fornecedor" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          userName="Maria Santos"
          userEmail="fornecedor@example.com"
          userInitials="MS"
        />
        <main className="flex-1 overflow-auto p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
