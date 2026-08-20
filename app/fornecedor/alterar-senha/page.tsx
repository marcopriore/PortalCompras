import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { AlterarSenhaPageClient } from "@/components/auth/alterar-senha-page-client"

export default function FornecedorAlterarSenhaPage() {
  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <Suspense
        fallback={
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <AlterarSenhaPageClient portal="fornecedor" loginHref="/fornecedor/login" />
      </Suspense>
    </div>
  )
}
