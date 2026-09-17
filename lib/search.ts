// Builds a LIKE pattern that matches the input literally: the user's own
// %, _, and \ are escaped so they can't act as wildcards.
export function toLikePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}
