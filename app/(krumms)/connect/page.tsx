import { PageHeader } from "../../components/ui";
import ConnectFlow from "./ConnectFlow";

// The flow calls Dev 2's routes (POST/GET /api/connect/[program], POST /api/rewards/refresh). Until those are
// deployed, pressing Connect shows "not available on this server yet".
export default function ConnectPage() {
  return (
    <section>
      <PageHeader
        title="Connect your rewards"
        subtitle="Link a rewards account once. The agent reads your points and rewards for you."
      />
      <ConnectFlow programId="demo-diner" programName="Demo Diner" />
    </section>
  );
}
