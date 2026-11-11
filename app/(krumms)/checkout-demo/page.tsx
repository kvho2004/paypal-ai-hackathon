import CheckoutDemo from "./CheckoutDemo";

// Read the client id at request time so it is never baked in at build time.
export const dynamic = "force-dynamic";

export default function CheckoutDemoPage() {
  const clientId = process.env.PAYPAL_MERCHANT_CLIENT_ID;

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Pay at Demo Diner</h1>
      <p className="mt-1 mb-6 text-sm opacity-70">
        Checkout with PayPal. A completed payment is saved to your purchases.
      </p>
      {clientId ? (
        <CheckoutDemo clientId={clientId} />
      ) : (
        <p className="text-sm text-red-600 dark:text-red-400">
          Checkout is not configured: PAYPAL_MERCHANT_CLIENT_ID is missing.
        </p>
      )}
    </section>
  );
}
