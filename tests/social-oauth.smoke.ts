import assert from "node:assert/strict";
import { buildSocialAuthorizationUrl, completeSocialOAuthCallback } from "@/lib/social-oauth";

type MockFetch = typeof fetch;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function runGoogleTest() {
  const authUrl = await buildSocialAuthorizationUrl("google", "http://localhost:3000");
  const state = new URL(authUrl).searchParams.get("state");
  assert.ok(state);

  let finalized = false;
  const fetchMock: MockFetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("oauth2.googleapis.com/token")) {
      return jsonResponse({ access_token: "google_token" });
    }

    if (url.includes("openidconnect.googleapis.com/v1/userinfo")) {
      return jsonResponse({ sub: "google-user-1", email: "google@infrastudio.pro", name: "Google User" });
    }

    throw new Error(`URL nao esperada no Google: ${url}`);
  }) as MockFetch;

  const user = await completeSocialOAuthCallback(
    new URLSearchParams({ code: "google-code", state: state! }),
    "http://localhost:3000",
    {
      fetchImpl: fetchMock,
      finalizeLogin: async (input) => {
        finalized = true;
        assert.equal(input.provider, "google");
        assert.equal(input.providerUserId, "google-user-1");
        assert.equal(input.email, "google@infrastudio.pro");
        return {
          ok: true as const,
          created: true,
          user: {
            id: "user-google",
            name: "Google User",
            email: input.email,
            role: "viewer",
            status: "ativo",
            currentProjectId: "projeto-google",
            memberships: [],
          },
        };
      },
    },
  );

  assert.equal(finalized, true);
  assert.equal(user.email, "google@infrastudio.pro");
}

async function runGithubTest() {
  const authUrl = await buildSocialAuthorizationUrl("github", "http://localhost:3000");
  const state = new URL(authUrl).searchParams.get("state");
  assert.ok(state);

  const fetchMock: MockFetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("github.com/login/oauth/access_token")) {
      return jsonResponse({ access_token: "github_token" });
    }

    if (url === "https://api.github.com/user") {
      return jsonResponse({ id: 77, login: "github-user", name: "GitHub User" });
    }

    if (url === "https://api.github.com/user/emails") {
      return jsonResponse([{ email: "github@infrastudio.pro", primary: true, verified: true }]);
    }

    throw new Error(`URL nao esperada no GitHub: ${url}`);
  }) as MockFetch;

  const user = await completeSocialOAuthCallback(
    new URLSearchParams({ code: "github-code", state: state! }),
    "http://localhost:3000",
    {
      fetchImpl: fetchMock,
      finalizeLogin: async (input) => ({
        ok: true as const,
        created: false,
        user: {
          id: "user-github",
          name: "GitHub User",
          email: input.email,
          role: "viewer",
          status: "ativo",
          currentProjectId: "projeto-github",
          memberships: [],
        },
      }),
    },
  );

  assert.equal(user.email, "github@infrastudio.pro");
}

async function runFacebookTest() {
  const authUrl = await buildSocialAuthorizationUrl("facebook", "http://localhost:3000");
  const state = new URL(authUrl).searchParams.get("state");
  assert.ok(state);

  const fetchMock: MockFetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("graph.facebook.com/v19.0/oauth/access_token")) {
      return jsonResponse({ access_token: "facebook_token" });
    }

    if (url.includes("graph.facebook.com/me")) {
      return jsonResponse({ id: "fb-123", name: "Facebook User", email: "facebook@infrastudio.pro" });
    }

    throw new Error(`URL nao esperada no Facebook: ${url}`);
  }) as MockFetch;

  const user = await completeSocialOAuthCallback(
    new URLSearchParams({ code: "facebook-code", state: state! }),
    "http://localhost:3000",
    {
      fetchImpl: fetchMock,
      finalizeLogin: async (input) => ({
        ok: true as const,
        created: true,
        user: {
          id: "user-facebook",
          name: "Facebook User",
          email: input.email,
          role: "viewer",
          status: "ativo",
          currentProjectId: "projeto-facebook",
          memberships: [],
        },
      }),
    },
  );

  assert.equal(user.email, "facebook@infrastudio.pro");
}

async function runErrorTest() {
  await assert.rejects(
    () => completeSocialOAuthCallback(new URLSearchParams({ error: "access_denied" }), "http://localhost:3000"),
    /access_denied/i,
  );
}

async function main() {
  const originalEnv = {
    APP_AUTH_SECRET: process.env.APP_AUTH_SECRET,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
    FACEBOOK_CLIENT_ID: process.env.FACEBOOK_CLIENT_ID,
    FACEBOOK_CLIENT_SECRET: process.env.FACEBOOK_CLIENT_SECRET,
  };

  try {
    process.env.APP_AUTH_SECRET = "social-oauth-test-secret";
    process.env.GOOGLE_CLIENT_ID = "google-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "google-client-secret";
    process.env.GITHUB_CLIENT_ID = "github-client-id";
    process.env.GITHUB_CLIENT_SECRET = "github-client-secret";
    process.env.FACEBOOK_CLIENT_ID = "facebook-client-id";
    process.env.FACEBOOK_CLIENT_SECRET = "facebook-client-secret";

    await runGoogleTest();
    await runGithubTest();
    await runFacebookTest();
    await runErrorTest();

    console.log("social-oauth smoke ok");
  } finally {
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  }
}

void main();
