/**
 * Guard against regular expressions that backtrack catastrophically.
 *
 * A REGEX naming field is written by a project member and then run against
 * names that arrive from outside — pasted in the browser, or sent by the
 * thousand through `/api/v1`. JavaScript's engine backtracks, so a pattern
 * such as `([A-Z]+ ?)+` takes exponential time on a near-miss like
 * `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA!` and blocks the whole server while it runs.
 *
 * This is a conservative structural check, not a proof: it refuses the shapes
 * that cause the blow-up — a repeated group that itself contains a variable
 * repetition or an alternation — and caps how many wide repetitions a pattern
 * may chain, which bounds the polynomial cases. Naming fields are single
 * segments, so real patterns (`[A-Z]{2,6}`, `\d{3}(-[A-Z])?`) pass untouched.
 */

/** A repetition wider than this counts as open-ended for the chaining limit. */
const WIDE_SPAN = 20
/** At most this many open-ended repetitions in one pattern. */
export const MAX_WIDE_QUANTIFIERS = 3

export type RegexSafetyProblem = 'NESTED_REPETITION' | 'TOO_MANY_REPETITIONS' | 'BACKREFERENCE'

interface Frame {
  /** Contains a repetition whose count can vary (`*`, `+`, `?`, `{m,n}`). */
  variable: boolean
  /** Contains an alternation `|` at any depth. */
  alternation: boolean
}

interface Atom {
  group: Frame | null
}

/** Parse `{m}`, `{m,}` or `{m,n}` at `index`; null when it is not a quantifier. */
function braces(pattern: string, index: number): { min: number; max: number; end: number } | null {
  const match = /^\{(\d+)(,(\d*))?\}/u.exec(pattern.slice(index))
  if (!match) return null
  const min = Number(match[1])
  const max = match[2] === undefined ? min : match[3] === '' ? Number.POSITIVE_INFINITY : Number(match[3])
  return { min, max, end: index + match[0].length }
}

/**
 * Returns the first problem found in `pattern`, or null when it is safe to run
 * against untrusted input. Assumes the pattern already compiles with the `u`
 * flag.
 */
export function regexSafetyProblem(pattern: string): RegexSafetyProblem | null {
  const stack: Frame[] = [{ variable: false, alternation: false }]
  let previous: Atom | null = null
  let wide = 0

  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i]!
    const frame = stack[stack.length - 1]!

    // --- quantifiers apply to the atom just read ------------------------------
    let quantifier: { min: number; max: number; end: number } | null = null
    if (char === '*') quantifier = { min: 0, max: Number.POSITIVE_INFINITY, end: i + 1 }
    else if (char === '+') quantifier = { min: 1, max: Number.POSITIVE_INFINITY, end: i + 1 }
    else if (char === '?') quantifier = { min: 0, max: 1, end: i + 1 }
    else if (char === '{') quantifier = braces(pattern, i)

    if (quantifier) {
      const { min, max } = quantifier
      if (previous?.group && max > 1 && (previous.group.variable || previous.group.alternation)) {
        return 'NESTED_REPETITION'
      }
      if (min !== max) frame.variable = true
      if (max - min > WIDE_SPAN) {
        wide += 1
        if (wide > MAX_WIDE_QUANTIFIERS) return 'TOO_MANY_REPETITIONS'
      }
      i = quantifier.end - 1
      if (pattern[i + 1] === '?') i += 1 // lazy form
      previous = null
      continue
    }

    switch (char) {
      case '\\': {
        const next = pattern[i + 1] ?? ''
        if (/[1-9]/u.test(next) || (next === 'k' && pattern[i + 2] === '<')) return 'BACKREFERENCE'
        if ((next === 'u' || next === 'p' || next === 'P') && pattern[i + 2] === '{') {
          i = pattern.indexOf('}', i + 2)
          if (i === -1) i = pattern.length
        } else {
          i += 1
        }
        previous = { group: null }
        break
      }
      case '[': {
        // A class is one atom; skip to its closing bracket.
        let j = i + 1
        if (pattern[j] === '^') j += 1
        while (j < pattern.length && pattern[j] !== ']') j += pattern[j] === '\\' ? 2 : 1
        i = j
        previous = { group: null }
        break
      }
      case '(': {
        // Skip the group's own syntax: (?: (?= (?! (?<= (?<! (?<name>
        if (pattern[i + 1] === '?') {
          if (pattern[i + 2] === '<' && pattern[i + 3] !== '=' && pattern[i + 3] !== '!') {
            i = pattern.indexOf('>', i)
          } else {
            i += pattern[i + 2] === '<' ? 3 : 2
          }
        }
        stack.push({ variable: false, alternation: false })
        previous = null
        break
      }
      case ')': {
        const closed = stack.length > 1 ? stack.pop()! : frame
        const parent = stack[stack.length - 1]!
        parent.variable ||= closed.variable
        parent.alternation ||= closed.alternation
        previous = { group: closed }
        break
      }
      case '|':
        frame.alternation = true
        previous = null
        break
      case '^':
      case '$':
        previous = null
        break
      default:
        previous = { group: null }
    }
  }

  return null
}
