"use client";

// Conta suspensa: mensagem NEUTRA (nem acusa, nem detalha o motivo). O admin
// bane setando profiles.banned_at; o jogo checa isso no AuthGate e cai aqui.
export default function TelaBanido() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-center">
      <div className="max-w-md">
        <div className="mb-4 text-4xl">🔒</div>
        <h1 className="mb-2 text-lg font-bold text-zinc-100">Conta indisponível</h1>
        <p className="text-sm text-zinc-400">
          O acesso a esta conta está temporariamente suspenso. Se você acha que houve um engano, entre em contato com o
          suporte pelo e-mail de cadastro.
        </p>
      </div>
    </main>
  );
}
