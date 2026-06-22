## 0. PROTOCOLO DE TRABALHO (leia primeiro — vale pra todas as fases)

Você vai construir este jogo **uma fase por vez**, em ordem, sem pular. Siga este protocolo à risca:

**Ao começar uma fase:**
1. Releia `CLAUDE.md` e `PROGRESS.md` antes de escrever qualquer código.
2. Diga em 2–3 linhas o que essa fase entrega e **liste os arquivos que vai criar/alterar**. Se algo no escopo estiver ambíguo, **pergunte antes de codar**.
3. Respeite o "Fora do escopo" da fase. Se você sentir que precisa de algo de uma fase futura, **crie um stub mínimo** (placeholder) e siga — não construa a fase futura agora.

**Ao terminar uma fase:**
4. Rode o que der pra rodar (testes, build) e garanta que **compila e roda sem erro**.
5. Atualize o `PROGRESS.md`: marque a fase como concluída e anote decisões importantes tomadas.
6. Me diga **exatamente o que eu consigo testar agora** e **como rodar localmente** (comandos).
7. **PARE e espere minha aprovação.** Não comece a próxima fase até eu dizer "fase aprovada" / "próxima". Se eu pedir ajustes, ajuste e pare de novo.

**Regras gerais:**
- Uma fase só está "pronta" quando bate **todos** os itens do "Critério de pronto".
- Prefira poucos arquivos bem feitos a muitos arquivos pela metade.
- Não refatore coisas de fases já aprovadas sem me avisar o motivo.
- TypeScript estrito, sem `any` solto. Lógica de jogo separada da UI.

---

## 1. Visão Geral (vai pro CLAUDE.md)

**Carreira LoL** é um jogo web de **modo carreira de jogador profissional de League of Legends** — inspirado no Modo Carreira do FIFA / Master League do PES, mas no esports de LoL.

Você cria um pro player, começa do zero (subindo na soloq, sem time), e evolui numa **progressão lenta e viciante**: joga partidas, melhora atributos, sobe de elo, ganha reputação, recebe propostas de times cada vez melhores com salários melhores, e investe o dinheiro na própria evolução (bootcamp na Coreia, coach, soloq). O objetivo é sair da base e chegar ao **Tier 1** e às competições internacionais (MSI / Worlds).

Pilar de design: **a nota de performance individual importa tanto quanto a vitória do time** — você pode perder a partida e ainda subir de reputação se jogou bem, como na vida real. É isso que prende o jogador.

## 2. Stack & Estrutura (vai pro CLAUDE.md)

- **Next.js (App Router) + TypeScript estrito**
- **Tailwind CSS** (tema escuro de esports, mobile-first, bonito — use o skill `frontend-design` como régua de qualidade)
- **Zustand** pro estado global
- **localStorage** pra save (single player, múltiplos slots) no MVP
- **Data Dragon** (`ddragon.leagueoflegends.com`) pra campeões/imagens — grátis, sem chave
- **Riot API só via API Routes do Next** (chave em `.env.local`, nunca no client) — só na Fase 7
- **Vitest** pra testar o motor de jogo

Estrutura de pastas:

```
/app          → rotas e telas (Next)
/components    → componentes de UI
/engine        → lógica de jogo PURA (sem React) + testes
/store         → estado Zustand + save/load
/data          → dados estáticos (times fictícios, config de balanceamento)
```

Regra de ouro: tudo em `/engine` é função pura (recebe estado → retorna estado), zero dependência de React ou browser. Dá pra testar no Vitest sem UI.

## 3. Modelo de Dados (vai pro CLAUDE.md)

```ts
type Role = "TOP" | "JUNGLE" | "MID" | "ADC" | "SUPPORT";
type Tier = "SOLOQ" | "AMADOR" | "ACADEMY" | "TIER1" | "INTERNACIONAL";

interface Attributes {          // todos 0–100
  mecanica: number;             // micro, combos, mira
  macro: number;                // mapa, rotação, objetivos
  laning: number;               // fase de rotas, wave management
  teamfight: number;            // posicionamento e impacto em luta
  consistencia: number;         // reduz variância de performance
  mental: number;               // clutch, não tiltar, jogo sob pressão
  comunicacao: number;          // sinergia/shotcalling com o time
  championPool: number;         // versatilidade da pool
}

interface ChampionMastery { championId: string; pontos: number; } // 0–100

interface Player {
  nome: string; nacionalidade: string; idade: number;
  rota: Role;
  atributos: Attributes;
  pool: ChampionMastery[];
  reputacao: number;            // 0–100, define as propostas que chegam
  rankSoloq: { elo: string; lp: number; mmr: number };
  energia: number;              // 0–100, gasta treinando
  moral: number;                // 0–100, afeta performance
}

interface Contract { timeId: string; salarioSemanal: number; semanasRestantes: number; tier: Tier; }

interface MatchResult {
  vitoria: boolean;
  kda: { k: number; d: number; a: number };
  notaPerformance: number;      // 0–10 (MVP individual) — move reputação
  csPorMin: number;
  championId: string;
  lpDelta?: number;             // se soloq
  xpGanho: Partial<Attributes>;
}

interface Offer { timeId: string; tier: Tier; salarioSemanal: number; duracaoSemanas: number; condicao?: string; }

interface CareerState {
  player: Player;
  dinheiro: number;
  contratoAtual: Contract | null;
  semanaAtual: number;
  temporada: number;
  historicoPartidas: MatchResult[];
  inbox: Offer[];
}
```

