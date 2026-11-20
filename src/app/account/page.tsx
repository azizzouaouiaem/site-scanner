import Account from "@/components/Account";
import { user } from "@/lib/commerce/auth";
import { readiness, testPayments } from "@/lib/commerce/billing";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Mon espace — Site Scanner",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function AccountPage() {
  const current = await user().catch(() => null);
  return (
    <Account
      authenticated={!!current}
      testMode={testPayments()}
      siteReady={readiness("site")}
      pdfReady={readiness("pdf")}
    />
  );
}
