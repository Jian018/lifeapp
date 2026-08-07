import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminFromRequest } from "@/lib/admin-session";

export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const session = adminFromRequest(request);
  return NextResponse.json(session ? { authorized: true, expiresAt: session.exp * 1000, remainingSeconds: Math.max(0, session.exp - Math.floor(Date.now() / 1000)) } : { authorized: false, expiresAt: null, remainingSeconds: 0 });
}

export async function DELETE() {
  const response = NextResponse.json({ authorized: false });
  response.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", maxAge: 0, path: "/" });
  return response;
}
