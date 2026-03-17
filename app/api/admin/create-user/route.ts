import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email, password, fullName, role, companyId } = await request.json()

    if (!email || !password || !fullName || !role || !companyId) {
      return NextResponse.json(
        { error: 'Campos obrigatórios ausentes' },
        { status: 400 },
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // 1. Criar usuário no Auth
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName, company_id: companyId },
      })

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message ?? 'Erro ao criar usuário' },
        { status: 400 },
      )
    }

    // 2. Atualizar perfil na tabela profiles criado pelo trigger
    await new Promise((resolve) => setTimeout(resolve, 500))

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        company_id: companyId,
        full_name: fullName,
        role,
        status: 'active',
        is_superadmin: false,
      })
      .eq('id', authData.user.id)

    if (profileError) {
      return NextResponse.json(
        { error: 'Erro ao atualizar perfil do usuário' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, userId: authData.user.id })
  } catch {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}

