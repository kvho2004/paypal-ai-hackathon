import Nav from "../components/Nav";
import { getCurrentUser } from "../../lib/auth/server";

// Krumms' own pages get the nav and page frame. Demo Diner (app/demo-diner) sits outside this route group, so it
// renders as a separate restaurant site with no Krumms UI around it. Route groups don't change URLs.
// Middleware has already required a signed-in student, so the user here is only for the nav.
export default async function KrummsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <>
      <Nav userName={user?.name} />
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </>
  );
}
