// Shared by save-demo-diner-fixture.ts (writes the fixture) and test-extract.ts (checks it), so they agree on both.
import { DEMO_ACCOUNTS } from "../app/demo-diner/_lib/data";

export const FIXTURE_PATH = "fixtures/demo-diner-rewards.txt";

/** The Demo Diner account the fixture is saved as, and whose data test-extract.ts expects. */
export const FIXTURE_ACCOUNT = DEMO_ACCOUNTS.find((a) => a.email === "alex@demodiner.test")!;
