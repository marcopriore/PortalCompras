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
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const currentValue = companyId ?? selectedCompanyId ?? ''

  const handleChange = (value: string) => {
    setCompanyId(value)
  }

  if (!mounted) {
    return (
      <div
        className="h-9 w-[220px] rounded-md border border-input bg-muted/40 animate-pulse"
        aria-hidden="true"
      />
    )
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
