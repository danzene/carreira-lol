# Carreira LoL — Documento de Contexto do Projeto

> Visão completa do jogo (conceito, design, mecânicas e arquitetura) para dar contexto a
> uma IA ou a um novo dev. **Estado atual / fonte da verdade** — atualizado após o ciclo de
> arte real, CoinPoints, progressão por tempo real e login. Em PT-BR.

---

## 1. O que é o jogo

**Carreira LoL** é um jogo **web, em pixel art**, de **carreira de jogador profissional de
League of Legends**. Inspirado no **Teamfight Manager** (simulador de e-sports), mas com a
ótica invertida: você **não é o treinador, é o JOGADOR**. Arte e identidade são originais;
nomes/ícones de campeões reais vêm do Data Dragon da Riot (uso livre).

Você cria um pro player do zero (soloq, **começa em Ferro IV, sem time**) e evolui numa
progressão **lenta e viciante** estilo *Punch Club* + jogo mobile de stamina: joga partidas,
melhora atributos/traços, sobe de elo, ganha reputação, recebe propostas de times, investe
o dinheiro na própria evolução e sobe de tier até o **Mundial**.

**Dois pilares de design (inegociáveis):**
1. **A nota individual (0–10) importa tanto quanto a vitória** — dá pra perder a partida e
   ainda subir de reputação se você brilhar.
2. **O draft (pick & ban) decide partidas tanto quanto o talento** — bom draft ganha de
   time melhor; a meta muda a cada split (Auto Patch), forçando adaptação da pool.

**No ar:** https://carreira-lol.vercel.app · **Repo:** github.com/danzene/carreira-lol
(deploy automático a cada `git push` na branch `main`).
**Pasta local:** `C:\Users\User\Desktop\Carreira LoL`.

---

## 2. Stack & Arquitetura

- **Next.js 14 (App Router)** + **TypeScript estrito** (`noUnusedLocals`/`noUnusedParameters`,
  sem `any` solto) + **Tailwind CSS** + **Zustand** (estado) + **Vitest** (testes do motor; ~97).
- **Supabase** — autenticação (email/senha + Google OAuth) e save na nuvem (tabela `user_saves`).
- **Data Dragon** (`ddragon.leagueoflegends.com`, locale pt_BR) — ícones/nomes/dados dos
  campeões reais (grátis, sem chave).
- **Oracle's Elixir** — CSV de pro play processado offline (`scripts/processar-oe.mjs` →
  `data/champions-oe.json`) dá rotas e força reais dos campeões.
- **Save:** `localStorage` multi-slot, namespaceado por usuário; sincronizado com o Supabase.

**Regra de ouro da arquitetura:** tudo em `/engine` é **função pura** (estado → estado),
testável no Vitest sem UI. A UI (React) nunca contém regra de jogo.

```
/app         → rotas/telas (Next App Router)
/components  → UI (React)
/engine      → lógica de jogo PURA + testes (o coração)
/store       → Zustand + save/load + auth + cloud sync
/data        → dados estáticos e balanceamento (constantes editáveis)
/lib         → ddragon, supabaseClient
/public/carreira → assets de arte reais (cards, holo, ícones, vídeos)
```

---

## 3. Direção de arte / Design visual

- **Pixel art**, tema escuro neon de e-sports. Paleta em CSS vars / Tailwind:
  - `fundo #0b0617` · `painel #15102a` · `borda #2a2150`
  - `rosa #ff2d7e` (primária) · `ciano #19e6e0` (acento) · `texto #ece8ff` · `suave #9a90c0`
- **Fonte bitmap "Press Start 2P"** (`next/font`, classe `font-pixel`) só em títulos/HUD;
  corpo de texto em fonte do sistema (legível).
- `image-rendering: pixelated` global; arte em alta resolução usa `.img-hd` (downscale suave).

**Assets reais (feitos pelo usuário, em `public/carreira/`):**
- `cards/<id>.jpg` — **cartas das Lendas**, 832×1248 (proporção 2:3), com **a moldura por
  raridade já embutida** (Prata=cinza, Lendária=rosa com gemas, Mítica=ouro com estrelas).
- `holo.png` — retícula holográfica arco-íris; overlay animado (CSS `.holo-sheen`,
  `mix-blend-mode: color-dodge` + `hue-rotate`) nas cartas raras (raridade ≥ 5).
- `icones/<acao>.png` — ícones das ações Treino/Especial/Stream/Mental (no painel da semana).
- `tarefas/<acao>.mp4` — **vídeos** que tocam ao executar cada ação (substituíram animações
  em canvas).
