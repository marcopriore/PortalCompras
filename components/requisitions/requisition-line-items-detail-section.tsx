"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PoItemAccountConfigTableCells } from "@/components/comprador/po-item-account-config-cells"
import { useImplantationConfig } from "@/lib/hooks/use-implantation-config"
import {
  buildAccountConfigsFromRequisitionItems,
  emptyRequisitionAccountConfig,
  type LoadedRequisitionItemRow,
} from "@/lib/requisitions/line-items-helpers"

export type RequisitionDetailLineItem = LoadedRequisitionItemRow & {
  material_code: string | null
  material_description: string
  quantity: number
  unit_of_measure: string | null
  commodity_group: string | null
  observations: string | null
}

type RequisitionLineItemsDetailSectionProps = {
  companyId: string | null
  items: RequisitionDetailLineItem[]
  title?: string
}

export function RequisitionLineItemsDetailSection({
  companyId,
  items,
  title = "Itens da Requisição",
}: RequisitionLineItemsDetailSectionProps) {
  const { accountAssignmentEnabled } = useImplantationConfig()

  const accountConfigs = React.useMemo(
    () => buildAccountConfigsFromRequisitionItems(items),
    [items],
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>{title}</CardTitle>
        <Badge variant="outline" className="text-xs">
          {items.length} item{items.length === 1 ? "" : "s"}
        </Badge>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhum item cadastrado.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Descrição Curta</TableHead>
                  {accountAssignmentEnabled ? (
                    <>
                      <TableHead className="text-center whitespace-nowrap min-w-[9rem]">
                        Classificação
                      </TableHead>
                      <TableHead className="text-center whitespace-nowrap min-w-[8.5rem]">
                        Coletor
                      </TableHead>
                      <TableHead className="text-center whitespace-nowrap min-w-[6.5rem]">
                        Rateio
                      </TableHead>
                    </>
                  ) : null}
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Grupo</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell className="font-mono text-sm">
                      {it.material_code ?? "—"}
                    </TableCell>
                    <TableCell className="font-medium text-sm">
                      {it.material_description}
                    </TableCell>
                    {accountAssignmentEnabled ? (
                      <PoItemAccountConfigTableCells
                        companyId={companyId}
                        materialCode={it.material_code ?? it.id}
                        config={accountConfigs[it.id] ?? emptyRequisitionAccountConfig()}
                        editable={false}
                        onChange={() => {}}
                      />
                    ) : null}
                    <TableCell className="text-right text-sm">{it.quantity}</TableCell>
                    <TableCell className="text-sm">{it.unit_of_measure ?? "—"}</TableCell>
                    <TableCell className="text-sm">{it.commodity_group ?? "—"}</TableCell>
                    <TableCell className="text-sm">{it.observations ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
