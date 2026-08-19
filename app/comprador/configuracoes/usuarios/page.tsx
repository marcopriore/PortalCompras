import { redirect } from "next/navigation"

export default function UsuariosRedirect() {
  redirect("/comprador/configuracoes?tab=usuarios")
}
