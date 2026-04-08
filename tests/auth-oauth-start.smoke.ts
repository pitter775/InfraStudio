import assert from "node:assert/strict";
import { GET } from "@/app/api/auth/oauth/start/route";

async function main() {
  const response = await GET(new Request("http://localhost:3000/api/auth/oauth/start?provider=invalid"));
  assert.equal(response.status, 400);

  const payload = (await response.json()) as { error?: string };
  assert.match(payload.error ?? "", /provider social invalido/i);

  console.log("auth-oauth-start smoke ok");
}

void main();
