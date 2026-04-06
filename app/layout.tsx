import type { Metadata } from "next";
import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans-app",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-mono-app",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://infrastudio.vercel.app"),
  title: {
    default: "InfraStudio",
    template: "%s | InfraStudio",
  },
  description: "Sistemas, automa??es e IA para ajudar sua empresa a vender mais com menos opera??o manual.",
  applicationName: "InfraStudio",
  keywords: [
    "automa??o",
    "intelig?ncia artificial",
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
    description: "Sistemas, automa??es e IA para ajudar sua empresa a vender mais com menos opera??o manual.",
    images: [
      {
        url: "/compartilhar.png",
        width: 1200,
        height: 630,
        alt: "InfraStudio - imagem de compartilhamento",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "InfraStudio",
    description: "Sistemas, automa??es e IA para ajudar sua empresa a vender mais com menos opera??o manual.",
    images: ["/compartilhar.png"],
  },
};

export default function RootLayout({ children }: { children: import("react").ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${plusJakartaSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
