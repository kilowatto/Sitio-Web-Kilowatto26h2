// The 70B model occasionally drops a single closing bracket when generating a large JSON
// blob (objects and arrays alike) — confirmed live on /comida's translated content. JSON.parse's
// own error position points at the offending character, so inserting the matching closer right
// before it repairs this exact failure mode without guessing blindly. Shared here so every
// static-content translation call gets this resilience instead of failing closed to Spanish.
export function parseJsonWithBracketRepair(text: string): any {
  try {
    return JSON.parse(text);
  } catch (e) {
    const m = /position (\d+)/.exec(String((e as Error)?.message ?? e));
    if (!m) return null;
    const pos = Number(m[1]);
    const opener = text.trimStart()[0];
    const closer = opener === "[" ? "]" : "}";
    try {
      return JSON.parse(text.slice(0, pos) + closer + text.slice(pos));
    } catch {
      return null;
    }
  }
}
