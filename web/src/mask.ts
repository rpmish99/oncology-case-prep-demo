export type Identifiers = { name: string; mrn: string; dob: string };

/** Same masking the record server applies before the agents see anything. Kept in step with mcp-server/src/server.ts. */
export function maskCode(ids: Identifiers): string {
  let h = 0x811c9dc5;
  for (const ch of ids.mrn) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return `P-${h.toString(16).toUpperCase().padStart(8, "0").slice(0, 4)}`;
}

export function maskText(text: string, ids: Identifiers): string {
  const code = maskCode(ids);
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = ids.name.split(" ").filter(Boolean);
  return text
    .replace(new RegExp(esc(ids.name), "gi"), code)
    .replace(new RegExp(esc(ids.mrn), "g"), "[MRN masked]")
    .replace(new RegExp(esc(ids.dob), "g"), "[DOB masked]")
    .replace(new RegExp(`\\b(${parts.map(esc).join("|")})\\b`, "g"), code);
}
