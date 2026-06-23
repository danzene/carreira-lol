## 0. PROTOCOLO DE TRABALHO (leia primeiro — vale pra todas as fases)

Construa o jogo **uma fase por vez**, em ordem, sem pular.

**Ao começar uma fase:** (1) releia `CLAUDE.md` e `PROGRESS.md`; (2) diga o que a fase entrega e **liste os arquivos que vai criar/alterar** — se algo estiver ambíguo, **pergunte antes de codar**; (3) respeite o "Fora do escopo": se precisar de algo de uma fase futura, faça um **stub** e siga.

**Ao terminar uma fase:** (4) garanta que **compila, roda e os testes passam**; (5) atualize o `PROGRESS.md`; (6) me diga **o que dá pra testar agora** e **como rodar**; (7) **PARE e espere minha aprovação.** Não comece a próxima até eu liberar.

**Regras gerais:** uma fase só está pronta quando bate **todo** o "Critério de pronto". Poucos arquivos bem feitos > muitos pela metade. Não refatore fases aprovadas sem avisar o porquê. TypeScript estrito, sem `any` solto. Lógica de jogo separada da UI.

---

## 1. Visão Geral

**Carreira LoL** é um jogo web **em pixel art** de **modo carreira de jogador profissional de League of Legends**. É inspirado no **Teamfight Manager** (simulador de e-sports em pixel art), mas com uma virada de ponto de vista: no TFM você é o **treinador**; aqui você é **um jogador** fazendo carreira. Replicamos os SISTEMAS do TFM (que não têm copyright) e adaptamos pra ótica do jogador — sempre com arte e identidade originais, nada copiado.

Você cria um pro player, começa do zero (subindo na soloq, sem time) e evolui numa **progressão lenta e viciante**: joga partidas, melhora atributos e traços, sobe de elo, ganha reputação, recebe propostas de times melhores, e investe o dinheiro na própria evolução (bootcamp Coreia, coach, periféricos). O objetivo é chegar ao **Tier 1** e ao **Mundial**.

**Dois pilares de design:**
1. **A nota de performance individual importa tanto quanto a vitória do time** — você pode perder e ainda subir de reputação se brilhar. É o que prende o jogador numa carreira individual.
2. **O draft (pick & ban) decide partidas tanto quanto o talento** — um bom draft ganha de um time melhor, um draft ruim perde pra um pior. A meta muda sozinha a cada split (Auto Patch), forçando você a adaptar sua pool.

## 2. Stack & Direção de Arte

- **Next.js (App Router) + TypeScript estrito**, **Tailwind CSS**, **Zustand** (estado), **localStorage** (save, múltiplos slots), **Vitest** (testes do motor).
- **Data Dragon** (`ddragon.leagueoflegends.com`) pra dados/ícones dos campeões reais — grátis, sem chave.
- **Riot API só via API Routes do Next** (chave em `.env.local`) — só na fase de dados reais.

**Pixel art (regras de arte):**
- Renderização em **resolução virtual baixa** (ex.: 384×216) escalada por inteiro com `image-rendering: pixelated`. Nada de blur.
- **Paleta limitada e coesa** definida em CSS vars (tema escuro de e-sports). Fonte bitmap (ex.: "Press Start 2P") só em títulos/HUD; corpo de texto em fonte legível pra não cansar a vista.
- Sprites em PNG/sprite-sheet, animação via CSS `steps()` ou canvas.
- **Arte 100% original.** Começe com placeholders simples (retângulos coloridos / sprites genéricos) e refine depois. Identidade do campeão real aparece pelo **ícone do Data Dragon** na UI de gestão; na batalha, use **sprites genéricos por classe** (um sprite de tank, um de mago, etc.), não arte por campeão.

**Estrutura de pastas:**

```
/app        → rotas e telas (Next)
/components  → UI
/engine      → lógica de jogo PURA (sem React) + testes  ← coração do jogo
/store       → estado Zustand + save/load
/data        → dados estáticos (times, campeões, config de balanceamento)
/public/art  → sprites e assets pixel
```

