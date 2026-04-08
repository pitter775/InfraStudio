import assert from "node:assert/strict";
import { sendEmail } from "@/lib/email";

async function main() {
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalFetch = global.fetch;

  try {
    process.env.RESEND_API_KEY = "test_resend_key";

    let called = false;
    global.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      called = true;
      assert.equal(String(input), "https://api.resend.com/emails");
      assert.equal(init?.method, "POST");
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer test_resend_key");

      const payload = JSON.parse(String(init?.body ?? "{}")) as {
        from: string;
        reply_to: string;
        to: string[];
        subject: string;
        html: string;
      };

      assert.equal(payload.from, "contato@infrastudio.pro");
      assert.equal(payload.reply_to, "pitter775@gmail.com");
      assert.deepEqual(payload.to, ["teste@infrastudio.pro"]);
      assert.equal(payload.subject, "Teste");
      assert.match(payload.html, /Ola/);

      return new Response(JSON.stringify({ id: "email_mocked" }), { status: 200 });
    }) as typeof fetch;

    await sendEmail({
      to: "teste@infrastudio.pro",
      subject: "Teste",
      html: "<p>Ola</p>",
    });

    assert.equal(called, true);
    console.log("email-service smoke ok");
  } finally {
    global.fetch = originalFetch;

    if (originalApiKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalApiKey;
    }
  }
}

void main();