- A **animação de abertura do Carreira Booster** é recriada em Canvas seguindo storyboards de
  6 fases (convergência → pulsação → explosão → dispersão → resíduos → sumiço), com
  cor/intensidade por raridade.

---

## 4. Modelo de dados (resumo — ver `engine/types.ts`)

```ts
type Role  = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";
type Tier  = "SOLOQ" | "AMADOR" | "ACADEMY" | "TIER1" | "INTERNACIONAL";
type Classe = "TANK" | "LUTADOR" | "MAGO" | "ATIRADOR" | "ASSASSINO" | "SUPORTE";

interface Attributes {          // todos 0–100
  mecanica; macro; laning; teamfight;
  consistencia;                 // reduz variância de performance
  mental;                       // clutch / não tiltar
  comunicacao;                  // sinergia e shotcalling
  championPool;                 // versatilidade
}

interface RankSoloq { elo: string; lp: number; mmr: number; streak?: number; }
interface ChampionMastery { championId: string; pontos: number; } // 0–100

interface Player {
  nome; nacionalidade; idade; rota: Role; atributos: Attributes;
  pool: ChampionMastery[]; tracos: TraitId[];
  reputacao;                    // define as propostas que chegam
  rankSoloq: RankSoloq; energia; moral;
}

interface CareerState {
  player; dinheiro; equipamentos; contratoAtual;
  semanaAtual; temporada; tierAtual; historicoPartidas; inbox; patchVigente;
  opcoes?;                      // modos (imersão/fearless) — NÃO há mais dificuldade
  liga?; torneioAtual?; titulosInternacionais?;
  eventoAtual?; conquistas?;
  // progressão por tempo real:
  energiaEm?; avancosEm?: number[]; descansosEm?: number[];
  cargasPartida?; cargasEm?;
  // Carreira Booster (gacha):
  scoutPontos?;                 // = CoinPoints (nome interno mantido p/ não quebrar saves)
  lendas?; lendasEquipadas?; pity?;
}
```

---

## 5. Mecânicas (estado atual, detalhado)

### 5.1 Criação de jogador
Wizard: **Identidade** (nome, nacionalidade, rota) → **Atributos** (distribui 80 pontos,
base 40, teto 75) → **Traço** (1 inicial) → **Campeões** (3 da pool, via Data Dragon) →
**Ajustes** (2 toggles: 🙈 Esconder atributos / ⚔️ Fearless). Começa em **Ferro IV** e com
**0 CoinPoints**.

### 5.2 Atributos e traços
8 atributos (0–100). Traços (`TraitId`): ROAMER, LANE_BULLY, CLUTCH, FLEX, CARRY_TARDIO,
AGRESSIVO, TILTAVEL, FRIO, SHOTCALLER — efeitos no motor (ex.: CLUTCH melhora em
desvantagem; TILTAVEL aumenta variância negativa; FRIO reduz variância). Máx. 3 traços
(ganha mais via "Mental" no loop).

### 5.3 Jogo é LINEAR (sem dificuldade)
A **dificuldade (Fácil/Normal/Difícil) foi REMOVIDA de propósito** — a ideia é uma
experiência linear. Restam só os modos imersão (esconder atributos) e fearless. Internamente
existe um `mod()` neutro (multiplicadores = 1) só para não quebrar call-sites.

### 5.4 Progressão por tempo real (stamina estilo mobile) — central
Tudo que tem recarga **conta em tempo real, online E offline** (baseado em timestamps no save):
- **Energia:** máx. 100, **regenera de 0→100 em 2 horas reais** (~+1 a cada 72s). Ações
  custam energia: soloq 15, treino focado 20 (+1 atributo), treino especial 35 (+3),
  streaming 15 (+$60/+reputação), mental 40 (ganha traço).
- **Avançar a semana:** dá **+50 de energia**, limitado a **2× a cada 4h**. **Descansar a
  semana:** enche a energia (100) + moral, também **2× a cada 4h** (contadores separados).
  Timers ao vivo na barra de energia ("cheia em mm:ss") e embaixo dos botões.
- **Decaimento (Punch Club):** sem treinar, os atributos caem ~0.25/semana — precisa manter.
- **Cargas de partida de campeonato:** liga e torneio **NÃO gastam energia** — usam "cargas":
  máx **3**, **+1 a cada 10 min** (3 = 30 min). Mostradas como 3 barrinhas com timer.
- Os "relógios" (`energiaEm`/`cargasEm`) são inicializados ao criar e ao carregar a carreira,
  garantindo a contagem offline.

