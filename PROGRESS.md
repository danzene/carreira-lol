# Progresso — Carreira LoL

## Status das fases
- [x] 0  Setup + base pixel art
- [x] 1  Criação de jogador + dashboard + save
- [x] 2  Banco de campeões
- [x] 3  Draft (pick & ban)
- [x] 4  Motor de partida + resultado
- [x] 5  Loop semanal + atividades
- [x] 6  Economia + equipamentos
- [x] 7  Reputação + transferências
- [x] 8  Ligas + campeonatos
- [x] 9  Auto Patch (meta realista)
- [ ] 10 Auto-battle pixel animado
- [ ] 11 Opções de novo jogo + event matches
- [ ] 12 Polimento

## Decisões tomadas

### Pivô (recomeço pelo plano pixel art / Teamfight Manager)
- O plano antigo (não-pixel) virou o branch git **`prototipo-v0`** (preservado).
- **Mantida a infra:** Vercel, Supabase + login/contas na nuvem (`store/authStore.ts`,
  `cloudSync.ts`, `saves.ts`, `components/AuthGate.tsx`/`TelaLogin.tsx`, migration
  `user_saves`), `lib/ddragon.ts`, `lib/supabaseClient.ts`, `engine/rng.ts`.
- Removida a lógica de jogo antiga; `engine/types.ts` reescrito com o modelo novo
  (classes, traços, `ChampionDef`, `Equip`, `patchVigente`).

### Fase 0 (setup + base pixel art)
- **Pixel art:** paleta em CSS vars + cores no Tailwind (rosa `#ff2d7e`, ciano
  `#19e6e0`, fundo `#0b0617`); fonte bitmap **Press Start 2P** via `next/font` (var
  `--font-pixel`, classe `font-pixel`); `image-rendering: pixelated` em imagens.
- **Home retrô** (`app/page.tsx`): título "CARREIRA LoL" + botão "▶ NOVA CARREIRA"
  (sem ação ainda).
- **Login fora do layout por ora** (home pública); religado numa fase de criação/save.
- Modelo de dados completo em `engine/types.ts` (tipos puros, sem lógica).
- Teste dummy em `engine/dummy.test.ts`.

### Fase 1 (criação + dashboard + save)
- **Motor puro** (`engine/player.ts`, +`player.test.ts`): `criarPlayer`/`criarCareerState`
  no modelo novo (traços, `tierAtual: "SOLOQ"`, `patchVigente: 1`, `equipamentos: []`).
- **Dados** (`data/config.ts`): atributos, rotas, nacionalidades, **TRACOS** (9, com
  `inicial` p/ os selecionáveis), CRIACAO e INICIO.
- **Criação pixel** (`components/CriacaoWizard.tsx`, 4 passos): identidade → atributos
  → **traço** → campeões (Data Dragon). Componentes: `EditorAtributos`, `SeletorTraco`,
  `SeletorCampeoes`, `BarraAtributo`.
- **Dashboard pixel** (`PlayerCard.tsx`): rank, reputação, dinheiro, tier, semana,
  energia/moral, **traços**, atributos e pool.
- **Save multi-slot** reaproveitando `store/saves.ts` (namespace "anon", sem login por
  ora) via `store/careerStore.ts`. Home com lista "Continuar".
- Dummy test removido; testes do motor em `engine/player.test.ts`.

### Fase 2 (banco de campeões)
- **`ChampionDef` sintético** (`engine/champions.ts`, +`champions.test.ts`):
  `construirBanco` mapeia os campeões reais (Data Dragon) em classes (tags→classe),
  `rolesValidas` (heurística por classe), `perfil` (dano/resistência do `info`;
  cc/mobilidade/sustain por classe) e `forcaMetaBase` sintética determinística (45–63).
- `lib/ddragon.ts` agora também puxa o `info` do campeão (cache v2).
- Mapas editáveis em `data/champions.ts` (`TAG_CLASSE`, `CLASSE_PERFIL`).
- **Tier list por rota** (`components/TierList.tsx`, `app/campeoes/page.tsx`): abas de
  rota, tiers S–D por `forcaMetaBase`, e inspeção do perfil ao tocar no campeão.
  Link no dashboard.

