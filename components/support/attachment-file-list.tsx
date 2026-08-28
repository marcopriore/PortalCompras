import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatLocalFileSize } from "@/lib/axisdesk/support-form"

type AttachmentFileListProps = {
  files: File[]
  onRemove: (index: number) => void
  disabled?: boolean
}

export function AttachmentFileList({
  files,
  onRemove,
  disabled = false,
}: AttachmentFileListProps) {
  if (files.length === 0) return null

  return (
    <ul className="space-y-2">
      {files.map((file, index) => (
        <li
          key={`${file.name}-${file.size}-${file.lastModified}`}
          className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-foreground">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatLocalFileSize(file.size)}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => onRemove(index)}
            disabled={disabled}
            aria-label={`Remover ${file.name}`}
          >
            <X className="h-4 w-4" />
          </Button>
        </li>
      ))}
    </ul>
  )
}