### 5.5 Partidas, draft e auto-battle
- **Soloq** (via dashboard → `/draft`): gasta energia, mexe no elo.
- **Draft Pick & Ban:** ordem oficial (6 bans, 6 picks, 4 bans, 4 picks); IA de coach/inimigo;
  comfort picks (sua pool ★); cálculo de `forcaComp` (sinergia + counters). **Sua voz no draft
  cresce com a reputação** (novato segue o coach; veterano decide).
- **Motor de partida** (`engine/simularPartida.ts`, PURO): `base = 0.35·forcaRota +
  0.25·forcaCampeao + 0.20·forcaTime + 0.20·forcaComp`; soma traços + ruído (reduzido por
  consistência/mental) + bônus de periféricos. Gera vitória, **nota 0–10** (alta até em
  derrota), KDA, cs/min, XP, lpDelta e um `log[]` narrado.
- **Auto-battle pixel animado** (`components/BatalhaCanvas.tsx`): Summoner's Rift estilizada
  em Canvas, 5v5 de sprites, minions, projéteis, torres caindo, Nexus explodindo, kill feed,
  placar — dirigido pelo `log` do motor. Botões de velocidade/pular. É um pilar do jogo.

### 5.6 Elo / MMR (estilo LoL) com visual de progressão
- Ladder Ferro IV → Desafiante (31 divisões). **MMR** drive o elo: base 800, +100 por divisão.
  Começa em Ferro IV (MMR 800). Só **soloq** mexe no elo (oficial/torneio têm lpDelta 0).
- Ganho de PDL ajustado pelo MMR do oponente (ganha mais contra MMR alto).
- **Sequências (streak):** a partir da 2ª vitória seguida, cada vitória dá **+3 PDL** extra
  (teto +12) → em chama você sobe rápido (~+32). Derrotas seguidas tiram mais. Vitória zera a
  sequência de derrotas e vice-versa.
- **Card visual de progressão** (`components/ProgressaoElo.tsx`): emblema por tier (cor +
  divisão), barra de PDL com "faltam X pra subir", trilha dos próximos elos, % geral da
  escalada Ferro→Desafiante, e selo de sequência (🔥/❄️).

### 5.7 Ligas e circuito mundial
- Tiers: **SOLOQ → AMADOR → ACADEMY → TIER1 → INTERNACIONAL**. Temporada = **26 semanas**.
- **Regiões reais** (`data/regioes.ts`): CBLOL (Brasil), LCK (Coreia), LEC (Europa),
  LCS (NA), LPL (China) — 6 times reais cada; a nacionalidade define a região.
- Liga: todos-contra-todos → **playoffs top 4** → premiação → **promoção/rebaixamento**.
- **MSI + Worlds** (`engine/internacional.ts`, `app/torneio/page.tsx`): campeão da liga Tier 1
  se classifica → bracket internacional (grupos + mata-mata) → títulos.

### 5.8 Carreira Booster (o gacha — antes "Scout Gacha")
Moeda: **CoinPoints** (🪙) — ganha jogando (vitória +10, derrota +5) e ao avançar a semana
(+40). **Começa em 0.** A UI **não usa mais a palavra "GACHA"** — chama-se **Carreira Booster**.
- **Cartas de Lenda:** 19 arquétipos originais (O Imortal, O Rei do Mid, A Mente, etc.), cada
  um com arte 2:3 própria. Puxada 1× (100) / 10× (900). Raridades:
  **6★ Mítica 0,01%** · **5★ Lendária 0,5%** · **4★ Ouro 10%** · **3★ Prata** (resto).
  **Pity:** 5★+ garantido em 100 puxadas. Substats aleatórios (caçar o "roll perfeito");
  duplicata sobe de nível (até 5). Equipar até 3 lendas dá efeitos (atributos, XP, dinheiro,
  anti-decaimento, draft) + **sinergias** por estilo. Holo nas raras; Mítica tem brilho extra
  e dá uma conquista.
- **Cartas de Campeão:** puxa um campeão (Data Dragon) por 60 CoinPoints; entra na sua pool e
  ganha maestria (novo 25 / repetido +15). Campeões meta fortes são mais raros.
- Abertura com animação por raridade + revelação das cartas.

### 5.9 Economia, transferências, Auto Patch, polimento
- **Economia:** salário semanal + bônus por vitória (contrato); **loja** (sessão mental,
  coach por assinatura, bootcamp Coreia); **crafting de periféricos** (headset/mouse/cadeira/
  monitor) com bônus que entra na partida.
- **Transferências:** times fictícios + reais por tier; reputação sobe pela nota; ofertas na
  inbox; **assinar / contrapropor / recusar**.
