# Progresso — Carreira LoL

## Status das fases
- [x] Fase 0 — Setup
- [ ] Fase 1 — Criação de jogador + dashboard + save
- [ ] Fase 2 — Motor + soloq
- [ ] Fase 3 — Loop semanal
- [ ] Fase 4 — Economia
- [ ] Fase 5 — Reputação + propostas
- [ ] Fase 6 — Campeonatos
- [ ] Fase 7 — Dados reais
- [ ] Fase 8 — Polimento

## Decisões tomadas

### Fase 0 (setup)
- **Stack fixada:** Next 14.2 (App Router) + React 18.3 + TypeScript 5.5 (estrito) +
  Tailwind CSS 3.4 + Zustand 4.5 + Vitest 1.6. Combo estável e bem documentado.
- **TS estrito reforçado:** além de `strict`, liguei `noUnusedLocals`,
  `noUnusedParameters` e `noFallthroughCasesInSwitch`. Alias de import `@/*` = raiz.
- **Tema:** escuro de esports, cores centralizadas em `tailwind.config.ts`
  (`fundo`, `painel`, `borda`, `destaque` roxo, `destaque2` ciano).
- **Testes:** Vitest no ambiente `node` (o `/engine` é JS puro, sem DOM). Pega
  qualquer `*.test.ts`. Teste dummy em `engine/dummy.test.ts`.
- **Estrutura:** `/app` (telas), `/components`, `/engine` (lógica pura), `/store`
  (Zustand+save), `/data` (dados/balanceamento). Pastas ainda vazias usam `.gitkeep`.
- **Home:** server component, sem estado; botão "Nova Carreira" ainda sem ação
  (ligado na Fase 1).

### Infra (Vercel + Supabase) — fora do roteiro de fases, a pedido do usuário
- **Deploy:** projeto pronto pra Vercel (Next zero-config). Passo a passo em `DEPLOY.md`.
- **Supabase:** projeto **novo e separado** (não reaproveita o do draft lol),
  criado **vazio** (sem schema) — "pronto pra ligar depois". Cliente preguiçoso
  em `lib/supabaseClient.ts`, **ainda não usado** (save segue em localStorage).
  Variáveis em `.env.example`/`.env.local` (`NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Dependência: `@supabase/supabase-js`.
- Pasta `/lib` adicionada à estrutura para helpers de infra.

## Como rodar

> Pré-requisito: Node 18+ instalado na máquina.

```bash
npm install      # instala as dependências (1ª vez)
npm run dev      # sobe o dev server em http://localhost:3000
npm run test     # roda os testes (Vitest) — deve passar o teste dummy
npm run build    # build de produção (checa que compila)
npm run lint     # lint (eslint-config-next)
```
