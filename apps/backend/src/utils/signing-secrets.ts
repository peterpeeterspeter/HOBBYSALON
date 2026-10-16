type SigningSecretEnvironment = Readonly<Record<string, string | undefined>>

type SigningSecrets = {
  jwtSecret: string
  cookieSecret: string
}

const DEVELOPMENT_SECRET = 'supersecret'
const MINIMUM_SECRET_BYTES = 32

/**
 * Resolve only after loadEnv. Defaults are limited to development/test (including
 * an unspecified NODE_ENV, which Medusa loads as development). CI never exempts
 * production. Length and obvious-placeholder checks do not prove entropy: use
 * independently generated cryptographically random production keys.
 */
export function resolveSigningSecrets(
  env: SigningSecretEnvironment
): SigningSecrets {
  const mode = env.NODE_ENV || 'development'
  if (mode === 'development' || mode === 'test') {
    return {
      jwtSecret: env.JWT_SECRET || DEVELOPMENT_SECRET,
      cookieSecret: env.COOKIE_SECRET || DEVELOPMENT_SECRET
    }
  }

  const requireSecret = (name: 'JWT_SECRET' | 'COOKIE_SECRET'): string => {
    const value = env[name]
    // Never include supplied key values in diagnostics (even placeholders).
    if (!value || !value.trim()) {
      throw new Error(`${name} must be configured for signing outside development/test.`)
    }
    if (/\s/u.test(value)) {
      throw new Error(`${name} must not contain whitespace.`)
    }
    const normalized = value.toLowerCase().replace(/[-_]/g, '')
    if (
      ['supersecret', 'changeme', 'replaceme', 'defaultsecret',
        'yourjwtsecret', 'yourcookiesecret', 'insecuresecret'].some(
        (placeholder) => normalized.includes(placeholder)
      ) || /^(.{1,4})\1+$/u.test(value)
    ) {
      throw new Error(`${name} must not use a default, placeholder, or trivially repeated value.`)
    }
    if (Buffer.byteLength(value, 'utf8') < MINIMUM_SECRET_BYTES) {
      throw new Error(`${name} must contain at least ${MINIMUM_SECRET_BYTES} UTF-8 bytes.`)
    }
    return value
  }

  const jwtSecret = requireSecret('JWT_SECRET')
  const cookieSecret = requireSecret('COOKIE_SECRET')
  if (jwtSecret === cookieSecret) {
    throw new Error('JWT_SECRET and COOKIE_SECRET must be different, independently generated signing keys.')
  }
  return { jwtSecret, cookieSecret }
}
