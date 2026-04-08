import assert from "node:assert/strict";
import { GET } from "@/app/api/auth/verify-email/route";

async function main() {
  const response = await GET(new Request("http://localhost:3000/api/auth/verify-email?token="));
  assert.equal(response.status, 400);

  const payload = (await response.json()) as { error?: string };
  assert.match(payload.error ?? "", /token/i);

  console.log("auth-verify-email smoke ok");
}

void main();
