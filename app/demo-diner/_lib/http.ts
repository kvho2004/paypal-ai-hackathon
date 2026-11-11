// Helpers for the plain-HTML form handlers under /demo-diner/auth.
import { NextResponse } from "next/server";

/** 303 redirect after a form POST. Relative Location: behind Render's proxy or a tunnel, req.url can name the internal host. */
export function seeOther(path: string): NextResponse {
  return new NextResponse(null, { status: 303, headers: { Location: path } });
}

/** A text field from a submitted form, or "" if it's missing. */
export const formText = (form: FormData, name: string) => String(form.get(name) ?? "");
