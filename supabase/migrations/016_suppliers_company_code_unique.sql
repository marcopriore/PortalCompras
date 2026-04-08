-- Upsert de fornecedores por tenant + código ERP (importação Excel)
CREATE UNIQUE INDEX IF NOT EXISTS suppliers_company_id_code_unique
  ON public.suppliers (company_id, code);
