import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { matchesAdminLogin, matchesAnyAdminContactLogin } from "./admin-auth";
import { createAdminSessionToken } from "./admin-session-token";

const credentialsSchema = z
  .object({
    name: z.string().trim().max(100).optional(),
    contact: z.string().trim().min(1).max(255).optional(),
    contacts: z.array(z.string().trim().min(1).max(255)).max(2).optional(),
    email: z.string().trim().email().max(255).optional(),
    phone: z.string().trim().min(1).max(30).optional(),
    password: z.string().min(1).max(128),
  })
  .refine(
    (credentials) =>
      !!credentials.contact?.trim() ||
      !!credentials.contacts?.length ||
      (!!credentials.email?.trim() && !!credentials.phone?.trim()),
    "Enter an administrator contact or both email and phone.",
  );

export const verifyPlatformAdminLogin = createServerFn({ method: "POST" })
  .inputValidator((input) => credentialsSchema.parse(input))
  .handler(async ({ data }) => {
    const name = process.env["GYVORA_ADMIN_NAME"];
    const email = process.env["GYVORA_ADMIN_EMAIL"];
    const phone = process.env["GYVORA_ADMIN_PHONE"];
    const password = process.env["GYVORA_ADMIN_PASSWORD"];
    const configuration = email && phone && password ? { name, email, phone, password } : undefined;
    const contactCandidates = data.contacts ?? (data.contact ? [data.contact] : []);
    const matches = contactCandidates.length
      ? matchesAnyAdminContactLogin(contactCandidates, data.password, configuration)
      : matchesAdminLogin(
          {
            name: data.name,
            email: data.email ?? "",
            phone: data.phone ?? "",
            password: data.password,
          },
          configuration,
        );
    if (!matches) return null;
    return createAdminSessionToken();
  });
