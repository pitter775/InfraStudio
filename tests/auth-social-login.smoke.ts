import assert from "node:assert/strict";
import { POST } from "@/app/api/auth/social-login/route";

async function main() {
  const missingFields = await POST(
    new Request("http://localhost:3000/api/auth/social-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "google", providerUserId: "", email: "", nome: "" }),
    }),
  );

  assert.equal(missingFields.status, 400);
  const payload = (await missingFields.json()) as { error?: string };
  assert.match(payload.error ?? "", /login social incompletos/i);

  console.log("auth-social-login smoke ok");
}

void main();