- **Auto Patch** (`engine/patch.ts`): a cada 2 semanas a meta muda (nerfa fortes / buffa
  fracos, ancorado no Oracle's Elixir, nunca muda rotas); página de patch notes.
- **Polimento:** conquistas (`/conquistas`), eventos aleatórios de carreira, **resumo da
  semana** (modal ao avançar), **histórico de partidas** no dashboard.

---

## 6. Autenticação & nuvem
- **Login obrigatório** (o `AuthGate` envolve o app no `layout`): email/senha **+ Entrar com
  Google** (Supabase OAuth). A tela de login usa o logo pixel "CARREIRA LoL".
- Save por usuário (`user_saves`); ao logar pela 1ª vez, a carreira anônima é migrada pra conta.
- Variáveis no Vercel: `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (sem elas,
  o app mostra "Supabase não configurado").

---

## 7. Monetização (planejado) & restrição de segurança
As **CoinPoints serão monetizadas** no futuro. **Hoje a moeda é 100% client-side** (localStorage
+ cloud sync só guarda o blob), então é **trivialmente burlável** — não serve pra dinheiro real.
**Antes de monetizar é obrigatório** migrar pra **backend autoritativo**: saldo no servidor,
ganho/gasto/puxada validados no servidor (RNG do gacha no servidor), compra via Stripe/IAP com
verificação de recibo, remover qualquer cheat de teste, e divulgar as chances do gacha (loot box).
Regra: **o cliente nunca decide saldo/recompensa**.

---

## 8. Modo Online (planejado, ADITIVO — não atrapalha o single-player)
Construído sobre o Supabase. Princípio: servidor é a fonte da verdade; o PvP usa um **snapshot**
do jogador (não mexe no save da carreira).
- **Fase A:** login Google (✅ feito) + tabela `profiles` (nick, moldura de avatar, saldo
  CoinPoints no servidor).
- **Fase B:** amigos/convites + **desafio 1v1** (auto-battle determinístico, rodado/validado no
  servidor via Edge Function).
- **Fase C:** **campeonatos entre pessoas** valendo CoinPoints + **cards de evento** + **molduras**.

---

## 9. Como rodar / deploy
```
npm install
npm run dev      # localhost:3000
npm run build    # build de produção (type-check estrito) — precisa passar antes do push
npx vitest run   # testes (~97)
```
- Node v24 disponível no ambiente local. **Sempre rodar `npm run build` + testes antes de
  `git push`** (o build do Next pega erros de tipo que quebram o deploy do Vercel). Depois de
  buildar localmente, apagar `.next` (senão quebra o `npm run dev`).
- Deploy: push na `main` → Vercel builda e publica. Se o build falhar, o Vercel **mantém o
  deploy anterior** (parece que "não atualizou").

---

## 10. Mapa de arquivos-chave
```
engine/  types.ts · rng.ts · player.ts · champions.ts · draft.ts · simularPartida.ts
         elo.ts · tempo.ts (energia/cargas por tempo real) · loop.ts · economia.ts
         transferencias.ts · liga.ts · internacional.ts · patch.ts · batalha.ts
         eventos.ts · acontecimentos.ts · conquistas.ts · gacha.ts (Carreira Booster)  (+ *.test.ts)
data/    config.ts · simulacao.ts · loop.ts · economia.ts · opcoes.ts · elo.ts (cores de tier)
         champions.ts · champions-oe.json (gerado) · times.ts · regioes.ts · gacha.ts
         internacional.ts · batalha.ts
store/   careerStore.ts (estado+ações) · saves.ts · authStore.ts · cloudSync.ts
components/ CriacaoWizard · PlayerCard · ProgressaoElo · PainelSemana · PartidaCampeonato
            DraftBoard · Partida · BatalhaCanvas · ResultadoPartida · AnimacaoAcao (vídeo)
            AnimacaoGacha · TabelaLiga · Loja · Inbox · HistoricoPartidas · ResumoSemanaModal
            AuthGate · TelaLogin · IconeRota · BarraAtributo · SeletorCampeoes/Traco · EditorAtributos
app/     page.tsx (home) · criar · dashboard · draft · liga · torneio · gacha (Carreira Booster)
         loja · propostas · campeoes (tier list) · conquistas · patch · layout (AuthGate)
public/carreira/ cards/<id>.jpg · holo.png · icones/<acao>.png · tarefas/<acao>.mp4
```

---

## 11. Status atual
Jogo single-player **completo e jogável** (criação → loop → partidas → ligas → mundial →
Carreira Booster), com arte real, progressão por tempo real, elo com sequências e **login
(email/senha + Google)** ativo. Em produção no Vercel. **Próximo grande bloco:** modo online
(Fase A: perfis + saldo no servidor) e a migração da moeda pra backend autoritativo (pré-requisito
da monetização).
