import type { NextRequest } from "next/server";
import { formText, seeOther } from "../../_lib/http";
import { signIn } from "../../_lib/session";
import { createAccount } from "../../_lib/store";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  if (form.get("terms") !== "on") return seeOther("/demo-diner/join?error=terms");

  const result = createAccount({
    name: formText(form, "name"),
    email: formText(form, "email"),
    password: formText(form, "password"),
  });
  if (!result.ok) return seeOther(`/demo-diner/join?error=${result.error}`);

  // New members are signed in straight away, like most real sign-up flows.
  return signIn(seeOther("/demo-diner/rewards?welcome=1"), req, result.account.email);
}

export function GET() {
  return seeOther("/demo-diner/join");
}
