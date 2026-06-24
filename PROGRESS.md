# Progresso — Carreira LoL

## Status das fases
- [x] 0  Setup + base pixel art
- [x] 1  Criação de jogador + dashboard + save
- [x] 2  Banco de campeões
- [x] 3  Draft (pick & ban)
- [ ] 4  Motor de partida + resultado
- [ ] 5  Loop semanal + atividades
- [ ] 6  Economia + equipamentos
- [ ] 7  Reputação + transferências
- [ ] 8  Ligas + campeonatos
- [ ] 9  Auto Patch + win rates reais
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

## Como rodar

> Pré-requisito: Node 18+ instalado na máquina.

```bash
npm install      # 1ª vez
npm run dev      # http://localhost:3000
npm run test     # Vitest (deve passar o dummy)
npm run build    # build de produção
```
