'use client'

import * as React from 'react'
import { useTenant } from '@/contexts/tenant-context'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Company = { id: string; name: string }

export function TenantSelector({
  companies,
  selectedCompanyId,
}: {
  companies: Company[]
  selectedCompanyId: string | null
}) {
  const { companyId, setCompanyId } = useTenant()

  // Usa o companyId do context; fallback para a prop inicial
  const currentValue = companyId ?? selectedCompanyId ?? ''

  const handleChange = (value: string) => {
    setCompanyId(value)
  }

  return (
    <Select value={currentValue} onValueChange={handleChange}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Selecionar tenant" />
      </SelectTrigger>
      <SelectContent>
        {companies.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
