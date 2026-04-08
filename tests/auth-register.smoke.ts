import assert from "node:assert/strict";
import { POST } from "@/app/api/auth/register/route";

async function readJson(response: Response) {
  return (await response.json()) as { error?: string; message?: string };
}

async function main() {
  const missingFields = await POST(
    new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: "", email: "", senha: "", confirmarSenha: "" }),
    }),
  );
  assert.equal(missingFields.status, 400);

  const mismatchPassword = await POST(
    new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Teste",
        email: "teste@infrastudio.pro",
        senha: "123456",
        confirmarSenha: "654321",
      }),
    }),
  );
  assert.equal(mismatchPassword.status, 400);
  assert.match((await readJson(mismatchPassword)).error ?? "", /confirmacao de senha/i);

  const shortPassword = await POST(
    new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: "Teste",
        email: "teste@infrastudio.pro",
        senha: "123",
        confirmarSenha: "123",
      }),
    }),
  );
  assert.equal(shortPassword.status, 400);
  assert.match((await readJson(shortPassword)).error ?? "", /pelo menos 6 caracteres/i);

  console.log("auth-register smoke ok");
}

void main();
