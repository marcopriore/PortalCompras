import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { seedDefaultTenantSettings } from '@/lib/settings/tenant-settings'
import { seedDefaultTenantFeatures } from '@/lib/settings/seed-tenant-features'
import {
  seedDefaultPasswordPolicy,
  buildDefaultPasswordPolicy,
  loadPasswordPolicy,
} from '@/lib/settings/password-policy'
import { validatePasswordAgainstPolicy } from '@/lib/settings/password-policy-registry'
import { applyPasswordChange } from '@/lib/auth/password-policy-server'
import {
  assignPermissionGroupsByRoleCodes,
  seedSystemPermissionGroups,
} from '@/lib/permissions/seed-tenant-permission-groups'

export async function POST(request: Request) {
  try {
    const { name, cnpj, adminName, adminEmail, adminPassword } =
      await request.json()

    const trimmedName = typeof name === 'string' ? name.trim() : ''
    const trimmedAdminName =
      typeof adminName === 'string' ? adminName.trim() : ''
    const trimmedAdminEmail =
      typeof adminEmail === 'string' ? adminEmail.trim().toLowerCase() : ''
    const trimmedCnpj =
      typeof cnpj === 'string' && cnpj.trim() ? cnpj.trim() : null

    if (!trimmedName || !trimmedAdminName || !trimmedAdminEmail || !adminPassword) {
      return NextResponse.json(
        { error: 'Campos obrigatórios ausentes' },
        { status: 400 },
      )
    }

    const defaultPolicy = buildDefaultPasswordPolicy()
    const adminPasswordCheck = validatePasswordAgainstPolicy(
      adminPassword,
      defaultPolicy,
    )
    if (!adminPasswordCheck.ok) {
      return NextResponse.json({ error: adminPasswordCheck.error }, { status: 400 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Evita tenants homônimos (causa "duplicado" no seletor)
    const { data: existingByName } = await supabaseAdmin
      .from('companies')
      .select('id, name')
      .ilike('name', trimmedName)
      .limit(1)
      .maybeSingle()

    if (existingByName) {
      return NextResponse.json(
        {
          error: `Já existe um tenant com o nome "${existingByName.name}". Use outro nome ou edite o existente.`,
        },
        { status: 409 },
      )
    }

    if (trimmedCnpj) {
      const { data: existingByCnpj } = await supabaseAdmin
        .from('companies')
        .select('id')
        .eq('cnpj', trimmedCnpj)
        .limit(1)
        .maybeSingle()

      if (existingByCnpj) {
        return NextResponse.json(
          { error: 'Já existe um tenant com este CNPJ.' },
          { status: 409 },
        )
      }
    }

    // 1. Criar tenant
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: trimmedName,
        cnpj: trimmedCnpj,
        status: 'active',
      })
      .select('id, name, cnpj, status, created_at')
      .single()

    if (companyError || !company) {
      const msg = companyError?.message?.includes('companies_cnpj')
        ? 'Já existe um tenant com este CNPJ.'
        : 'Erro ao criar tenant'
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const companyId = (company as { id: string }).id
    let createdAuthUserId: string | null = null

    const rollbackTenant = async () => {
      try {
        if (createdAuthUserId) {
          await supabaseAdmin.auth.admin.deleteUser(createdAuthUserId)
        }
      } catch (err) {
        console.error('create-tenant: rollback auth user', err)
      }
      try {
        await supabaseAdmin.from('companies').delete().eq('id', companyId)
      } catch (err) {
        console.error('create-tenant: rollback company', err)
      }
    }

    try {
      await seedDefaultTenantSettings(supabaseAdmin, companyId)
      await seedDefaultPasswordPolicy(supabaseAdmin, companyId)
      await seedDefaultTenantFeatures(supabaseAdmin, companyId)
      await seedSystemPermissionGroups(supabaseAdmin, companyId)
    } catch (settingsError) {
      console.error('create-tenant: seed settings/groups', settingsError)
      await rollbackTenant()
      return NextResponse.json(
        { error: 'Erro ao inicializar configurações do tenant' },
        { status: 500 },
      )
    }

    // Centro de custo padrão — evita bloqueio ao editar o 1º usuário
    const { data: defaultCostCenter, error: ccError } = await supabaseAdmin
      .from('cost_centers')
      .insert({
        company_id: companyId,
        code: 'GERAL',
        description: 'Geral',
        active: true,
      })
      .select('id')
      .single()

    if (ccError || !defaultCostCenter?.id) {
      console.error('create-tenant: seed cost center', ccError)
      await rollbackTenant()
      return NextResponse.json(
        { error: 'Erro ao criar centro de custo padrão do tenant' },
        { status: 500 },
      )
    }

    // 2. Criar usuário admin do tenant no Auth
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: trimmedAdminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: {
          full_name: trimmedAdminName,
          company_id: companyId,
        },
      })

    if (authError || !authData?.user) {
      await rollbackTenant()
      return NextResponse.json(
        { error: authError?.message ?? 'Erro ao criar usuário admin' },
        { status: 400 },
      )
    }

    createdAuthUserId = authData.user.id

    // 3. Atualizar perfil criado pelo trigger — Admin completo
    await new Promise((resolve) => setTimeout(resolve, 500))

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        company_id: companyId,
        full_name: trimmedAdminName,
        role: 'admin',
        roles: ['admin'],
        profile_type: 'buyer',
        status: 'active',
        is_superadmin: false,
        cost_center_id: defaultCostCenter.id,
      })
      .eq('id', authData.user.id)

    if (profileError) {
      await rollbackTenant()
      return NextResponse.json(
        { error: 'Erro ao atualizar perfil do usuário admin' },
        { status: 500 },
      )
    }

    try {
      await assignPermissionGroupsByRoleCodes(
        supabaseAdmin,
        companyId,
        authData.user.id,
        ['admin'],
      )
    } catch (groupErr) {
      console.error('create-tenant: assign admin group', groupErr)
    }

    const policy = await loadPasswordPolicy(supabaseAdmin, companyId)
    await applyPasswordChange(
      supabaseAdmin,
      authData.user.id,
      companyId,
      adminPassword,
      policy,
    )

    return NextResponse.json({ success: true, company })
  } catch {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}
