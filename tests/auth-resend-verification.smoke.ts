import assert from "node:assert/strict";
import { POST } from "@/app/api/auth/resend-verification/route";

async function main() {
  const missingEmail = await POST(
    new Request("http://localhost:3000/api/auth/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "" }),
    }),
  );

  assert.equal(missingEmail.status, 400);
  const payload = (await missingEmail.json()) as { error?: string };
  assert.match(payload.error ?? "", /email/i);

  console.log("auth-resend-verification smoke ok");
}

void main();
