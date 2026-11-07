export const isGyvoraId = (value: string): boolean => /^GYVORA-[GC]-(?:00[1-9]|0[1-9][0-9]|[1-9][0-9]{2,})$/.test(value);
export const normalizeAccountLookup = (value: string): string => value.trim().replace(/^ironhaus:member:/, '').replace(/^gyvora:/i, '');
/** Keep an ID-only QR value for contexts where no account profile is available. */
export function accountQrValue(id: string): string {
  if (!isGyvoraId(id)) throw new Error('Permanent GYVORA ID unavailable');
  return id;
}