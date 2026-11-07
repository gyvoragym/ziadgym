import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeEgyptianMobile } from "./signup-verifier";
import { egyptianMobileSchema } from "./registration";
import { z } from "zod";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";

const socialRegistrationSchema = z
  .object({
    fullName: z.string().trim().min(1).max(100),
    phone: egyptianMobileSchema,
    accountType: z.enum(["gym", "individual"]),
  })
  .strict();

export const completeOAuthRegistration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => socialRegistrationSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    if (userError || !result.user) throw new Error("Could not verify the signed-in account.");

    const normalizedPhone = normalizeEgyptianMobile(data.phone);
    const { data: existingProfileId, error: profileLookupError } = await supabaseAdmin.rpc(
      "find_gyvora_profile_by_phone",
      { p_phone: normalizedPhone },
    );
    if (profileLookupError)
      throw new Error(
        `Could not check whether this phone is already registered: ${profileLookupError.message}`,
      );
    if (existingProfileId && existingProfileId !== context.userId)
      throw new Error("This phone number already has an account.");

    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        account_type: data.accountType === "gym" ? "owner" : "client",
        full_name: data.fullName,
        email: result.user.email ?? "",
        phone: normalizedPhone,
      })
      .eq("id", context.userId);
    if (error)
      throw new Error(
        `Your account is signed in, but its profile could not be completed: ${error.message}`,
      );
    return true;
  });

const phonePasswordSchema = z
  .object({
    phone: egyptianMobileSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export const signInWithPhonePassword = createServerFn({ method: "POST" })
  .inputValidator((input) => phonePasswordSchema.parse(input))
  .handler(async ({ data }) => {
    const request = getRequest();
    const realIp = request.headers.get("x-real-ip")?.trim();
    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = realIp || forwardedFor || "unknown";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: allowed, error: rateLimitError } = await supabaseAdmin.rpc(
      "consume_gyvora_phone_login_attempt",
      { p_phone: data.phone, p_ip: ip },
    );
    if (rateLimitError) {
      console.error("[Auth] Phone sign-in rate limiter failed:", rateLimitError.message);
      throw new Error("Phone sign-in is temporarily unavailable. Contact support.");
    }
    if (!allowed) {
      throw new Error("Sign-in failed. Check your phone number and password.");
    }

    const { data: userId, error: profileError } = await supabaseAdmin.rpc(
      "find_gyvora_profile_by_phone",
      { p_phone: data.phone },
    );
    if (profileError || !userId) {
      throw new Error("Sign-in failed. Check your phone number and password.");
    }

    const { data: userResult, error: userError } =
      await supabaseAdmin.auth.admin.getUserById(userId);
    const email = userResult.user?.email;
    if (userError || !email) {
      throw new Error("Sign-in failed. Check your phone number and password.");
    }

    const url = process.env["SUPABASE_URL"];
    const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !publishableKey) {
      throw new Error("Phone sign-in is not configured. Contact support.");
    }

    const authClient = createClient(url, publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const { data: authResult, error: authError } = await authClient.auth.signInWithPassword({
      email,
      password: data.password,
    });
    if (authError || !authResult.session) {
      throw new Error("Sign-in failed. Check your phone number and password.");
    }

    return {
      session: {
        access_token: authResult.session.access_token,
        refresh_token: authResult.session.refresh_token,
      },
    };
  });
