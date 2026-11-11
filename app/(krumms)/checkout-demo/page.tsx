import { Card, PageHeader } from "../../components/ui";
import CheckoutDemo from "./CheckoutDemo";

// Read the client id at request time so it is never baked in at build time.
export const dynamic = "force-dynamic";

export default function CheckoutDemoPage() {
  const clientId = process.env.PAYPAL_MERCHANT_CLIENT_ID;

  return (
    <section>
      <PageHeader
        title="Pay at Demo Diner"
        subtitle="Checkout with PayPal. A completed payment is saved to your purchases."
      />
      {clientId ? (
        <CheckoutDemo clientId={clientId} />
      ) : (
        <Card>
          <p className="text-sm text-danger">Checkout is not configured: PAYPAL_MERCHANT_CLIENT_ID is missing.</p>
        </Card>
      )}
    </section>
  );
}
