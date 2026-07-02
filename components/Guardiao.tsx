"use client";

import { Component, type ReactNode } from "react";

// 🛟 ErrorBoundary global: se algo explodir no cliente, mostra uma tela amigável com o
// erro real (em vez do "Application error" genérico do Next) e um botão de recuperação.

interface Props {
  children: ReactNode;
}
interface State {
  erro: Error | null;
}

export default class Guardiao extends Component<Props, State> {
  state: State = { erro: null };

  static getDerivedStateFromError(erro: Error): State {
    return { erro };
  }

  render() {
    if (!this.state.erro) return this.props.children;
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 px-5 text-center">
        <span className="text-4xl">💥</span>
        <h1 className="font-pixel text-sm text-rosa">ALGO QUEBROU</h1>
        <p className="text-[12px] text-suave">
          Um erro inesperado aconteceu. Recarregar geralmente resolve — se continuar, tenta sair e entrar na conta.
        </p>
        <p className="max-w-full overflow-x-auto border-2 border-borda bg-painel p-2 text-left text-[10px] text-suave">
          {this.state.erro.message}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="border-2 border-ciano bg-ciano/10 px-4 py-2 font-pixel text-[10px] text-ciano transition hover:bg-ciano hover:text-fundo"
          >
            🔄 RECARREGAR
          </button>
          <button
            type="button"
            onClick={() => {
              window.location.href = "/";
            }}
            className="border-2 border-borda px-4 py-2 font-pixel text-[10px] text-suave transition hover:text-texto"
          >
            INÍCIO
          </button>
        </div>
      </main>
    );
  }
}
