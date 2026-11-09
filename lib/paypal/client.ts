import {
  Client,
  Environment,
  LogLevel,
  TransactionSearchController,
} from "@paypal/paypal-server-sdk";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name} (see .env.example)`);
  return v;
}

let client: Client | undefined;

/** Shared PayPal Server SDK client. Sandbox unless PAYPAL_ENVIRONMENT=PRODUCTION. */
export function getPayPalClient(): Client {
  if (!client) {
    client = new Client({
      clientCredentialsAuthCredentials: {
        oAuthClientId: requireEnv("PAYPAL_CLIENT_ID"),
        oAuthClientSecret: requireEnv("PAYPAL_CLIENT_SECRET"),
      },
      environment:
        process.env.PAYPAL_ENVIRONMENT === "PRODUCTION"
          ? Environment.Production
          : Environment.Sandbox,
      logging: { logLevel: LogLevel.Warn },
    });
  }
  return client;
}

export function getTransactionSearch(): TransactionSearchController {
  return new TransactionSearchController(getPayPalClient());
}
