import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createServiceRoleClient } from "@/lib/supabase/service-role"
import {
  aggregateSuppliersByIdentity,
  countByKey,
  filterAggregatedSuppliers,
  sumCountsForIds,
  type GlobalSupplierRow,
} from "@/lib/admin/global-suppliers"

export const runtime = "nodejs"

async function requireSuperAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_superadmin")
    .eq("id", user.id)
    .single()

  if (!profile?.is_superadmin) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { user }
}

/**
 * Lista global de fornecedores (superadmin), agregados por CNPJ.
 * Inclui tenants, contagens de cotações/pedidos/usuários e último login (audit supplier.login).
 */
export async function GET(request: Request) {
  try {
    const auth = await requireSuperAdmin()
    if ("error" in auth) return auth.error

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1)
    const pageSizeRaw = Number(searchParams.get("page_size") ?? "25") || 25
    const pageSize = Math.min(100, Math.max(1, pageSizeRaw))
    const search = searchParams.get("search")?.trim() || null

    const service = createServiceRoleClient()

    const { data: supplierRows, error } = await service
      .from("suppliers")
      .select(
        "id, company_id, code, name, cnpj, email, phone, city, state, status, companies(id, name)",
      )
      .order("name", { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const aggregated = filterAggregatedSuppliers(
      aggregateSuppliersByIdentity(supplierRows ?? []),
      search,
    )

    const total = aggregated.length
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const from = (page - 1) * pageSize
    const pageRows = aggregated.slice(from, from + pageSize)

    const supplierIds = pageRows.flatMap((r) => r.supplier_ids)

    const emptyPage = {
      suppliers: pageRows,
      page,
      page_size: pageSize,
      total,
      total_pages: totalPages,
    }

    if (supplierIds.length === 0) {
      return NextResponse.json({ data: emptyPage })
    }

    const [quotRes, orderRes, usersRes] = await Promise.all([
      service
        .from("quotation_suppliers")
        .select("supplier_id")
        .in("supplier_id", supplierIds),
      service
        .from("purchase_orders")
        .select("supplier_id")
        .in("supplier_id", supplierIds),
      service
        .from("profiles")
        .select("id, supplier_id")
        .eq("profile_type", "supplier")
        .in("supplier_id", supplierIds),
    ])

    const quotCounts = countByKey(quotRes.data)
    const orderCounts = countByKey(orderRes.data)
    const userRows = usersRes.data ?? []
    const usersBySupplier = new Map<string, string[]>()
    for (const u of userRows) {
      if (!u.supplier_id) continue
      const list = usersBySupplier.get(u.supplier_id) ?? []
      list.push(u.id)
      usersBySupplier.set(u.supplier_id, list)
    }

    const profileIds = userRows.map((u) => u.id).filter(Boolean)
    const lastLoginByUser = new Map<string, string>()

    if (profileIds.length > 0) {
      const { data: loginLogs } = await service
        .from("audit_logs")
        .select("user_id, created_at")
        .eq("event_type", "supplier.login")
        .in("user_id", profileIds)
        .order("created_at", { ascending: false })
        .limit(Math.min(2000, profileIds.length * 5))

      for (const log of loginLogs ?? []) {
        if (!log.user_id || !log.created_at) continue
        if (!lastLoginByUser.has(log.user_id)) {
          lastLoginByUser.set(log.user_id, String(log.created_at))
        }
      }
    }

    const enriched: GlobalSupplierRow[] = pageRows.map((row) => {
      let usersCount = 0
      let lastLogin: string | null = null
      for (const sid of row.supplier_ids) {
        const uids = usersBySupplier.get(sid) ?? []
        usersCount += uids.length
        for (const uid of uids) {
          const at = lastLoginByUser.get(uid)
          if (at && (!lastLogin || at > lastLogin)) lastLogin = at
        }
      }

      return {
        ...row,
        quotations_count: sumCountsForIds(quotCounts, row.supplier_ids),
        orders_count: sumCountsForIds(orderCounts, row.supplier_ids),
        users_count: usersCount,
        last_login_at: lastLogin,
      }
    })

    return NextResponse.json({
      data: {
        suppliers: enriched,
        page,
        page_size: pageSize,
        total,
        total_pages: totalPages,
      },
    })
  } catch (err) {
    console.error("[admin/suppliers]", err)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
