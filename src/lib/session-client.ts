import type { Member } from "./store";

/** Only resolve against the current gym's authorized, already-loaded members. */
export function findSessionClient(members: Member[], value: string): Member | undefined {
  const input = value.trim();
  if (!input || (input.includes(":") && !input.startsWith("ironhaus:member:"))) return undefined;
  const id = input.replace(/^ironhaus:member:/, "");
  if (!id || id.includes(":")) return undefined;
  return members.find((m) => m.id === id || m.memberQrId === id || m.gyvoraId === id);
}
