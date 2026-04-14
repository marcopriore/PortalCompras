"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ExternalLink, FileText } from "lucide-react"

type Term = {
  id: string
  title: string
  content: string
  version: string
  version_date: string
}

type Props = {
  open: boolean
  term: Term | null
  companyId: string | null
  loading?: boolean
  saving?: boolean
  onAccept: () => void
  onCancel: () => void
}

export function TermsAcceptanceDialog({
  open,
  term,
  companyId,
  loading,
  saving,
  onAccept,
  onCancel,
}: Props) {
  const [accepted, setAccepted] = React.useState(false)

  React.useEffect(() => {
    if (open) setAccepted(false)
  }, [open])

  const termsUrl = companyId ? `/termos/${companyId}` : null

  const versionDate = term
    ? new Date(term.version_date).toLocaleDateString("pt-BR", {
        timeZone: "UTC",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel()
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 shrink-0 text-primary" />
            <DialogTitle>Aceite de Termos de Fornecimento</DialogTitle>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-muted-foreground">Carregando termos...</p>
          </div>
        ) : term ? (
          <div className="space-y-4">
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm font-semibold text-foreground">{term.title}</p>
              <p className="text-xs text-muted-foreground">
                Versão {term.version} — vigente desde {versionDate}
              </p>
              {termsUrl && (
                <a
                  href={termsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Ler termos completos
                </a>
              )}
            </div>

            <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-4">
              <Checkbox
                id="accept-terms"
                checked={accepted}
                onCheckedChange={(v) => setAccepted(Boolean(v))}
                className="mt-0.5 shrink-0"
              />
              <Label
                htmlFor="accept-terms"
                className="cursor-pointer text-sm leading-relaxed text-foreground"
              >
                Declaro que li e aceito integralmente os{" "}
                <span className="font-semibold">{term.title}</span> (Versão {term.version}), e estou
                ciente de que ao confirmar este aceite fico vinculado às condições neles
                estabelecidas.
              </Label>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhum termo configurado. Prossiga com o aceite.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={saving || loading || (term != null && !accepted)}
            className="bg-green-600 text-white hover:bg-green-700"
            onClick={onAccept}
          >
            {saving ? "Confirmando..." : "Confirmar Aceite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
