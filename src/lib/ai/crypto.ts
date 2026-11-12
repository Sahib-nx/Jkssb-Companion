import crypto from 'crypto'

/**
 * Derives a 32-byte (256-bit) Buffer from the AI_CREDENTIALS_ENCRYPTION_KEY environment variable.
 * Fails securely if the key is missing or invalid.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.AI_CREDENTIALS_ENCRYPTION_KEY
  if (!secret) {
    throw new Error(
      'Server configuration error: AI_CREDENTIALS_ENCRYPTION_KEY is missing from environment variables. Please configure this key in your Vercel project settings to securely store user API credentials.'
    )
  }

  const trimmed = secret.trim()

  // 1. If 64-character hex string (32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return Buffer.from(trimmed, 'hex')
  }

  // 2. If 44-character base64 string (32 bytes)
  if (trimmed.length === 44 && trimmed.endsWith('=')) {
    try {
      const buf = Buffer.from(trimmed, 'base64')
      if (buf.length === 32) return buf
    } catch {
      // Fall through to hash
    }
  }

  // 3. Fallback: derive 32-byte key via SHA-256 hash of provided secret
  return crypto.createHash('sha256').update(trimmed).digest()
}

export interface EncryptedPayload {
  encryptedKey: string
  iv: string
  authTag: string
  version: string
  keyHint: string
}

/**
 * Generates a safe key mask hint without exposing secret payload (e.g., "AIzaSy...4xQ")
 */
export function generateKeyHint(apiKey: string): string {
  const trimmed = (apiKey || '').trim()
  if (trimmed.length > 10) {
    return `${trimmed.slice(0, 6)}...${trimmed.slice(-3)}`
  }
  return '••••••••'
}

/**
 * Encrypts an API key using AES-256-GCM with a fresh random 12-byte IV for every encryption.
 */
export function encryptApiKey(apiKey: string): EncryptedPayload {
  const trimmed = apiKey.trim()
  if (!trimmed) {
    throw new Error('API key cannot be empty.')
  }

  const key = getEncryptionKey()
  const iv = crypto.randomBytes(12) // 96-bit nonce recommended for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  let encrypted = cipher.update(trimmed, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')

  const keyHint = generateKeyHint(trimmed)

  return {
    encryptedKey: encrypted,
    iv: iv.toString('hex'),
    authTag,
    version: 'v1',
    keyHint,
  }
}

/**
 * Decrypts an AES-256-GCM encrypted API key.
 * Throws if authentication tag verification fails or if payload is tampered with.
 */
export function decryptApiKey({
  encryptedKey,
  iv,
  authTag,
}: {
  encryptedKey: string
  iv: string
  authTag: string
}): string {
  if (!encryptedKey || !iv || !authTag) {
    throw new Error('Missing encryption metadata required for decryption.')
  }

  const key = getEncryptionKey()
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))

  let decrypted = decipher.update(encryptedKey, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
