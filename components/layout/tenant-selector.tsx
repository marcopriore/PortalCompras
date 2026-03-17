'use client'

import { useRouter } from 'next/navigation'
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
  const router = useRouter()

  const handleChange = (value: string) => {
    document.cookie = `selected_company_id=${encodeURIComponent(value)}; path=/;`
    window.location.reload()
  }

  return (
    <Select value={selectedCompanyId ?? ''} onValueChange={handleChange}>
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