Regra de ouro: tudo em `/engine` é função pura (estado → estado), testável no Vitest sem UI.

## 3. Modelo de Dados

```ts
type Role  = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";
type Tier  = "SOLOQ" | "AMADOR" | "ACADEMY" | "TIER1" | "INTERNACIONAL";
type Classe = "TANK" | "LUTADOR" | "MAGO" | "ATIRADOR" | "ASSASSINO" | "SUPORTE";

interface Attributes {          // todos 0–100
  mecanica: number; macro: number; laning: number; teamfight: number;
  consistencia: number;         // reduz variância de performance
  mental: number;               // clutch / não tiltar
  comunicacao: number;          // sinergia e shotcalling
  championPool: number;         // versatilidade da pool
}

type TraitId = "ROAMER" | "LANE_BULLY" | "CLUTCH" | "FLEX" | "CARRY_TARDIO"
             | "AGRESSIVO" | "TILTAVEL" | "FRIO" | "SHOTCALLER" /* ... */;

interface ChampionDef {         // campeão real mapeado p/ o motor
  id: string;                   // id do Data Dragon
  nome: string;
  classes: Classe[];
  rolesValidas: Role[];
  perfil: { dano: number; resistencia: number; cc: number; mobilidade: number; sustain: number };
  forcaMetaBase: number;        // ajustada pelo Auto Patch (win rate)
}

interface ChampionMastery { championId: string; pontos: number; } // 0–100

interface Player {
  nome: string; nacionalidade: string; idade: number;
  rota: Role; atributos: Attributes;
  pool: ChampionMastery[]; tracos: TraitId[];
  reputacao: number;            // define as propostas que chegam
  rankSoloq: { elo: string; lp: number; mmr: number };
  energia: number; moral: number;
}

interface Equip { tipo: "HEADSET"|"MOUSE"|"CADEIRA"|"MONITOR"; nivel: number; bonus: Partial<Attributes>; }
interface Contract { timeId: string; salarioSemanal: number; bonusPorVitoria: number; semanasRestantes: number; tier: Tier; }
interface Offer { timeId: string; tier: Tier; salarioSemanal: number; bonusPorVitoria: number; duracaoSemanas: number; condicao?: string; }

interface MatchResult {
  vitoria: boolean;
  kda: { k: number; d: number; a: number };
  notaPerformance: number;      // 0–10 individual — move reputação
  csPorMin: number;
  championId: string;
  lpDelta?: number;
  xpGanho: Partial<Attributes>;
  log: string[];                // narração da batalha p/ o viewer
}

interface CareerState {
  player: Player; dinheiro: number; equipamentos: Equip[];
  contratoAtual: Contract | null;
  semanaAtual: number; temporada: number; tierAtual: Tier;
  historicoPartidas: MatchResult[]; inbox: Offer[];
  patchVigente: number;         // win rates mudam a cada split
}
```

## 4. Sistemas de Jogo — adaptação do Teamfight Manager

| Sistema do TFM | Como vira na Carreira LoL |
|---|---|
| Pick & Ban (coração do jogo) | Você participa do draft do seu time: marca comfort picks, banes e counter-picks. Sua **voz no draft cresce com a reputação** (novato segue o coach; veterano decide). |
| Partida auto-battle (você não controla) | Igual: a partida se resolve sozinha. O foco é a **sua performance individual** dentro da luta 5v5. |
| Campeões: classes + skill + ult | Campeões REAIS (Data Dragon) mapeados em `ChampionDef` com classe e perfil simplificado. |
| Stats de jogador + traços | Seus `atributos` + `tracos`. Traços dão efeitos no motor (ex.: ROAMER melhora macro fora da rota; TILTAVEL aumenta variância negativa). |
| Treino especial / alteração mental | Ações semanais: treino especial (boost grande / aprender campeão) e alteração mental (ganhar/trocar traço). |
| Streaming | Atividade semanal: renda extra gastando energia, cresce com fama. |
| Transferências / contratos / contraproposta | Propostas na inbox (salário base + bônus por vitória + duração). Você **negocia e contrapropõe**. Agentes livres = times menores. |
| Instalações / patrocinadores | Instalações do time afetam sua **velocidade de treino**; patrocínios pessoais e stream são sua renda extra ao ficar famoso. |
| Crafting de equipamento (headset/cadeira...) | Crafting/upgrade de **periféricos pessoais** que dão bônus de atributo. |
| **Auto Patch** (balance por win rate) | Win rates dos campeões mudam a cada split (sintético no MVP, **Riot API real** depois). A meta muda sob seus pés — adapte a pool. |
| Ligas (Amadora→Mundial) | SOLOQ → AMADOR → ACADEMY → TIER1 → INTERNACIONAL. |
| Sistema de táticas | Você define sua **playstyle** e influencia a tática do time por senioridade. |
| Opções de novo jogo (Fearless, Hide Attributes, tempo de ban-pick, dificuldade) | Opções na criação de carreira. |
| Event matches | Partidas de exibição por dinheiro/reputação. |

