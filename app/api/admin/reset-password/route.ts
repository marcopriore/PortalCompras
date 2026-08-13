import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/send-email'
import { createServiceRoleClient } from '@/lib/supabase/service-role'
import { loadPasswordPolicy } from '@/lib/settings/password-policy'
import {
  applyPasswordChange,
  validateNewPasswordForTenant,
} from '@/lib/auth/password-policy-server'

export async function POST(request: Request) {
  try {
    const { userId, userEmail, userName, newPassword, sendByEmail, companyId } =
      await request.json()

    if (!userId || !newPassword || !companyId) {
      return NextResponse.json(
        { error: 'Campos obrigatórios ausentes' },
        { status: 400 },
      )
    }

    const supabaseAdmin = createServiceRoleClient()
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

    const authAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { error } = await authAdmin.auth.admin.updateUserById(userId, {
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

    // Enviar e-mail se solicitado
    if (sendByEmail && userEmail) {
      await sendEmail({
        to: userEmail,
        subject: 'Sua senha foi redefinida — Valore',
        html: `
          <p>Olá, <strong>${userName}</strong>!</p>
          <p>Sua senha de acesso ao Valore foi redefinida por um administrador.</p>
          <p><strong>Nova senha temporária:</strong> <code>${newPassword}</code></p>
          <p>Recomendamos que você altere sua senha no primeiro acesso.</p>
        `,
      })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}
