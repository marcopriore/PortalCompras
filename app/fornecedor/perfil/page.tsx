"use client"

import * as React from "react"
import { Building2, Mail, MapPin, Phone, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/lib/hooks/useUser"
import { formatCnpj } from "@/lib/utils/cnpj"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type SupplierProfile = {
  id: string
  code: string
  name: string
  cnpj: string | null
  email: string | null
  phone: string | null
  category: string | null
  city: string | null
  state: string | null
  status: string | null
  created_at: string | null
}

type CategoryRow = { category: string }

function Field({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="text-sm font-medium text-foreground break-words">
        {value ?? "—"}
      </p>
    </div>
  )
}

export default function FornecedorPerfilPage() {
  const { supplierId, loading: userLoading } = useUser()
  const [loading, setLoading] = React.useState(true)
  const [supplier, setSupplier] = React.useState<SupplierProfile | null>(null)
  const [categories, setCategories] = React.useState<string[]>([])

  const load = React.useCallback(async () => {
    if (userLoading) return
    if (!supplierId) {
      setSupplier(null)
      setCategories([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const [supRes, catRes] = await Promise.all([
        supabase
          .from("suppliers")
          .select(
            "id, code, name, cnpj, email, phone, category, city, state, status, created_at",
          )
          .eq("id", supplierId)
          .maybeSingle(),
        supabase
          .from("supplier_categories")
          .select("category")
          .eq("supplier_id", supplierId),
      ])

      if (supRes.error) {
        toast.error(supRes.error.message || "Erro ao carregar perfil.")
        setSupplier(null)
        return
      }
      setSupplier((supRes.data as SupplierProfile | null) ?? null)
      setCategories(
        ((catRes.data ?? []) as CategoryRow[])
          .map((c) => c.category)
          .filter(Boolean),
      )
    } catch {
      toast.error("Erro inesperado ao carregar perfil.")
      setSupplier(null)
    } finally {
      setLoading(false)
    }
  }, [supplierId, userLoading])

  React.useEffect(() => {
    void load()
  }, [load])

  const statusLabel =
    supplier?.status === "active"
      ? "Ativo"
      : supplier?.status === "inactive"
        ? "Inativo"
        : (supplier?.status ?? "—")

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Perfil
          </h1>
          <p className="text-sm text-muted-foreground">
            Dados cadastrais do seu fornecedor no portal
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Carregando…
        </div>
      ) : !supplier ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Fornecedor não encontrado ou sem vínculo no perfil.
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-6">
            <div className="mb-6 flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-semibold text-foreground">
                  {supplier.name}
                </h2>
                <p className="font-mono text-sm text-muted-foreground">
                  {supplier.cnpj ? formatCnpj(supplier.cnpj) : "—"}
                </p>
                <div className="mt-2">
                  <Badge
                    variant={
                      supplier.status === "active" ? "default" : "secondary"
                    }
                  >
                    {statusLabel}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <Field label="Código" value={supplier.code} />
              <Field
                label="CNPJ"
                value={
                  supplier.cnpj ? (
                    <span className="font-mono">{formatCnpj(supplier.cnpj)}</span>
                  ) : (
                    "—"
                  )
                }
              />
              <Field
                label="E-mail"
                value={
                  supplier.email ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                      {supplier.email}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <Field
                label="Telefone"
                value={
                  supplier.phone ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      {supplier.phone}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <Field
                label="Cidade / UF"
                value={
                  supplier.city || supplier.state ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      {[supplier.city, supplier.state].filter(Boolean).join(" / ")}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              <Field label="Categoria (cadastro)" value={supplier.category ?? "—"} />
            </div>
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <h3 className="mb-3 text-sm font-medium text-foreground">
              Categorias atendidas
            </h3>
            {categories.length === 0 && !supplier.category ? (
              <p className="text-sm text-muted-foreground">Nenhuma categoria informada.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.length > 0
                  ? categories.map((c) => (
                      <Badge key={c} variant="secondary">
                        {c}
                      </Badge>
                    ))
                  : supplier.category ? (
                      <Badge variant="secondary">{supplier.category}</Badge>
                    ) : null}
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Os dados cadastrais são mantidos pelo comprador. Em caso de correção,
            solicite a atualização ao cliente.
          </p>
        </div>
      )}
    </div>
  )
}
