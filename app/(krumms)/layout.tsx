import Nav from "../components/Nav";
import { getCurrentUser } from "../../lib/auth/server";

// Krumms' own pages get the nav and page frame. Demo Diner (app/demo-diner) sits outside this route group, so it
// renders as a separate restaurant site with no Krumms UI around it. Route groups don't change URLs.
// Middleware has already required a signed-in student, so the user here is only for the nav.
// The .krumms wrapper scopes the brand colors (app/globals.css) to these pages.
// On phones the nav is a fixed bottom tab bar, so the page needs room beneath its content.
export default async function KrummsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="krumms">
      <Nav userName={user?.name} />
      <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6 sm:pb-8 sm:pt-8">{children}</main>
    </div>
  );
}
