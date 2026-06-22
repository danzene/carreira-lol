# Carreira LoL

Jogo web de **modo carreira de jogador profissional de League of Legends** —
inspirado no Modo Carreira do FIFA / Master League do PES, mas no esports de LoL.
Você cria um pro player, começa do zero na soloq e evolui (atributos, elo,
reputação, propostas de times) até o Tier 1, MSI e Worlds.

O pilar de design: **a nota de performance individual importa tanto quanto a
vitória do time** — dá pra perder a partida e ainda subir de reputação.

> O plano completo (fases 0–8, modelo de dados, sistemas) está em `CLAUDE.md`.
> O andamento fase a fase está em `PROGRESS.md`.

## Stack

Next.js 14 (App Router) · TypeScript estrito · Tailwind CSS · Zustand · Vitest.

## Rodar

```bash
npm install
npm run dev      # http://localhost:3000
npm run test     # Vitest
```

## Estrutura

```
/app          → rotas e telas (Next)
/components    → componentes de UI
/engine        → lógica de jogo PURA (sem React) + testes
/store         → estado Zustand + save/load
/data          → dados estáticos (times, balanceamento)
```

Regra de ouro: tudo em `/engine` é função pura (estado → estado), zero React/browser.
