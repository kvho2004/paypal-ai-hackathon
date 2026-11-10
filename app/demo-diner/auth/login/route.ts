import type { NextRequest } from "next/server";
import { formText, seeOther } from "../../_lib/http";
import { safeNext, signIn } from "../../_lib/session";
import { authenticate } from "../../_lib/store";

// Plain form POST (no client JS), like most real login pages, so Kernel's hosted login can drive it.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const next = safeNext(form.get("next"));
  const account = authenticate(formText(form, "email"), formText(form, "password"));

  if (!account) return seeOther(`/demo-diner/login?error=invalid&next=${encodeURIComponent(next)}`);
  return signIn(seeOther(next), req, account.email);
}

export function GET() {
  return seeOther("/demo-diner/login");
}
