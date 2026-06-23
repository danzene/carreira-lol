import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import "./globals.css";

// Fonte bitmap só pra títulos/HUD; o corpo usa fonte legível do sistema.
const pixel = Press_Start_2P({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-pixel",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Carreira LoL",
  description: "Modo carreira pixel art de pro player de League of Legends.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={pixel.variable}>
      <body className="min-h-screen bg-fundo text-texto antialiased">{children}</body>
    </html>
  );
}
