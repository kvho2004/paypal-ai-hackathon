import { requireUser } from "../../../lib/auth/server";
import { getRewardRows } from "../../../lib/views/rewards";
import { PageHeader } from "../../components/ui";
import Preview from "./Preview";

// Scratch page for the chat components, so they can be tried before the agent exists. Safe to delete later.
export const dynamic = "force-dynamic";

export default async function PreviewPage() {
  const user = await requireUser();
  const rewardRows = await getRewardRows(user.id);
  return (
    <section>
      <PageHeader
        title="Component preview"
        subtitle="Sample data in the agent's format. Approving an order here makes a real sandbox payment."
      />
      <Preview clientId={process.env.PAYPAL_MERCHANT_CLIENT_ID ?? null} rewardRows={rewardRows} />
    </section>
  );
}