### Fase 3 (draft pick & ban)
- **Motor do draft** (`engine/draft.ts`, +`draft.test.ts`): ordem oficial de torneio
  (6 bans, 6 picks, 4 bans, 4 picks); `escolhaIA` (inimigo + coach) que preenche rotas
  e prioriza meta/comfort; `forcaComp` (sinergia: frente + diversidade; counters:
  dano×resistência, cc×mobilidade); `vocePica`/`passosCoach` = **voz escala com reputação**
  (rep baixa → coach assume seus últimos picks).
- **UI** (`components/DraftBoard.tsx`, `app/draft/page.tsx`): dois times com bans/picks,
  auto-avanço da IA, sua pool destacada (★), e a força de comp ao fim. Link "Treinar
  draft" no dashboard. Partida fica pra Fase 4.

### Dados reais — Oracle's Elixir (rotas + força) — a pedido do usuário
- `scripts/processar-oe.mjs` lê o CSV de partidas do pro play e gera
  `data/champions-oe.json` (rotas reais + força por winrate/presença). `construirBanco`
  sobrescreve as rotas/força sintéticas com esses dados quando presentes.
- Rodar (na raiz, com o CSV no Desktop): `node scripts/processar-oe.mjs` →
  depois `git add data/champions-oe.json && git commit && git push`.

### Fase 4 (motor de partida + resultado)
- **Motor puro** (`engine/simularPartida.ts`, `engine/elo.ts`, `data/simulacao.ts`,
  +`simularPartida.test.ts`): `simularPartida(player, ctx, seed)` usa a equação do
  CLAUDE (forcaRota + forcaCampeao[maestria+meta] + forcaTime + **forcaComp do draft**),
  com **traços** (TILTAVEL↑variância, FRIO↓, CLUTCH em desvantagem...) e ruído por
  consistência/mental. Gera nota 0–10 (alta até em derrota), KDA, cs/min, XP, LP e um
  `log` narrado. `aplicarResultado` aplica elo/LP, XP e histórico.
- **Fluxo** (`app/draft/page.tsx`): draft → **JOGAR PARTIDA** → `components/Partida.tsx`
  (auto-battle: timeline + log revelado) → `components/ResultadoPartida.tsx`. Ação
  `aplicarPartida` no store persiste. Dashboard: "⚔️ Jogar Partida".

### Fase 5 (loop semanal + atividades)
- **Motor** (`data/loop.ts`, `engine/loop.ts`, +`loop.test.ts`): energia por semana;
  atividades `treinar` (focado/especial), `streaming` (+$/+rep), `alteracaoMental`
  (ganha traço, até 3). **Energia só recupera ao avançar a semana** (`avancarSemana`
  normal = +55; `descanso` = energia ao máx + moral) — sem descanso grátis no meio da
  semana (corrige o exploit de treinar/descansar infinito). Moral oscila pela forma;
  vira temporada após 26. Soloq custa energia.
- **UI** (`components/PainelSemana.tsx` no dashboard): barra de energia + atividades com
  pickers (atributo / traço) + avançar semana. "Jogar" bloqueado sem energia.

### Fase 6 (economia + equipamentos)
- **Motor** (`data/economia.ts`, `engine/economia.ts`, +`economia.test.ts`): salário
  semanal + bônus por vitória (do contrato, ou base stub sem time); **coach** (assinatura:
  upkeep + XP/sem), **sessão mental/nutri** (+moral/energia), **bootcamp Coreia** (caro,
  +semanas, +XP geral). `processarSemanaEconomia` roda no avançar semana; bônus de vitória
  no `aplicarPartida`.
- **Crafting de periféricos:** `upgradeEquip` (headset/mouse/cadeira/monitor, até nível 5),
  cada nível dá bônus de atributo que **entra na partida** (`forcaRota` + `bonusAtributos`).
- **UI:** `components/Loja.tsx` + `app/loja/page.tsx`; link "💰 Loja" no dashboard.

