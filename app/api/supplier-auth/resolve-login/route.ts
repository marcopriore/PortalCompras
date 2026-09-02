import { NextResponse } from "next/server"
import { resolveSupplierAdminByCnpj } from "@/lib/supplier-portal/resolve-admin-by-cnpj"

/** POST — resolve CNPJ do administrador para e-mail de autenticação */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { cnpj?: string }
    const resolved = await resolveSupplierAdminByCnpj(body.cnpj ?? "")

    if ("error" in resolved) {
      return NextResponse.json(
        {
          error: resolved.error,
          multiple: resolved.multiple,
          options: resolved.options,
        },
        { status: resolved.status },
      )
    }

    return NextResponse.json({
      email: resolved.email,
      companyId: resolved.companyId,
      supplierId: resolved.supplierId,
    })
  } catch (error) {
    console.error("[supplier-auth/resolve-login]", error)
    return NextResponse.json({ error: "Erro interno do servidor." }, { status: 500 })
  }
}
