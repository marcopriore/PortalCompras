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
import { ScrollArea } from "@/components/ui/scroll-area"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { FileText } from "lucide-react"

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
  loading?: boolean
  saving?: boolean
  onAccept: () => void
  onCancel: () => void
}

export function TermsAcceptanceDialog({
  open,
  term,
  loading,
  saving,
  onAccept,
  onCancel,
}: Props) {
  const [accepted, setAccepted] = React.useState(false)

  React.useEffect(() => {
    if (open) setAccepted(false)
  }, [open])

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel()
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <DialogTitle>
              {loading ? "Carregando termos..." : term?.title ?? "Termos e Condições"}
            </DialogTitle>
          </div>
          {term ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Versão {term.version} —{" "}
              {new Date(term.version_date).toLocaleDateString("pt-BR", {
                timeZone: "UTC",
              })}
            </p>
          ) : null}
        </DialogHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </div>
        ) : term ? (
          <>
            <ScrollArea className="max-h-96 flex-1 rounded-lg border border-border p-4">
              <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {term.content}
              </div>
            </ScrollArea>

            <div className="mt-2 flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
              <Checkbox
                id="accept-terms"
                checked={accepted}
                onCheckedChange={(v) => setAccepted(Boolean(v))}
              />
              <Label htmlFor="accept-terms" className="cursor-pointer text-sm leading-relaxed">
                Li e concordo com os <span className="font-semibold">{term.title}</span> versão{" "}
                {term.version}. Entendo que ao aceitar este pedido estou vinculado às condições
                descritas acima.
              </Label>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              Nenhum termo configurado. Prossiga com o aceite.
            </p>
          </div>
        )}

        <DialogFooter className="mt-2">
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
