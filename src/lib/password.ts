/** Salted SHA-256 via Web Crypto. Demo-grade only — NOT real security. */
const enc = new TextEncoder()

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', enc.encode(text)))
}

/** Returns `salt:hash`. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = toHex(crypto.getRandomValues(new Uint8Array(16)).buffer)
  return `${salt}:${await sha256(salt + plain)}`
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  return (await sha256(salt + plain)) === hash
}
