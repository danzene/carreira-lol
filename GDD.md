# GDD — Carreira LoL (Game Design Document consolidado)

> Documento-mestre para continuar o projeto numa nova sessão. Leia também
> `CLAUDE.md` (plano de 13 fases) e `PROGRESS.md` (estado fase a fase) na raiz.

---

## 0. CONTEXTO CRÍTICO (leia primeiro)

- **O que é:** jogo web **em pixel art** de **carreira de jogador profissional de
  League of Legends**, inspirado no **Teamfight Manager** (mas você é o JOGADOR, não o
  treinador). Arte/identidade 100% originais.
- **Onde fica:** `C:\Users\User\Desktop\Carreira LoL`. É um projeto **separado** do
  `draft lol site` (uma pasta-irmã no Desktop, que é outro jogo — gacha de draft).
- **No ar:** https://carreira-lol.vercel.app · repo: github.com/danzene/carreira-lol
  (deploy automático a cada `git push` na branch `main`).
- **Histórico importante:** este projeto foi todo construído a partir de uma sessão do
  Claude **aberta na pasta errada** (`draft lol site`). **Idealmente a próxima sessão
  deve ser aberta DENTRO de `Carreira LoL`** para git/memória/CLAUDE.md baterem certo.
- Houve um **pivô**: um protótipo anterior (não-pixel, estilo FIFA) foi preservado no
  **branch git `prototipo-v0`** e substituído por este (pixel/TFM). Nada se perdeu.
- **Node não roda no ambiente do agente** → quem roda `npm install/dev/test/build` é o
  usuário, e ele **valida testando no deploy**. Nunca afirme que testes passaram sem o
  usuário confirmar.
- **Protocolo de trabalho:** uma fase por vez, em ordem; antes de codar, listar os
  arquivos; ao terminar, atualizar `PROGRESS.md` e **PARAR para aprovação**. Commitar
  só quando o usuário pedir (ele costuma commitar e dar push ele mesmo). Responder
  **sempre em português (PT-BR)**.

---

## 1. CONCEITO CENTRAL & CORE LOOP

Você cria um pro player do zero (soloq, sem time) e evolui numa progressão **lenta e
viciante**: joga partidas, melhora atributos/traços, sobe de elo, ganha **reputação**,
recebe **propostas de times** melhores, investe o dinheiro na própria evolução e sobe
de tier até o **Mundial**.

**Dois pilares de design (inegociáveis):**
1. **A nota individual (0–10) importa tanto quanto a vitória** — dá pra perder a partida
   e ainda subir de reputação se você brilhar.
2. **O draft (pick & ban) decide partidas tanto quanto o talento** — um bom draft ganha
   de um time melhor; a meta muda a cada split (Auto Patch), forçando adaptação da pool.

**Core loop (semanal):**
1. Cada semana você tem **energia limitada**.
2. Gasta energia em **atividades**: Jogar Partida (draft → auto-battle), Treino focado,
   Treino especial, Streaming (renda), Alteração mental (ganhar traço).
3. Quando a energia acaba, **avança a semana** (única forma de recuperar energia) ou
   **descansa a semana** (recupera tudo + moral, mas não grinda).
4. Boas notas → **reputação sobe** → times mandam **propostas** → você **negocia e
   assina** → sobe de **tier** (salário/instalações melhores).
5. Investe dinheiro em **bootcamp/coach/periféricos** pra ficar mais forte. Repete.

Tiers: **SOLOQ → AMADOR → ACADEMY → TIER1 → INTERNACIONAL**. Temporada = **26 semanas**.

---

## 2. MECÂNICAS & SISTEMAS (já implementados — Fases 0 a 7)

### 2.1 Criação de jogador (Fase 1)
Wizard de 4 passos: **Identidade** (nome, nacionalidade, rota) → **Atributos**
(distribuir 80 pontos, base 40, teto 75 na criação) → **Traço** (escolhe 1 inicial) →
**Campeões** (3 da pool via Data Dragon). Save multi-slot em localStorage.

