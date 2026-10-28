// Alphabet without look-alike characters (0/O, 1/I/L) so codes survive being read over the phone.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

export type Rng = () => number

export const cryptoRng: Rng = () => {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] / 2 ** 32
}

/** Deterministic PRNG so the demo data looks the same on every reset. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function code(length: number, rng: Rng = cryptoRng) {
  let out = ''
  for (let i = 0; i < length; i++) out += ALPHABET[Math.floor(rng() * ALPHABET.length)]
  return out
}

export const newId = (prefix: string, rng: Rng = cryptoRng) => `${prefix}_${code(10, rng).toLowerCase()}`
export const newReferralCode = (rng: Rng = cryptoRng) => code(8, rng)
export const newBookingRef = (rng: Rng = cryptoRng) => `KP-${code(6, rng)}`
