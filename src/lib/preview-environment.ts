/** Preview behavior is not authentication and never grants Cloud privileges. */
export function isPreviewHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  const ipv4 = host.split(".");
  if (
    ipv4.length === 4 &&
    ipv4.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255)
  ) {
    const [first, second] = ipv4.map(Number);
    if (
      first === 10 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    ) return true;
  }
  const staticSuffix = ['.lovable.app', '.gpt-eng.com', '.gptengineer.run'].some(suffix => host.endsWith(suffix));
  const firstLabel = host.split('.')[0] ?? '';
  if (staticSuffix && /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(firstLabel)) return true;
  if (staticSuffix && /^project--[a-z0-9-]+-dev$/.test(firstLabel)) return true;
  return host.endsWith('.lovableproject.com') || host.endsWith('.lovableproject-dev.com');
}

export function prototypePreviewEnabled() {
  return import.meta.env.DEV || (typeof window !== 'undefined' && isPreviewHost(window.location.hostname));
}