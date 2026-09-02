export type CompanyBranch = {
  id: string
  company_id: string
  code: string
  name: string
  address: string | null
  city: string | null
  state: string | null
  zip_code: string | null
  active: boolean
  created_at: string
}

export type CompanyBranchAddressFields = Pick<
  CompanyBranch,
  "name" | "address" | "city" | "state" | "zip_code"
>
