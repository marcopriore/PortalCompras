import { ChangePasswordForm } from "@/components/auth/change-password-form"

export default function CompradorAlterarSenhaPage() {
  return (
    <div className="max-w-lg mx-auto py-8 px-4">
      <ChangePasswordForm portal="comprador" forced />
    </div>
  )
}
