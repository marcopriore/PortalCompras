import {
  SERVICE_KEY,
  SUPABASE_URL,
  TEST_COMPANY_ID,
  TEST_ORDER_ID,
} from "./test-env"

function requireServiceRole() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    throw new Error(
      "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local para os testes críticos.",
    )
  }
  return { url: SUPABASE_URL, key: SERVICE_KEY }
}

async function restGet<T>(path: string): Promise<T> {
  const { url, key } = requireServiceRole()
  const res = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase GET failed: ${res.status} — ${text}`)
  }
  return (await res.json()) as T
}

async function restPatch(path: string, body: Record<string, unknown>) {
  const { url, key } = requireServiceRole()
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase PATCH failed: ${res.status} — ${text}`)
  }
}

export async function resetOrderToSent() {
  await restPatch(`purchase_orders?id=eq.${TEST_ORDER_ID}`, {
    status: "sent",
    accepted_at: null,
    accepted_by_supplier: false,
    estimated_delivery_date: null,
    cancellation_reason: null,
  })
}

export type ActiveContractFixture = {
  id: string
  code: string
  title: string
}

export async function fetchActiveContract(): Promise<ActiveContractFixture | null> {
  const rows = await restGet<
    Array<{ id: string; code: string; title: string }>
  >(
    `contracts?company_id=eq.${TEST_COMPANY_ID}&status=eq.active&select=id,code,title&order=created_at.desc&limit=1`,
  )
  return rows[0] ?? null
}

export type OrderWithContractFixture = {
  orderId: string
  orderCode: string
  contractCode: string
}

export async function fetchOrderWithContractLink(): Promise<OrderWithContractFixture | null> {
  type Row = {
    purchase_order_id: string
    purchase_orders:
      | { code: string; company_id: string }
      | { code: string; company_id: string }[]
      | null
    contract_items:
      | {
          contracts: { code: string } | { code: string }[] | null
        }
      | {
          contracts: { code: string } | { code: string }[] | null
        }[]
      | null
  }

  const rows = await restGet<Row[]>(
    `purchase_order_items?contract_item_id=not.is.null&select=purchase_order_id,purchase_orders!inner(code,company_id),contract_items(contracts(code))&purchase_orders.company_id=eq.${TEST_COMPANY_ID}&limit=10`,
  )

  for (const row of rows) {
    const po = Array.isArray(row.purchase_orders)
      ? row.purchase_orders[0]
      : row.purchase_orders
    const ci = Array.isArray(row.contract_items)
      ? row.contract_items[0]
      : row.contract_items
    const contract = ci?.contracts
      ? Array.isArray(ci.contracts)
        ? ci.contracts[0]
        : ci.contracts
      : null
    if (po?.code && contract?.code) {
      return {
        orderId: row.purchase_order_id,
        orderCode: po.code,
        contractCode: contract.code,
      }
    }
  }
  return null
}

export type ContractMatchScenario = {
  quotationId: string
  quotationCode: string
  contractCode: string
}

type ContractItemRow = {
  material_code: string
  quantity_contracted: number
  quantity_consumed: number
  reserved_quantity: number
  eliminated: boolean
  quotation_item_id: string | null
}

type ContractRow = {
  id: string
  code: string
  supplier_id: string
  contract_items: ContractItemRow[] | null
}

type QuotationItemRow = {
  id: string
  quotation_id: string
  quantity: number
  material_code: string
  quotations:
    | { code: string; status: string }
    | { code: string; status: string }[]
    | null
}

type ProposalRow = {
  id: string
  proposal_items: Array<{
    quotation_item_id: string
    unit_price: number
  }> | null
}

export async function findContractMatchScenario(): Promise<ContractMatchScenario | null> {
  const features = await restGet<Array<{ enabled: boolean }>>(
    `tenant_features?company_id=eq.${TEST_COMPANY_ID}&feature_key=eq.contract_balance&select=enabled&limit=1`,
  )
  if (!features[0]?.enabled) return null

  const contracts = await restGet<ContractRow[]>(
    `contracts?company_id=eq.${TEST_COMPANY_ID}&status=eq.active&select=id,code,supplier_id,contract_items(material_code,quantity_contracted,quantity_consumed,reserved_quantity,eliminated,quotation_item_id)`,
  )

  for (const contract of contracts) {
    const items = (contract.contract_items ?? []).filter((i) => !i.eliminated)
    for (const ci of items) {
      const availableQty =
        Number(ci.quantity_contracted) -
        Number(ci.quantity_consumed) -
        Number(ci.reserved_quantity)
      if (availableQty <= 0) continue

      let quotationItems: QuotationItemRow[] = []
      if (ci.quotation_item_id) {
        quotationItems = await restGet<QuotationItemRow[]>(
          `quotation_items?id=eq.${ci.quotation_item_id}&select=id,quotation_id,quantity,material_code,quotations(code,status)`,
        )
      } else if (ci.material_code?.trim()) {
        const encoded = encodeURIComponent(ci.material_code.trim())
        quotationItems = await restGet<QuotationItemRow[]>(
          `quotation_items?company_id=eq.${TEST_COMPANY_ID}&material_code=eq.${encoded}&select=id,quotation_id,quantity,material_code,quotations(code,status)`,
        )
      }

      for (const qi of quotationItems) {
        const quotation = Array.isArray(qi.quotations)
          ? qi.quotations[0]
          : qi.quotations
        if (!quotation) continue
        if (["completed", "cancelled", "draft"].includes(quotation.status)) {
          continue
        }

        const proposals = await restGet<ProposalRow[]>(
          `quotation_proposals?quotation_id=eq.${qi.quotation_id}&supplier_id=eq.${contract.supplier_id}&status=in.(submitted,selected)&select=id,proposal_items(quotation_item_id,unit_price)`,
        )

        const hasPricedProposal = proposals.some((proposal) =>
          (proposal.proposal_items ?? []).some(
            (pi) =>
              pi.quotation_item_id === qi.id && Number(pi.unit_price) > 0,
          ),
        )
        if (!hasPricedProposal) continue

        return {
          quotationId: qi.quotation_id,
          quotationCode: quotation.code,
          contractCode: contract.code,
        }
      }
    }
  }

  return null
}
