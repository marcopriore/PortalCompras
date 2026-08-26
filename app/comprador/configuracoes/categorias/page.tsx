import { redirect } from "next/navigation"

export default function CategoriasConfigRedirect() {
  redirect("/comprador/configuracoes?tab=categorias")
}
