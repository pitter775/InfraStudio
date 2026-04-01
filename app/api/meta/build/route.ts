import { NextResponse } from "next/server";

function resolveBuildId() {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_BUILD_ID,
    process.env.VERCEL_GIT_COMMIT_SHA,
    process.env.VERCEL_GIT_PREVIOUS_SHA,
  ];

  const value = candidates.find((item) => typeof item === "string" && item.trim());
  if (!value) {
    return "local";
  }

  return value.slice(0, 7);
}

export async function GET() {
  return NextResponse.json({ buildId: resolveBuildId() }, { status: 200 });
}
