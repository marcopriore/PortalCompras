import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function FornecedorUsuariosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/fornecedor/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_supplier_admin, profile_type")
    .eq("id", user.id)
    .single()

  if (profile?.profile_type !== "supplier" || !profile.is_supplier_admin) {
    redirect("/fornecedor")
  }

  return <>{children}</>
}
