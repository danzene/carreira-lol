# Progresso — Carreira LoL

## Status das fases
- [x] Fase 0 — Setup
- [x] Fase 1 — Criação de jogador + dashboard + save
- [x] Fase 2 — Motor + soloq
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

### Fase 1 (criação + dashboard + save)
- **Motor puro** (`engine/types.ts`, `engine/player.ts`): tipos do domínio +
  `criarPlayer`/`criarCareerState`/`validarCriacao`. Testado em `engine/player.test.ts`.
- **Criação:** atributos começam em 40, **80 pontos** em passos de 5, teto **75**
  na criação; pool de **3 campeões**; tudo configurável em `data/config.ts`.
- **Data Dragon** (`lib/ddragon.ts`): lista de campeões + ícones, locale `pt_BR`,
  cacheada em localStorage por versão.
- **Save multi-slot** (`store/saves.ts`): mapa de slots no localStorage + ponteiro
  de "slot atual" (pra Continuar). Estado global em `store/careerStore.ts` (Zustand).
- **Telas:** Home (`Nova Carreira` + lista Continuar) → `/criar` (wizard de 3 passos)
  → `/dashboard` (PlayerCard com atributos, pool, rank, energia/moral, dinheiro).
- **Decisões técnicas:** Vitest com alias `@` (`vitest.config.ts`); testes excluídos
  do build TS (`tsconfig`); regra `no-img-element` desligada (ícones do Data Dragon
  via `<img>`, sem otimização do next/image num grid grande).

### Fase 2 (motor de simulação + soloq)
- **Motor puro e determinístico** (`engine/rng.ts` mulberry32, `engine/elo.ts`,
  `engine/simularPartida.ts`): `simularPartida(player, championId, seed)` → `MatchResult`.
  Testes em `engine/simularPartida.test.ts` (vitória↑ com atributos, variância↓ com
  consistência/mental, XP, elo). Balanceamento em `data/simulacao.ts`.
- **Pilar do design:** a **nota** vem da força individual vs nível do lobby (alta até
  em derrota); a **vitória** vem do time (você + 4 aliados vs 5 inimigos gerados).
- **Elo:** ladder Ferro IV→Desafiante derivada do MMR (1 MMR = 1 LP na divisão);
  ganho maior contra MMR alto.
- **Fluxo soloq** (`app/soloq/page.tsx`): pick (da pool) → draft simplificada
  (lobby cosmético com campeões aleatórios) → resultado (`ResultadoPartida`).
- **Efeitos aplicados** (`aplicarResultado`): elo/LP, XP nos atributos (cap 100),
  histórico (últimas 50). Ação `jogarPartida` no `careerStore` persiste no slot.
- **Dashboard:** botão *Jogar Soloq* + `HistoricoPartidas` (últimas 8).

## Como rodar

> Pré-requisito: Node 18+ instalado na máquina.

```bash
npm install      # instala as dependências (1ª vez)
npm run dev      # sobe o dev server em http://localhost:3000
npm run test     # roda os testes (Vitest) — devem passar os testes do motor
npm run build    # build de produção (checa que compila)
npm run lint     # lint (eslint-config-next)
```
