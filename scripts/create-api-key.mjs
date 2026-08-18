/**
 * Gera uma API key de teste/homologação.
 *
 * Uso (na raiz do projeto, com .env.local configurado):
 *   node scripts/create-api-key.mjs
 *   node scripts/create-api-key.mjs --name "ERP Homologação"
 *
 * A chave completa (valore_...) é exibida UMA vez — copie e guarde.
 */

import { createHash, randomBytes } from "crypto"
import { createClient } from "@supabase/supabase-js"
import { config } from "dotenv"
import { resolve } from "path"

config({ path: resolve(process.cwd(), ".env.local") })

const COMPANY_ID = "00000000-0000-0000-0000-000000000001"

const ALL_SCOPES = [
  "items:read",
  "items:write",
  "suppliers:read",
  "suppliers:write",
  "requisitions:read",
  "requisitions:write",
  "quotations:read",
  "orders:read",
]

function hashApiKey(rawKey) {
  const pepper = process.env.API_KEY_PEPPER ?? ""
  return createHash("sha256").update(`${pepper}:${rawKey}`).digest("hex")
}

function generateApiKey() {
  const rawKey = `valore_${randomBytes(32).toString("base64url")}`
  return {
    rawKey,
    keyPrefix: rawKey.slice(0, 12),
    keyHash: hashApiKey(rawKey),
  }
}

function parseNameArg() {
  const idx = process.argv.indexOf("--name")
  if (idx === -1) return "Chave de desenvolvimento"
  return process.argv[idx + 1] ?? "Chave de desenvolvimento"
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    console.error(
      "Erro: defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em .env.local",
    )
    process.exit(1)
  }

  const name = parseNameArg()
  const { rawKey, keyPrefix, keyHash } = generateApiKey()

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      company_id: COMPANY_ID,
      name,
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes: ALL_SCOPES,
      active: true,
    })
    .select("id")
    .single()

  if (error) {
    console.error("Erro ao gravar api_keys:", error.message)
    process.exit(1)
  }

  console.log("")
  console.log("API key criada com sucesso")
  console.log("  id:        ", data.id)
  console.log("  company:   ", COMPANY_ID)
  console.log("  name:      ", name)
  console.log("  prefix:    ", keyPrefix)
  console.log("")
  console.log("COPIE AGORA (não é recuperável):")
  console.log("")
  console.log("  ", rawKey)
  console.log("")
  console.log("Teste:")
  console.log(
    `  curl -H "Authorization: Bearer ${rawKey}" http://localhost:3000/api/v1/health`,
  )
  console.log("")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
