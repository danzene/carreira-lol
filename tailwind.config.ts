import type { Config } from "tailwindcss";

// Tema escuro de esports. Cores centralizadas aqui pra manter a UI consistente.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        fundo: "#0a0a0f", // fundo da página
        painel: "#13131c", // cards / superfícies
        borda: "#23233a", // divisórias
        destaque: "#6d28d9", // roxo (ação primária)
        destaque2: "#22d3ee", // ciano (acento)
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
