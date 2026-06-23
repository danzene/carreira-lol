import type { Config } from "tailwindcss";

// Paleta pixel art de e-sports (rosa/ciano sobre roxo escuro).
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        fundo: "#0b0617", // fundo da tela
        painel: "#15102a", // cards / superfícies
        borda: "#2a2150", // divisórias / bordas pixel
        rosa: "#ff2d7e", // ação primária
        ciano: "#19e6e0", // acento
        texto: "#ece8ff", // texto claro
        suave: "#9a90c0", // texto secundário
      },
      fontFamily: {
        pixel: ["var(--font-pixel)", "monospace"], // bitmap (títulos/HUD)
      },
    },
  },
  plugins: [],
};

export default config;
