import { ImageResponse } from "next/og";

export const alt = "Automacao de WhatsApp com IA da InfraStudio";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background:
            "radial-gradient(circle at top left, rgba(16,185,129,0.34), transparent 26%), radial-gradient(circle at 85% 18%, rgba(34,211,238,0.22), transparent 20%), linear-gradient(135deg, #020617 0%, #04111d 58%, #03131d 100%)",
          color: "#e2e8f0",
          position: "relative",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "radial-gradient(rgba(148,163,184,0.16) 1px, transparent 1px)",
            backgroundSize: "26px 26px",
            opacity: 0.22,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            padding: "56px 64px",
            position: "relative",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 72,
                height: 72,
                borderRadius: 22,
                background: "linear-gradient(135deg, #22c55e, #06b6d4)",
                color: "#04111d",
                fontSize: 28,
                fontWeight: 800,
                letterSpacing: "-0.04em",
              }}
            >
              IA
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#f8fafc",
                }}
              >
                InfraStudio
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 18,
                  color: "#94a3b8",
                }}
              >
                WhatsApp com automacao inteligente
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 22,
              maxWidth: 830,
            }}
          >
            <div
              style={{
                display: "flex",
                fontSize: 68,
                lineHeight: 1.02,
                fontWeight: 800,
                letterSpacing: "-0.06em",
                color: "#f8fafc",
              }}
            >
              Automacao de WhatsApp com IA
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 30,
                lineHeight: 1.28,
                color: "#cbd5e1",
                maxWidth: 920,
              }}
            >
              Responda clientes mais rapido, reduza operacao manual e transforme seu WhatsApp em um canal de vendas mais eficiente.
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 14,
              }}
            >
              {["Respostas automaticas", "Captura de leads", "Teste rapido"].map((item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "12px 18px",
                    borderRadius: 999,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(15,23,42,0.56)",
                    color: "#e2e8f0",
                    fontSize: 20,
                  }}
                >
                  {item}
                </div>
              ))}
            </div>

            <div
              style={{
                display: "flex",
                fontSize: 22,
                color: "#22c55e",
                fontWeight: 700,
              }}
            >
              infrastudio.vercel.app/whatsapp
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
