import { z } from "zod";
import { normalizeEgyptianMobile } from "./signup-verifier";
export const egyptianMobileSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .max(30)
  .refine((value) => {
    try {
      normalizeEgyptianMobile(value);
      return true;
    } catch {
      return false;
    }
  }, "Use an Egyptian mobile number starting with 010, 011, 012 or 015")
  .transform((value) => normalizeEgyptianMobile(value));
export const registrationSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "Enter your full name")
    .max(100, "Your name must be 100 characters or fewer"),
  phone: egyptianMobileSchema,
  email: z
    .string()
    .trim()
    .min(1, "Gmail address is required")
    .email("Enter a valid Gmail address")
    .max(255, "Email is too long")
    .transform((value) => value.toLowerCase())
    .refine(
      (value) => value.endsWith("@gmail.com") || value.endsWith("@googlemail.com"),
      "Use a Gmail address ending in @gmail.com",
    ),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be 128 characters or fewer"),
  account_type: z.enum(["gym", "individual"]),
});
