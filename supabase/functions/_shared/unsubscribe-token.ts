/**
 * Transactional email sends are rejected by the email provider with
 * {"type":"missing_unsubscribe"} unless an unsubscribe token accompanies the
 * message. Tokens are one-per-email-address and stored in
 * public.email_unsubscribe_tokens.
 *
 * Always call this with a service-role client — the table's RLS only allows
 * service_role reads/writes.
 */
export async function getUnsubscribeToken(admin: any, email: string): Promise<string | undefined> {
  const address = (email || "").trim().toLowerCase();
  if (!address) return undefined;
  try {
    const { data: existing } = await admin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", address)
      .maybeSingle();
    if (existing?.token) return existing.token;

    const token = crypto.randomUUID().replace(/-/g, "");
    const { data: inserted, error } = await admin
      .from("email_unsubscribe_tokens")
      .insert({ email: address, token })
      .select("token")
      .maybeSingle();
    if (!error && inserted?.token) return inserted.token;

    // Lost a race on the unique email constraint — read the winner's token.
    const { data: again } = await admin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", address)
      .maybeSingle();
    return again?.token;
  } catch (e) {
    console.error("Unsubscribe token lookup failed:", e instanceof Error ? e.message : String(e));
    return undefined;
  }
}
