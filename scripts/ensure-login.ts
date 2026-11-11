// Shared by the test scripts: makes sure a Kernel profile is logged in to a site, asking the user to log in if not.
import { createConnection, startLogin, waitForLogin } from "../lib/rewards/kernel";
import type { RewardsAdapter } from "../lib/rewards/types";

/**
 * Returns the Kernel auth connection id for this profile and site, logged in.
 * force: log in again even if Kernel thinks the profile is logged in (a site can expire it without Kernel noticing).
 */
export async function ensureLogin(profile: string, adapter: RewardsAdapter, { force = false } = {}): Promise<string> {
  const conn = await createConnection({
    profile,
    domain: adapter.domain,
    loginUrl: adapter.balanceUrl, // start the login from the balance page, so the session ends up there
    saveCredentials: false,
  });
  if (!force && conn.status === "ACTIVE") return conn.authId;

  console.log(`\nOpen this link and log in to ${adapter.programId}:\n\n  ${await startLogin(conn.authId)}\n`);
  const result = await waitForLogin(conn.authId, {
    onChange: (s) => console.log(`  ${s.flowStatus} / ${s.flowStep}${s.error ? `: ${s.error}` : ""}`),
  });
  if (result.status !== "ACTIVE") throw new Error(`Login failed: ${result.errorCode ?? ""} ${result.error ?? ""}`);
  return conn.authId;
}