### Fase 7 (reputação + transferências + contratos)
- **Times** (`data/times.ts`): fictícios por tier, com `prestigio` e `instalacoes`.
- **Motor** (`engine/transferencias.ts`, +`transferencias.test.ts`): `gerarOfertas`
  (conforme reputação), `assinarContrato` (muda tier/salário, limpa inbox),
  `recusarOferta`, `contraproposta` (+25% se reputação ≥ prestígio, senão o time retira),
  `bonusInstalacoes` (treino mais rápido). **Reputação sobe pela nota** (em
  `aplicarResultado`, `repPorNota`). Instalações aceleram `treinar`.
- **Loop:** `avancarSemana` gera ofertas na inbox. Salário/bônus reais quando há contrato.
- **UI:** `components/Inbox.tsx` + `app/propostas/page.tsx` (assinar/recusar/contrapor);
  link "📨" no dashboard (com contagem); PlayerCard mostra o time atual.

### Fase 8 (ligas + campeonatos)
- **Times** (`data/times.ts`): 6 por tier (24 no total) para formar ligas reais. SOLOQ sem liga.
- **Constantes** (`data/liga.ts`): premiação em $/reputação por colocação e tier, `ORDEM_TIER`, `VOCE`.
- **Motor** (`engine/liga.ts`, +`liga.test.ts`): `gerarTemporada` (todos-contra-todos, método do
  círculo), `registrarResultadoJogador` (registra sua partida oficial + simula o resto da rodada IA),
  `proximoConfrontoJogador`, **playoffs top 4** (semis + final), promoção/rebaixamento de tier,
  `premio`, `encerrarTemporada` (premiação + sobe/desce + gera a próxima). `forcaTimeDe` (prestígio
  vira força). **INTERNACIONAL = Mundial 🌍.**
- **Partida oficial:** força do time aliado/adversário entra no motor (`simularPartida` +
  `pesoForcaTimeVitoria`); não mexe no elo de soloq, mas dá XP/reputação/$ e conta na tabela.
- **Store:** `aplicarPartidaOficial`, `sincronizarLiga`, `encerrarTemporadaLiga`; `assinarContrato`
  agora gera a temporada do novo tier.
- **UI:** `components/TabelaLiga.tsx` + `app/liga/page.tsx` (tabela, próximo confronto,
  chaveamento dos playoffs, tela de encerramento); banner "🏆 LIGA" no dashboard; `/draft?oficial=1`
  joga a partida oficial.

### Fase 9 (Auto Patch / meta realista) ✅
- A meta muda a cada **2 semanas** (`patchVigente` definido em `avancarSemana`). `engine/patch.ts`
  balanceia **como a Riot**: ancora levemente na força real (Oracle's Elixir) e a cada patch,
  **POR ROTA**, nerfa os mais fortes e buffa os mais fracos (`porRotaBuff`/`porRotaNerf`) — assim
  **toda rota muda visivelmente** todo patch. Cumulativo e determinístico. **NUNCA mexe nas rotas.**
- **DraftBoard e TierList aplicam o patch** → picks/bans da IA, tier list e força nas partidas
  mudam a cada patch. A **TierList carrega a carreira** (senão o patch caía no fallback) e marca
  **▲ buff / ▼ nerf** nos campeões que mudaram no patch atual. Banner "🧪 PATCH 25.N" no dashboard;
  `app/patch/page.tsx` mostra as patch notes (buffs 🔼 / nerfs 🔽). `data/patch.ts` + `engine/patch.test.ts`.
- **Decisão:** "win rate ao vivo via Riot API" foi descartado — a API oficial da Riot **não expõe
  win rate de campeão** (só sites tipo op.gg, via scraping/ToS). Usamos os dados reais do
  Oracle's Elixir como âncora, que é a fonte confiável e legal.

## Como rodar

> Pré-requisito: Node 18+ instalado na máquina.

```bash
npm install      # 1ª vez
npm run dev      # http://localhost:3000
npm run test     # Vitest (deve passar o dummy)
npm run build    # build de produção
```