## 4. Sistemas de Jogo (vai pro CLAUDE.md)

- **Loop semanal:** o tempo avança em semanas. Por semana o jogador gasta energia entre: jogar **soloq**, **treino** (foca 1 atributo), **scrims** (se tem time, melhora comunicação), **descansar** (recupera energia/moral), e **investir dinheiro**.
- **Motor de simulação** (`engine/simularPartida.ts`): função pura. Força do jogador na partida = atributos relevantes da rota + maestria no campeão + força do time + força da comp, com **variância controlada por `consistencia` e `mental`**. Compara com o inimigo. A **nota de performance** (não só o W/L) é o que move reputação.
- **Economia:** salário semanal entra se tiver contrato (cresce com tier e reputação). Gastos: **bootcamp Coreia** (boost grande temporário, caro, consome semanas), **coach** (XP passivo), **setup** (pequeno boost permanente de mecânica), **coach mental/nutri** (recupera moral/energia), **stream** (renda extra, gasta energia). Equilíbrio: que sempre falte um pouco de dinheiro — cada escolha deve doer.
- **Reputação & propostas:** reputação sobe com boas notas, subida de elo e títulos. Periodicamente, times mandam `Offer` pra inbox conforme a reputação (tiers altos exigem reputação alta). Aceitar/recusar contratos é a progressão macro.
- **Tiers:** SOLOQ → AMADOR → ACADEMY → TIER1 → INTERNACIONAL. Com time há temporada regular + playoffs; vencer dá dinheiro, reputação e acesso a internacionais.

---

## 5. AS FASES (ordens de serviço — siga em ordem, uma de cada vez)

### FASE 0 — Setup do projeto
**Objetivo:** projeto rodando, vazio mas com a base toda no lugar.
**Entra no escopo:**
- Criar Next + TS estrito + Tailwind + Zustand + Vitest.
- Estrutura de pastas da seção 2.
- Salvar `CLAUDE.md` (seções 1–4) e criar `PROGRESS.md` (modelo da seção 7).
- Tela inicial: título "Carreira LoL", tema escuro de esports, botão "Nova Carreira" (sem ação ainda) e um teste de Vitest dummy passando.
**Fora do escopo:** qualquer lógica de jogo, criação de jogador, dados de campeão.
**Critério de pronto:** `npm run dev` abre a tela inicial sem erro; `npm run test` passa; `CLAUDE.md` e `PROGRESS.md` existem.
**Como vou testar:** abrir a home e ver o título + botão; rodar os testes.

### FASE 1 — Criação de jogador + dashboard + save
**Objetivo:** criar um personagem e ver o dashboard da carreira, com save funcionando.
**Entra no escopo:**
- Fluxo de criação: nome, nacionalidade, rota, distribuir pontos de atributo, escolher 2–3 campeões da pool.
- Carregar a lista de campeões do **Data Dragon** (cacheada) com ícones.
- Inicializar `CareerState` (elo baixo, pouco dinheiro, sem time).
- Save/load em localStorage com **múltiplos slots**.
- Dashboard: card do jogador (atributos, rota, pool), dinheiro, semana, rank, energia/moral.
**Fora do escopo:** simular partidas, loop semanal, economia, propostas.
**Critério de pronto:** dá pra criar um jogador, ele aparece no dashboard, recarregar a página mantém o save, dá pra ter 2+ saves.
**Como vou testar:** criar um jogador, fechar e reabrir a aba, ver que persistiu.

### FASE 2 — Motor de simulação + jogar soloq
**Objetivo:** jogar uma partida de soloq e ver o resultado.
**Entra no escopo:**
- `engine/simularPartida.ts` puro + **testes Vitest** cobrindo: vitória/derrota, variância por consistência/mental, ganho de XP.
- UI: na dashboard, botão "Jogar Soloq" → escolher campeão da pool → **tela de draft simplificada** (seu pick + aliados/inimigos gerados) → **tela de resultado** (KDA, nota 0–10, cs/min).
- Aplicar efeitos: atualizar elo/LP, XP nos atributos, histórico de partidas.
**Fora do escopo:** picks/bans completos, win rates reais, calendário semanal, dinheiro.
**Critério de pronto:** dá pra jogar várias soloq seguidas; elo e atributos evoluem; existem testes do motor passando.
**Como vou testar:** jogar 5–10 partidas e ver elo/atributos mexendo de forma coerente.

