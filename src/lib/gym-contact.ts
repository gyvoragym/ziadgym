export function gymContactUrl(kind: "whatsapp" | "social", value: string) {
  const contact = value.trim();
  if (!contact) return "";
  if (/^https?:\/\//i.test(contact)) {
    try {
      const url = new URL(contact);
      return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? url.toString() : "";
    } catch {
      return "";
    }
  }
  if (kind === "whatsapp") {
    const digits = contact.replace(/\D/g, "");
    return digits ? `https://wa.me/${digits}` : "";
  }
  try {
    const url = new URL(`https://${contact.replace(/^\/+/, "")}`);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : "";
  } catch {
    return "";
  }
}
