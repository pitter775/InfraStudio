import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InfraStudio",
  description: "Sistemas, automações e IA para  sua empresa vai vender mais.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
