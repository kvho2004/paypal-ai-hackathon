import { seeOther } from "../../_lib/http";
import { signOut } from "../../_lib/session";

export function POST() {
  return signOut(seeOther("/demo-diner/login?signed_out=1"));
}
