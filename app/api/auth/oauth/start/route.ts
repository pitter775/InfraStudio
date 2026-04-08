import { NextResponse } from "next/server";
import { buildSocialAuthorizationUrl } from "@/lib/social-oauth";

export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const providerParam = searchParams.get("provider")?.trim() || "";
    const provider =
      providerParam === "google" || providerParam === "github" || providerParam === "facebook"
        ? providerParam
        : null;

    if (!provider) {
      return NextResponse.json({ error: "Provider social invalido." }, { status: 400 });
    }

    const url = await buildSocialAuthorizationUrl(provider, origin);
    return NextResponse.redirect(url);
  } catch (error) {
    console.error("[auth] social oauth start failed", error);
    return NextResponse.redirect(new URL("/?auth_notice=social_oauth_error", request.url));
  }
}