**Motor de simulação** (`engine/`): função pura. Força do jogador na partida = atributos da rota + maestria no campeão + força do time + **força da comp (resultado do draft)**, com **variância controlada por consistência/mental e modificada por traços**. A nota de performance (0–10) pode ser alta mesmo em derrota.

## 5. Equação do motor (referência)

```
forcaRota    = média ponderada dos atributos relevantes pra Role
forcaCampeao = maestria no campeão + forcaMetaBase do campeão (Auto Patch)
forcaComp    = sinergia + counters do draft (pick & ban)
base         = 0.35*forcaRota + 0.25*forcaCampeao + 0.20*forcaTime + 0.20*forcaComp
tracos       = aplicam modificadores (ex.: CLUTCH melhora em desvantagem; TILTAVEL piora variância)
ruido        = aleatório, amplitude REDUZIDA por consistencia/mental
forcaFinal   = clamp(base + tracos + ruido, 0, 100)
vitoria      = forcaFinal do time vs inimigo (chance proporcional à diferença)
nota(0–10)   = forcaFinal relativa à expectativa (pode ser alta em derrota)
```

Pesos e fórmulas exatas vão num arquivo de config em `/data` pra balancear fácil.

## 6. AS FASES (uma de cada vez, em ordem)

### FASE 0 — Setup + base de pixel art
- **Objetivo:** projeto rodando, vazio, com base e direção de arte no lugar.
- **Escopo:** Next+TS estrito+Tailwind+Zustand+Vitest; estrutura de pastas; pipeline de pixel art (resolução virtual escalada, `image-rendering: pixelated`, paleta em CSS vars, fonte bitmap); salvar `CLAUDE.md` e criar `PROGRESS.md`; tela inicial "Carreira LoL" estilo retrô com botão "Nova Carreira"; um teste Vitest dummy.
- **Fora do escopo:** qualquer lógica de jogo.
- **Pronto:** `npm run dev` abre a home pixel art sem erro; `npm run test` passa; `CLAUDE.md`/`PROGRESS.md` existem.

### FASE 1 — Criação de jogador + dashboard + save
- **Escopo:** criação (nome, nacionalidade, rota, distribuir atributos, escolher 1 traço inicial, 2–3 campeões via Data Dragon); inicializar `CareerState`; save/load localStorage múltiplos slots; dashboard (atributos, traços, pool, dinheiro, semana, rank, energia/moral).
- **Fora do escopo:** simular partidas, draft, loop semanal, economia.
- **Pronto:** cria jogador → aparece no dashboard → recarregar mantém → 2+ saves.

### FASE 2 — Banco de campeões (classes + perfis + tier list)
- **Escopo:** importar campeões do Data Dragon; mapear em classe(s)/rolesValidas/perfil (config em `/data`, editável); `forcaMetaBase` sintética; tela de tier list por rota.
- **Fora do escopo:** draft, simulação, win rate real.
- **Pronto:** banco consultável com classe/role/perfil; tier list renderiza.

