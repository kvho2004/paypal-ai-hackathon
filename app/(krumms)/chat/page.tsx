import { getPrefs } from "../../../lib/agent/data";
import { requireUser } from "../../../lib/auth/server";
import { PageHeader } from "../../components/ui";
import Chat from "./Chat";

// Server component: it reads the signed-in student's saved preferences (for the chips) and the PayPal client id
// (for ApprovalCard), the same way preview/page.tsx does.
export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await requireUser();
  const prefs = await getPrefs(user.id);
  return (
    <section>
      <PageHeader title="Chat" subtitle="Ask Krumm where to eat and what your points are worth." />
      <Chat clientId={process.env.PAYPAL_MERCHANT_CLIENT_ID ?? null} initialPrefs={prefs} />
    </section>
  );
}
