import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/send-email'

export async function POST(request: Request) {
  try {
    const { userId, userEmail, userName, newPassword, sendByEmail, companyId } =
      await request.json()

    if (!userId || !newPassword) {
      return NextResponse.json(
        { error: 'Campos obrigatórios ausentes' },
        { status: 400 },
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Enviar e-mail se solicitado
    if (sendByEmail && userEmail) {
      await sendEmail({
        to: userEmail,
        subject: 'Sua senha foi redefinida — Valore',
        html: `
          <p>Olá, <strong>${userName}</strong>!</p>
          <p>Sua senha de acesso ao Valore foi redefinida por um administrador.</p>
          <p><strong>Nova senha temporária:</strong> <code>${newPassword}</code></p>
          <p>Recomendamos que você altere sua senha no primeiro acesso em <strong>Configurações → Segurança</strong>.</p>
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
