export type AdminLoginCredentials = {
  name?: string;
  email: string;
  phone: string;
  password: string;
};

export type AdminLoginConfiguration = Omit<AdminLoginCredentials, "name"> & { name?: string };

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0020")) return digits.slice(2);
  if (digits.startsWith("20")) return digits;
  if (digits.startsWith("0")) return `20${digits.slice(1)}`;
  return digits;
}

export function matchesAdminContactLogin(
  contact: string,
  password: string,
  configuration: AdminLoginConfiguration | undefined,
) {
  if (
    !configuration ||
    !configuration.email.trim() ||
    !configuration.phone.trim() ||
    !configuration.password.trim()
  )
    return false;
  const value = contact.trim();
  const matchesEmail = value.toLowerCase() === configuration.email.trim().toLowerCase();
  const matchesPhone = normalizePhone(value) === normalizePhone(configuration.phone);
  return (matchesEmail || matchesPhone) && password === configuration.password;
}

export function matchesAnyAdminContactLogin(
  contacts: string[],
  password: string,
  configuration: AdminLoginConfiguration | undefined,
) {
  return contacts.some((contact) => matchesAdminContactLogin(contact, password, configuration));
}

export function matchesAdminLogin(
  credentials: AdminLoginCredentials,
  configuration: AdminLoginConfiguration | undefined,
) {
  if (
    !configuration ||
    [configuration.email, configuration.phone, configuration.password].some((value) => !value.trim())
  ) return false;
  return (
    (!configuration.name?.trim() || credentials.name?.trim().toLowerCase() === configuration.name.trim().toLowerCase()) &&
    credentials.email.trim().toLowerCase() === configuration.email.trim().toLowerCase() &&
    normalizePhone(credentials.phone) === normalizePhone(configuration.phone) &&
    credentials.password === configuration.password
  );
}
