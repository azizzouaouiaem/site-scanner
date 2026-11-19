import { Resend } from "resend";
export const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
export async function mail(
  to: string,
  subject: string,
  html: string,
  idempotencyKey?: string,
) {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM_EMAIL)
    throw new Error("email_not_configured");
  const result = await new Resend(process.env.RESEND_API_KEY).emails.send(
    { from: process.env.RESEND_FROM_EMAIL, to, subject, html },
    idempotencyKey ? { idempotencyKey } : undefined,
  );
  if (result.error) throw new Error("email_send_failed");
}
