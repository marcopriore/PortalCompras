import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/send-email'
import { requireTenantAdmin } from '@/lib/api/require-tenant-admin'
import { assertAdminUserTarget } from '@/lib/api/admin-user-target'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { loadPasswordPolicy } from '@/lib/settings/password-policy'
import {
  applyPasswordChange,
  validateNewPasswordForTenant,
} from '@/lib/auth/password-policy-server'

export async function POST(request: Request) {
  try {
    const auth = await requireTenantAdmin()
    if ('error' in auth) return auth.error

    const { userId, userName, newPassword, sendByEmail } =
      await request.json()

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'Campos obrigatórios ausentes' },
        { status: 400 },
      )
    }

    const supabaseAdmin = createServiceRoleClient()
    const companyId = auth.companyId

    const { data: target } = await supabaseAdmin
      .from('profiles')
      .select('company_id, is_superadmin')
      .eq('id', userId)
      .maybeSingle()

    const gate = assertAdminUserTarget({
      actorCompanyId: companyId,
      actorIsSuperAdmin: auth.isSuperAdmin,
      target,
    })
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error }, { status: gate.status })
    }

    const policy = await loadPasswordPolicy(supabaseAdmin, companyId)

    const validation = await validateNewPasswordForTenant(
      supabaseAdmin,
      userId,
      companyId,
      newPassword,
      policy,
    )
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 })
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    await applyPasswordChange(
      supabaseAdmin,
      userId,
      companyId,
      newPassword,
      policy,
    )

    if (sendByEmail) {
      const { data: authData } = await supabaseAdmin.auth.admin.getUserById(
        userId,
      )
      const to = authData.user?.email
      if (to) {
        const safeName =
          typeof userName === 'string' && userName.trim()
            ? userName.trim()
            : 'usuário'
        await sendEmail({
          to,
          subject: 'Sua senha foi redefinida — Valore',
          html: `
          <p>Olá, <strong>${safeName}</strong>!</p>
          <p>Sua senha de acesso ao Valore foi redefinida por um administrador.</p>
          <p><strong>Nova senha temporária:</strong> <code>${newPassword}</code></p>
          <p>Recomendamos que você altere sua senha no primeiro acesso.</p>
        `,
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}
