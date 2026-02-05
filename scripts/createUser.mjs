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
const email = typeof args.email === 'string' ? args.email.trim().toLowerCase() : ''
const password = typeof args.password === 'string' ? args.password : ''
const roleArg = typeof args.role === 'string' ? args.role : null
const primaryAdmin = args.primary === 'true' || args.primary === true

const serviceAccountPath =
  typeof args.serviceAccount === 'string' ? path.resolve(process.cwd(), args.serviceAccount) : null

if (!email || !password) {
  console.error(
    'Usage: npm run create-user -- --email=user@example.com --password=PASSWORD [--role=admin|manager|staff] [--primary=true] [--serviceAccount=path]',
  )
  process.exit(1)
}

const allowedRoles = new Set(['admin', 'manager', 'staff'])
const role = roleArg && allowedRoles.has(roleArg) ? roleArg : 'staff'

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

const user = await auth.createUser({ email, password, emailVerified: false, disabled: false })

const mergedClaims = { role, primaryAdmin: primaryAdmin ? true : undefined }
if (!mergedClaims.primaryAdmin) delete mergedClaims.primaryAdmin

await auth.setCustomUserClaims(user.uid, mergedClaims)

console.log(`Created user email=${email} uid=${user.uid}`)
console.log(`Set claims: role=${role}${primaryAdmin ? ' primaryAdmin=true' : ''}`)
console.log('Note: user must login to receive updated claims.')

