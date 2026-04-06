import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "Endpoint removido. Use /api/admin/planos e /api/admin/uso." }, { status: 410 });
}

export async function POST() {
  return NextResponse.json({ error: "Endpoint removido. Use billing por projeto." }, { status: 410 });
}