### FASE 3 — Draft (Pick & Ban)
- **Escopo:** fluxo bans→picks 5v5 (ordem correta); IA simples de coach/inimigo; comfort picks; counter-picks, sinergia, prioridade; cálculo de `forcaComp`; influência no draft escala com reputação.
- **Fora do escopo:** resolução da partida (Fase 4), Fearless/Hide (depois).
- **Pronto:** completar um draft 5v5 coerente e ver a força de comp.

### FASE 4 — Motor de partida (auto-battle) + tela de resultado
- **Escopo:** `engine/simularPartida.ts` puro + testes (vitória/derrota, variância, traços, XP); usa o draft da Fase 3; tela de partida com pixel simples (sprites por classe + timeline + log); tela de resultado (KDA, nota, cs/min); aplicar efeitos (elo/LP, XP, histórico).
- **Fora do escopo:** auto-battle animado caprichado (Fase 10), win rate real.
- **Pronto:** jogar partidas, ver resultado coerente e progressão; testes passam.

### FASE 5 — Loop semanal + atividades
- **Escopo:** calendário (semana/temporada); energia; ações: soloq, treino focado, treino especial, streaming, alteração mental, descansar; ganho de atributos/traços; "avançar semana".
- **Pronto:** avançar semanas alternando atividades e ver evolução.

### FASE 6 — Economia + equipamentos (crafting)
- **Escopo:** salário + bônus por vitória (contrato stub); loja (bootcamp, coach, mental/nutri); crafting/upgrade de periféricos com bônus; streaming como renda; tensão de "sempre falta um pouco".
- **Pronto:** ganhar/gastar; cada investimento e equipamento com efeito visível.

### FASE 7 — Reputação + transferências + contratos
- **Escopo:** times fictícios por tier (`/data`); reputação; geração de `Offer`; negociação e contraproposta (salário + bônus + duração); agentes livres; janela de transferência; assinar muda tier/salário; instalações afetam treino.
- **Pronto:** receber propostas coerentes, negociar e assinar um time melhor.

### FASE 8 — Ligas + campeonatos
- **Escopo:** ligas Amadora→Mundial; calendário oficial (regular + playoffs); premiação; promoção/rebaixamento; acesso ao Internacional/Mundial no Tier 1.
- **Pronto:** jogar uma temporada inteira e ganhar título.

### FASE 9 — Auto Patch + win rates reais (Riot API)
- **Escopo:** Auto Patch reajusta `forcaMetaBase` a cada split; win rate via API Route (chave em `.env.local`) — **fonte exata será passada aqui**; motor pronto pra alternar sintético/real; tela de "patch notes".
- **Pronto:** o split novo muda a meta e afeta drafts/resultados.

### FASE 10 — Auto-battle pixel art animado
- **Escopo:** viewer animado da luta 5v5 (sprites por classe, skills/ult, kills, HUD pixel) dirigido pelo `log` do motor; velocidade/pular; foco no seu jogador.
- **Fora do escopo:** mudar a lógica (só visualiza).
- **Pronto:** assistir a partida animada batendo com o resultado.

### FASE 11 — Opções de novo jogo + event matches
- **Escopo:** opções na criação (dificuldade, Fearless Ban/Pick, Hide Attributes com revelação gradual, tempo de ban-pick); event matches por dinheiro/reputação.
- **Pronto:** as opções funcionam e mudam a experiência.

### FASE 12 — Polimento
Balanceamento (progressão lenta e gostosa), eventos aleatórios, conquistas, áudio chiptune leve, refino de UI e saves.

## 7. (reservado)
## 8. (reservado)

## 9. PROGRESS.md — ver arquivo separado.

## 10. Infra mantida do protótipo anterior
O jogo anterior (não-pixel) está preservado no branch git `prototipo-v0`. Mantida e reaproveitável: deploy na Vercel (`carreira-lol.vercel.app`), Supabase + login/contas na nuvem (`store/authStore.ts`, `cloudSync.ts`, `saves.ts`, `components/AuthGate.tsx`/`TelaLogin.tsx`, migration `user_saves`), `lib/ddragon.ts`, `lib/supabaseClient.ts`, `engine/rng.ts`. O login será re-skinado (pixel) e religado quando a criação/save voltar.
