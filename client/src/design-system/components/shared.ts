export { cx } from '../primitives/shared'

export function mergeIds(...ids: Array<string | false | null | undefined>) {
  return ids.filter(Boolean).join(' ') || undefined
}