### FASE 3 — Loop semanal
**Objetivo:** o tempo passa em semanas e o jogador escolhe o que fazer.
**Entra no escopo:**
- Calendário de semanas + `semanaAtual`/`temporada`.
- Sistema de **energia** (ações custam, descanso recupera).
- Ações da semana: jogar soloq, treino focado (1 atributo), descansar. Botão "Avançar semana" que processa tudo.
- Ganho de atributos via treino.
**Fora do escopo:** economia/dinheiro, times, propostas, campeonatos.
**Critério de pronto:** dá pra avançar semanas, gastar energia em ações e ver atributos/elo evoluindo ao longo do tempo.
**Como vou testar:** rodar várias semanas alternando treino e soloq.

### FASE 4 — Economia + investimentos
**Objetivo:** dinheiro entra e dá pra investir na evolução.
**Entra no escopo:**
- Salário semanal (se tiver contrato — por ora um contrato fake inicial serve de stub).
- Loja de investimentos: bootcamp Coreia, coach, setup, coach mental/nutri, stream.
- Efeitos de cada investimento no jogador (boosts/temporários/passivos/renda).
**Fora do escopo:** propostas de times, troca de time, campeonatos.
**Critério de pronto:** dá pra ganhar e gastar dinheiro; cada investimento tem efeito visível; dá pra sentir a tensão de escolha.
**Como vou testar:** acumular dinheiro algumas semanas e testar cada investimento.

### FASE 5 — Reputação + propostas + times
**Objetivo:** receber propostas e trocar de time, subindo de tier.
**Entra no escopo:**
- Base de **times fictícios** por tier em `/data`.
- Sistema de **reputação** (sobe com nota, elo, títulos).
- Geração de `Offer` pra inbox conforme reputação; aceitar/recusar; assinar contrato (salário/duração).
- Subir de tier ao assinar com times maiores.
**Fora do escopo:** campeonatos com partidas oficiais (vem na 6).
**Critério de pronto:** dá pra receber propostas coerentes com a reputação, assinar e ver o tier/salário mudarem.
**Como vou testar:** evoluir o jogador, ver propostas chegando e assinar um time melhor.

### FASE 6 — Campeonatos
**Objetivo:** disputar temporada com o time.
**Entra no escopo:**
- Calendário de partidas oficiais (temporada regular + playoffs).
- Resultado das partidas usando o motor; premiação em dinheiro/reputação.
- Acesso a internacionais (MSI/Worlds) ao vencer a liga no Tier 1.
**Fora do escopo:** win rates reais (vem na 7).
**Critério de pronto:** dá pra jogar uma temporada inteira com time e ganhar título.
**Como vou testar:** disputar uma temporada do começo ao fim.

### FASE 7 — Dados reais (Riot API / win rates)
**Objetivo:** plugar dados reais no motor sem reescrever a simulação.
**Entra no escopo:**
- Picks/bans completos que influenciam a **força de comp**.
- Win rates reais via **API Route do Next** (chave em `.env.local`). (Eu vou te passar a fonte exata dos meus dados de win rate aqui.)
- Interface do motor preparada pra alternar entre dados sintéticos e reais.
**Fora do escopo:** multiplayer/cloud.
**Critério de pronto:** o draft real altera a probabilidade de vitória de forma coerente.

### FASE 8 — Polimento
Balanceamento da progressão (lenta e gostosa), eventos aleatórios, conquistas, melhorias de UI, áudio leve, múltiplos saves refinados.

---

## 6. Equação do motor (referência pra Fase 2)

Comece simples e determinístico, dá pra refinar depois:

```
forcaRota   = média ponderada dos atributos relevantes pra Role
forcaCampeao = maestria no campeão escolhido
base        = 0.5*forcaRota + 0.2*forcaCampeao + 0.2*forcaTime + 0.1*forcaComp
ruido       = aleatório, com amplitude REDUZIDA por consistencia e mental
forcaFinal  = clamp(base + ruido, 0, 100)
vitoria     = forcaFinal vs forcaInimigo (com chance proporcional à diferença)
nota (0–10) = derivada de forcaFinal relativa à expectativa (pode ser alta mesmo em derrota)
```

Pesos por rota e fórmula exata: deixe num arquivo de config em `/data` pra facilitar balanceamento.

## 7. Modelo do PROGRESS.md (crie na Fase 0)

```md
# Progresso — Carreira LoL

## Status das fases
- [ ] Fase 0 — Setup
- [ ] Fase 1 — Criação de jogador + dashboard + save
- [ ] Fase 2 — Motor + soloq
- [ ] Fase 3 — Loop semanal
- [ ] Fase 4 — Economia
- [ ] Fase 5 — Reputação + propostas
- [ ] Fase 6 — Campeonatos
- [ ] Fase 7 — Dados reais
- [ ] Fase 8 — Polimento

## Decisões tomadas
(anote aqui escolhas técnicas e de design conforme avança)

## Como rodar
(comandos de dev/test/build)
```

---

## 8. Comece agora pela FASE 0
Confirme a estrutura de pastas, crie o projeto, salve `CLAUDE.md` e `PROGRESS.md`, faça a tela inicial e o teste dummy. Ao terminar, me diga como rodar e **pare pra eu testar** antes da Fase 1.
