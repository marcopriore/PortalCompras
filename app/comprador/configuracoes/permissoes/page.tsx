import { redirect } from "next/navigation"

export default function PermissoesRedirect() {
  redirect("/comprador/configuracoes?tab=permissoes")
}
