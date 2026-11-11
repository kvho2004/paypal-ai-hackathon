import Nav from "../components/Nav";

// Krumms' own pages get the nav and page frame. Demo Diner (app/demo-diner) sits outside this route group, so it
// renders as a separate restaurant site with no Krumms UI around it. Route groups don't change URLs.
export default function KrummsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </>
  );
}
