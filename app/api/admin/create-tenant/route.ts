import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { name, cnpj, adminName, adminEmail, adminPassword } =
      await request.json()

    if (!name || !adminName || !adminEmail || !adminPassword) {
      return NextResponse.json(
        { error: 'Campos obrigatórios ausentes' },
        { status: 400 },
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // 1. Criar tenant na tabela companies
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name,
        cnpj: cnpj || null,
        status: 'active',
      })
      .select('id, name, cnpj, status, created_at')
      .single()

    if (companyError || !company) {
      return NextResponse.json(
        { error: 'Erro ao criar tenant' },
        { status: 500 },
      )
    }

    // 2. Criar usuário admin do tenant no Auth
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email: adminEmail,
        password: adminPassword,
        email_confirm: true,
        user_metadata: {
          full_name: adminName,
          company_id: (company as any).id,
        },
      })

    if (authError || !authData?.user) {
      return NextResponse.json(
        { error: authError?.message ?? 'Erro ao criar usuário admin' },
        { status: 400 },
      )
    }

    // 3. Atualizar perfil criado pelo trigger
    await new Promise((resolve) => setTimeout(resolve, 500))

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        company_id: (company as any).id,
        full_name: adminName,
        role: 'admin',
        status: 'active',
        is_superadmin: false,
      })
      .eq('id', authData.user.id)

    if (profileError) {
      return NextResponse.json(
        { error: 'Erro ao atualizar perfil do usuário admin' },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, company })
  } catch {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}

