import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Carreira LoL",
  description:
    "Modo carreira de jogador profissional de League of Legends: do zero ao Worlds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-fundo text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
