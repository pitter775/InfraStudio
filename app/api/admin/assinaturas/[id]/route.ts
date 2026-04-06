import { NextResponse } from "next/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(_request: Request, _context: RouteContext) {
  return NextResponse.json({ error: "Endpoint removido. Use billing por projeto." }, { status: 410 });
}
