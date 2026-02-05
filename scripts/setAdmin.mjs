import { readFile } from 'node:fs/promises'
import path from 'node:path'

function parseArgs(argv) {
  const out = {}
  for (const part of argv) {
    if (!part.startsWith('--')) continue
    const [k, ...rest] = part.slice(2).split('=')
    out[k] = rest.length ? rest.join('=') : true
  }
  return out
}

const args = parseArgs(process.argv.slice(2))

const email = typeof args.email === 'string' ? args.email : null
const uid = typeof args.uid === 'string' ? args.uid : null
const roleArg = typeof args.role === 'string' ? args.role : null
const admin = args.admin === 'false' ? false : true
const primaryAdmin = args.primary === 'true' || args.primary === true

const serviceAccountPath =
  typeof args.serviceAccount === 'string' ? path.resolve(process.cwd(), args.serviceAccount) : null

if (!email && !uid) {
  console.error(
    'Usage: npm run set-admin -- --email=user@example.com [--role=admin|manager|staff] [--primary=true|false] [--serviceAccount=path]',
  )
  console.error(
    '   or: npm run set-admin -- --uid=UID [--role=admin|manager|staff] [--primary=true|false] [--serviceAccount=path]',
  )
  console.error('Back-compat: --admin=true|false maps to role=admin|staff')
  process.exit(1)
}

const { initializeApp, applicationDefault, cert } = await import('firebase-admin/app')
const { getAuth } = await import('firebase-admin/auth')

let credential
if (serviceAccountPath) {
  const json = JSON.parse(await readFile(serviceAccountPath, 'utf8'))
  credential = cert(json)
} else {
  credential = applicationDefault()
}

initializeApp({ credential })
const auth = getAuth()

let targetUid = uid
if (!targetUid) {
  const user = await auth.getUserByEmail(email)
  targetUid = user.uid
}

const allowedRoles = new Set(['admin', 'manager', 'staff'])
const role =
  roleArg && allowedRoles.has(roleArg) ? roleArg : admin ? 'admin' : 'staff'

const existing = await auth.getUser(targetUid)
const mergedClaims = { ...(existing.customClaims ?? {}), role }
delete mergedClaims.admin
if (primaryAdmin) mergedClaims.primaryAdmin = true
if (args.primary === 'false') delete mergedClaims.primaryAdmin

await auth.setCustomUserClaims(targetUid, mergedClaims)
console.log(`Set role=${role} for uid=${targetUid}`)
console.log(primaryAdmin ? 'Set primaryAdmin=true' : args.primary === 'false' ? 'Set primaryAdmin=false' : '')
console.log('Note: user must re-login or refresh ID token to receive updated claims.')
