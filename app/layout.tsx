import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://infrastudio.vercel.app"),
  title: {
    default: "InfraStudio",
    template: "%s | InfraStudio",
  },
  description: "Sistemas, automações e IA para ajudar sua empresa a vender mais com menos operacao manual.",
  applicationName: "InfraStudio",
  keywords: [
    "automacao",
    "inteligencia artificial",
    "whatsapp",
    "integracao de APIs",
    "sistemas sob medida",
    "InfraStudio",
  ],
  authors: [{ name: "InfraStudio" }],
  creator: "InfraStudio",
  publisher: "InfraStudio",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/logo.png", sizes: "32x32", type: "image/png" },
      { url: "/logo.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/logo.png",
    apple: [{ url: "/logo.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: "https://infrastudio.vercel.app",
    siteName: "InfraStudio",
    title: "InfraStudio",
    description: "Sistemas, automações e IA para ajudar sua empresa a vender mais com menos operacao manual.",
    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Logo da InfraStudio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "InfraStudio",
    description: "Sistemas, automações e IA para ajudar sua empresa a vender mais com menos operacao manual.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