### 2.2 Atributos (0–100, 8)
`mecanica, macro, laning, teamfight, consistencia, mental, comunicacao, championPool`.
(`consistencia` e `mental` reduzem a variância da performance.)

### 2.3 Traços (`TraitId`)
`ROAMER, LANE_BULLY, CLUTCH, FLEX, CARRY_TARDIO, AGRESSIVO, TILTAVEL, FRIO, SHOTCALLER`.
Efeitos no motor (ex.: `CLUTCH` melhora em desvantagem de draft; `TILTAVEL` aumenta a
variância negativa; `FRIO` reduz variância; `LANE_BULLY`/`SHOTCALLER` dão força). Máx. 3
traços (ganha mais via "Alteração mental" no loop semanal).

### 2.4 Banco de campeões (Fase 2 + dados reais)
Cada campeão real (Data Dragon) vira um `ChampionDef`: `classes` (TANK/LUTADOR/MAGO/
ATIRADOR/ASSASSINO/SUPORTE), `rolesValidas`, `perfil` (dano, resistência, cc, mobilidade,
sustain) e `forcaMetaBase`. **Tier list por rota** com inspeção.
- **Dados reais (Oracle's Elixir):** `scripts/processar-oe.mjs` lê o CSV de pro play
  (`2026_LoL_esports_match_data_from_OraclesElixir.csv`, no Desktop) e gera
  `data/champions-oe.json` (rotas reais + força por winrate/presença). `construirBanco`
  sobrescreve as rotas/força sintéticas com esses dados quando presentes. **Rodar:**
  `node scripts/processar-oe.mjs` (depois commitar o JSON). Campeões fora do pro de 2026
  caem no sintético; alguns nomes têm override (Wukong/MonkeyKing, Nunu, Renata).

### 2.5 Draft — Pick & Ban (Fase 3)
Ordem oficial de torneio (6 bans, 6 picks, 4 bans, 4 picks). IA do **coach** (seu time) e
do **inimigo** preenche rotas e prioriza meta/comfort. Seus **comfort picks** = sua pool
(★). Cálculo de **`forcaComp`** (sinergia: frente + diversidade; counters: dano×resistência,
cc×mobilidade). **Voz no draft escala com reputação** (`passosCoach`: reputação baixa →
coach assume seus últimos picks). Picks exibidos em ordem de rota (Top→Sup).

### 2.6 Motor de partida (Fase 4)
`simularPartida(player, ctx, seed)` — PURO. Equação:
`base = 0.35·forcaRota + 0.25·forcaCampeao + 0.20·forcaTime + 0.20·forcaComp`, onde
`forcaCampeao = (maestria + forcaMetaBase)/2`. Soma **modificadores de traços** e **ruído**
(amplitude reduzida por `consistencia`+`mental`) e **bônus de periféricos**. Gera:
`vitoria`, `nota 0–10` (alta até em derrota), `kda`, `csPorMin`, `xpGanho`, `lpDelta` e um
`log[]` narrado. `aplicarResultado` aplica **elo/LP, XP, reputação (pela nota), histórico**.
**Viewer de auto-battle** simples (timeline + log revelado) → tela de resultado.

### 2.7 Loop semanal (Fase 5) — com correção de balanceamento
Energia por semana; atividades: **soloq** (custa energia), **treino focado/especial**,
**streaming** (+$/+reputação), **alteração mental** (ganha traço). **A energia só recupera
ao avançar a semana** — não há descanso grátis no meio da semana (corrige o exploit de
treinar/descansar infinito). Dois modos de avançar: **Avançar semana** (+55 energia, moral
pela forma) e **Descansar a semana** (energia ao máx + moral). Vira temporada após 26.

### 2.8 Economia + equipamentos (Fase 6)
Salário semanal + bônus por vitória (do contrato, ou base stub sem time). **Loja**:
🧠 sessão mental/nutri (+moral/energia), 🎓 coach (assinatura: −$/sem, +XP em tudo),
🇰🇷 bootcamp Coreia (caro, pula 3 semanas, +XP geral). **Crafting de periféricos**
(headset→comunicação, mouse→mecânica, cadeira→consistência, monitor→laning; até nível 5),
cujo bônus **entra na partida** (`forcaRota` + `bonusAtributos`). Design: sempre falta um
pouco de grana.

### 2.9 Reputação + transferências + contratos (Fase 7)
**Times fictícios por tier** (`data/times.ts`) com `prestigio` e `instalacoes`. Reputação
**sobe pela nota** das partidas. Ao **avançar a semana**, times mandam **ofertas** à inbox
conforme a reputação. Em **Propostas**: **Assinar** (muda tier/salário, limpa inbox),
**Contrapropor** (+25% se reputação ≥ prestígio do time; senão o time retira), **Recusar**.
**Instalações do time aceleram o treino.**

---

## 3. PROGRESSÃO / NARRATIVA

Sem história roteirizada — a narrativa é **emergente** (sua carreira). Progressão macro =
subir de **tier** (SOLOQ→AMADOR→ACADEMY→TIER1→INTERNACIONAL) via reputação e contratos,
rumo a ganhar a liga no Tier 1 e ir ao **Mundial** (Fase 8 em diante). A "história" é
contada pelos números: elo, reputação, dinheiro, títulos, histórico de partidas.

---

## 4. ESCOPO TÉCNICO

- **Stack:** Next.js 14 (App Router) + **TypeScript estrito** (sem `any` solto) + Tailwind
  CSS + **Zustand** (estado) + **Vitest** (testa o motor). Save em **localStorage**
  (multi-slot, namespaceado por usuário).
- **Pixel art:** paleta em CSS vars/Tailwind — `fundo #0b0617`, `painel #15102a`,
  `borda #2a2150`, `rosa #ff2d7e` (primária), `ciano #19e6e0` (acento), `texto #ece8ff`,
  `suave #9a90c0`. Fonte bitmap **"Press Start 2P"** via `next/font` (classe `font-pixel`),
  só em títulos/HUD. `image-rendering: pixelated`. (Battle animado caprichado = Fase 10.)
- **Estrutura:** `/app` (rotas) · `/components` (UI) · `/engine` (lógica PURA estado→estado
  + testes — o coração) · `/store` (Zustand + save) · `/data` (config/balanceamento, times,
  campeões) · `/lib` (ddragon, supabase) · `/public/art` (sprites, futuro).
  **Regra de ouro:** tudo em `/engine` é função pura, testável no Vitest sem UI.
- **Dados de campeão:** **Data Dragon** (`ddragon.leagueoflegends.com`, locale pt_BR) pra
  ícones/nomes; **Oracle's Elixir** (CSV → `data/champions-oe.json`) pra rotas e força reais.
- **Infra (preservada do protótipo anterior):**
  - **Vercel** (deploy contínuo no push da `main`). Env vars
    `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` configuradas.
  - **Supabase** (projeto em São Paulo): login email/senha + save na nuvem existem como
    infra (`store/authStore.ts`, `cloudSync.ts`, `components/AuthGate.tsx`, `TelaLogin.tsx`,
    migration `supabase/migrations/001_user_saves.sql`), **mas o login NÃO está plugado no
    layout agora** — a home é pública e o save é localStorage (namespace "anon"). Religar o
    login (re-skin pixel) é um passo futuro.
  - `lib/ddragon.ts`, `lib/supabaseClient.ts`, `engine/rng.ts` (PRNG mulberry32) reusados.
- **Testes:** ~39 testes no Vitest (`engine/*.test.ts`). `npm run test` / `dev` / `build`.

### Mapa de arquivos-chave
```
engine/  types.ts (modelo de dados) · rng.ts · player.ts · champions.ts · draft.ts
         simularPartida.ts · elo.ts · loop.ts · economia.ts · transferencias.ts (+ *.test.ts)
data/    config.ts (atributos/rotas/traços/criação) · simulacao.ts · loop.ts · economia.ts
         champions.ts (mapas) · champions-oe.json (gerado) · times.ts
store/   careerStore.ts (estado+ações) · saves.ts · authStore.ts · cloudSync.ts
components/ CriacaoWizard, EditorAtributos, SeletorTraco, SeletorCampeoes, BarraAtributo,
            PlayerCard, PainelSemana, TierList, DraftBoard, Partida, ResultadoPartida,
            Loja, Inbox, AuthGate, TelaLogin
app/     page.tsx (home) · criar · dashboard · campeoes · draft · loja · propostas · layout
scripts/ processar-oe.mjs (gera champions-oe.json)
```

### Modelo de dados (resumo — ver `engine/types.ts`)
`Role`, `Tier`, `Classe`, `Attributes` (8), `TraitId`, `ChampionDef`, `ChampionMastery`,
`Player` (atributos, pool, **tracos**, reputacao, rankSoloq, energia, moral), `Equip`,
`Contract` (salarioSemanal, **bonusPorVitoria**, semanasRestantes, tier), `Offer`,
`MatchResult` (nota, kda, csPorMin, lpDelta, xpGanho, **log[]**), `CareerState`
(player, dinheiro, **equipamentos**, contratoAtual, semanaAtual, temporada, **tierAtual**,
historicoPartidas, **inbox**, **patchVigente**, energiaEm?, **coachAtivo?**).

---

## 5. PRÓXIMOS PASSOS

**Estado atual:** Fases **0 a 7 CONCLUÍDAS** (setup pixel; criação+dashboard+save; banco de
campeões + tier list; draft pick&ban; motor de partida + resultado; loop semanal; economia
+ equipamentos; reputação + transferências). Mais a integração de **dados reais (Oracle's
Elixir)** e a **correção do balanceamento** do loop (energia só recupera com o tempo).

**Pendências do usuário:** dar `git push` da Fase 7 (deploy); rodar `npm run test`/`dev`;
o `champions-oe.json` precisa estar commitado pra valer no deploy.

**PRÓXIMA FASE A DESENVOLVER → Fase 8 — Ligas + campeonatos:**
- Ligas Amadora → Mundial; **calendário de partidas oficiais** (temporada regular +
  playoffs) com o seu time; premiação em **dinheiro/reputação**; **promoção/rebaixamento**
  de tier; acesso ao **Internacional/Mundial** ao vencer no Tier 1.
- Fora do escopo da 8: win rate real (Fase 9) e battle pixel animado (Fase 10).
- Pronto quando: dá pra **jogar uma temporada inteira** com o time e ganhar título.

**Fases seguintes (roadmap):**
- **9 — Auto Patch + win rates reais (Riot API):** a meta muda a cada split; win rate via
  API Route do Next (chave em `.env.local`); tela de "patch notes". (Usuário ofereceu
  vincular a Riot API — mas para *rotas* o Oracle's Elixir já basta; Riot é p/ winrate ao vivo.)
- **10 — Auto-battle pixel art animado** (sprites por classe, dirigido pelo `log` do motor).
- **11 — Opções de novo jogo** (Fearless, Hide Attributes, dificuldade) + event matches.
- **12 — Polimento** (balanceamento, eventos aleatórios, conquistas, áudio chiptune).

**Como retomar:** abrir a sessão na pasta `Carreira LoL`, ler `CLAUDE.md` + `PROGRESS.md` +
este GDD, e iniciar a **Fase 8** seguindo o protocolo (listar arquivos antes de codar,
parar pra aprovação no fim). Responder em PT-BR.
