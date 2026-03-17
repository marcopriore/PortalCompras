import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

type ImportUserPayload = {
  email: string
  fullName: string
  role: string
  status: string
  companyId: string
}

type ImportError = {
  email: string
  reason: string
}

function generatePassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  const special = '@#$%&*'
  const all = upper + lower + digits + special
  const rand = (chars: string) =>
    chars[Math.floor(Math.random() * chars.length)]
  const base = [rand(upper), rand(lower), rand(digits), rand(special)]
  for (let i = 0; i < 6; i++) base.push(rand(all))
  return base.sort(() => Math.random() - 0.5).join('')
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const users = (body?.users ?? []) as ImportUserPayload[]

    if (!Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { error: 'Lista de usuários vazia ou inválida' },
        { status: 400 },
      )
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    let created = 0
    const errors: ImportError[] = []

    // Processar sequencialmente para facilitar rollback por usuário
    for (const user of users) {
      const { email, fullName, role, status, companyId } = user

      if (!email || !fullName || !role || !status || !companyId) {
        errors.push({
          email: email || '',
          reason: 'Campos obrigatórios ausentes',
        })
        continue
      }

      try {
        const password = generatePassword()

        const { data: authData, error: authError } =
          await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName, company_id: companyId },
          })

        if (authError || !authData?.user) {
          errors.push({
            email,
            reason: authError?.message ?? 'Erro ao criar usuário no Auth',
          })
          continue
        }

        // aguardar trigger criar perfil
        await new Promise((resolve) => setTimeout(resolve, 500))

        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({
            company_id: companyId,
            full_name: fullName,
            role,
            status,
            is_superadmin: false,
          })
          .eq('id', authData.user.id)

        if (profileError) {
          errors.push({
            email,
            reason: profileError.message ?? 'Erro ao atualizar perfil',
          })
          continue
        }

        created += 1
      } catch (err: any) {
        errors.push({
          email,
          reason: err?.message ?? 'Erro inesperado ao importar usuário',
        })
      }
    }

    return NextResponse.json({ created, errors })
  } catch {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 },
    )
  }
}

