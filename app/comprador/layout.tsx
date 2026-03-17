import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"

export default function CompradorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar type="comprador" />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header 
          userName="João Silva" 
          userRole="Comprador Sênior" 
          userInitials="JS" 
        />
        <main className="flex-1 overflow-auto p-6 bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
