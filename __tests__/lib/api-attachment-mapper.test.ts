import { describe, expect, it } from "vitest"
import {
  isAllowedAttachmentFile,
  mapAttachmentToApi,
  sanitizeAttachmentFileName,
} from "@/lib/api/external/attachment-service"

describe("isAllowedAttachmentFile", () => {
  it("aceita PDF pelo content-type", () => {
    expect(isAllowedAttachmentFile("doc.bin", "application/pdf")).toBe(true)
  })

  it("aceita Excel e imagem pela extensão", () => {
    expect(isAllowedAttachmentFile("planilha.xlsx", "")).toBe(true)
    expect(isAllowedAttachmentFile("foto.JPEG", null)).toBe(true)
  })

  it("rejeita tipo não permitido", () => {
    expect(isAllowedAttachmentFile("malware.exe", "application/x-msdownload")).toBe(
      false,
    )
  })
})

describe("sanitizeAttachmentFileName", () => {
  it("substitui caracteres especiais e limita tamanho", () => {
    expect(sanitizeAttachmentFileName("NF 123/2026.pdf")).toBe("NF_123_2026.pdf")
    expect(sanitizeAttachmentFileName("")).toBe("anexo")
  })
})

describe("mapAttachmentToApi", () => {
  it("omite file_path e inclui download_url", () => {
    const mapped = mapAttachmentToApi(
      {
        id: "att-1",
        file_name: "nf.pdf",
        file_size: 1024,
        content_type: "application/pdf",
        created_at: "2026-01-01T00:00:00Z",
      },
      "https://signed.example/nf.pdf",
    )
    expect(mapped).toEqual({
      id: "att-1",
      file_name: "nf.pdf",
      file_size: 1024,
      content_type: "application/pdf",
      created_at: "2026-01-01T00:00:00Z",
      download_url: "https://signed.example/nf.pdf",
    })
    expect(mapped).not.toHaveProperty("file_path")
  })
})
