import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET ?token=...  -> validate + return who it's for
export async function GET(req) {
  const token = new URL(req.url).searchParams.get("token") || "";
  if (!token) return NextResponse.json({ valid: false });
  const user = await prisma.user.findUnique({ where: { inviteToken: token }, include: { tenant: true } });
  if (!user || !user.inviteExpires || user.inviteExpires < new Date()) return NextResponse.json({ valid: false });
  return NextResponse.json({ valid: true, email: user.email, cafe: user.tenant?.name || "your café" });
}

// POST { token, password } -> set password, consume token
export async function POST(req) {
  let b;
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const token = String(b.token || "");
  const password = String(b.password || "");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });
  if (password.length < 6) return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { inviteToken: token } });
  if (!user || !user.inviteExpires || user.inviteExpires < new Date()) {
    return NextResponse.json({ error: "This invite link is invalid or has expired." }, { status: 400 });
  }
  const hash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { id: user.id }, data: { password: hash, inviteToken: null, inviteExpires: null } });
  return NextResponse.json({ ok: true, email: user.email });
}
