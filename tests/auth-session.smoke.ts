import { NextRequest } from "next/server";
import assert from "node:assert/strict";
import { proxy } from "@/proxy";
import { signSessionToken, verifySessionToken, SESSION_COOKIE } from "@/lib/session-token";
import type { AppUser } from "@/lib/app-user";

async function run() {
  process.env.APP_AUTH_SECRET ??= "test-secret-auth-session";

  const user: AppUser = {
    id: "usr_test_001",
    name: "Teste Auth",
    email: "teste@infrastudio.com",
    role: "admin",
    status: "ativo",
    currentProjectId: "proj_001",
    memberships: [{ projetoId: "proj_001", papel: "admin" }],
  };

  const token = await signSessionToken(user);
  const verified = await verifySessionToken(token);

  assert.equal(verified.id, user.id);
  assert.equal(verified.email, user.email);
  assert.equal(verified.status, "ativo");

  const anonymousRequest = new NextRequest("http://localhost:3000/admin/dashboard");
  const anonymousResponse = await proxy(anonymousRequest);
  assert.equal(anonymousResponse.status, 307);
  assert.equal(anonymousResponse.headers.get("location"), "http://localhost:3000/?returnTo=%2Fadmin%2Fdashboard");

  const authenticatedRequest = new NextRequest("http://localhost:3000/admin/dashboard", {
    headers: {
      cookie: `${SESSION_COOKIE}=${token}`,
    },
  });
  const authenticatedResponse = await proxy(authenticatedRequest);
  assert.equal(authenticatedResponse.status, 200);

  const apiRequest = new NextRequest("http://localhost:3000/api/admin/planos");
  const apiResponse = await proxy(apiRequest);
  assert.equal(apiResponse.status, 401);

  console.log(JSON.stringify({ ok: true, tested: ["jwt-sign", "jwt-verify", "proxy-page", "proxy-api"] }));
}

void run();
