# Design — Passe de Batalha + Sistema RPG de Itens (Carreira LoL)

> Documento de design detalhado. Objetivo: interligar missões, recompensas, CoinPoints,
> campeonatos e progressão do personagem num loop só, com vias de monetização limpas.
> Estado: **planejamento** (a implementar). Em PT-BR.

---

## 0. O grande loop (como tudo se conecta)

```
        ┌────────────── MISSÕES (diárias/semanais) ──────────────┐
        │   jogar, vencer, treinar, stream, liga, booster...      │
        ▼                                                         │
   PONTOS DE PASSE  →  sobe nível no PASSE (1→60)                 │
        │                    │                                    │
        │            ┌───────┴────────┐                          │
        │         FREE (6 recomp.)   PREMIUM (compra $)           │
        │            │                │                           │
        ▼            ▼                ▼                           │
   CoinPoints   itens / ingressos / molduras / consumíveis        │
        │            │                                            │
        │            └──► CAMPEONATOS (por ingresso) ──► ITENS RAROS
        │                                                  │
        ▼                                                  ▼
   Carreira Booster (lendas/campeões)            EQUIPAR / BUILD (RPG)
        │                                                  │
        └───────────────► PERSONAGEM MAIS FORTE ◄──────────┘
                                  │
                                  ▼
                    sobe de elo / vence mais / sobe reputação
                                  │
                                  └──► volta pro topo (mais missões/recompensas)
```

Tudo gira em torno de **CoinPoints** (moeda, já por conta no servidor) e da **força do
personagem** (atributos + maestria + lendas equipadas + **itens RPG**).

---

## 1. SISTEMA RPG DE ITENS (o "RPG do personagem")

Evolui os **periféricos atuais** (headset/mouse/cadeira/monitor) num sistema de loot
estilo ARPG: slots, raridades, **afixos aleatórios (RNG)**, sets e inventário.

### 1.1 Slots de equipamento (6)
Tema: o setup/gear de um pro player. Cada slot segura 1 item.
| Slot | Implícito (atributo base do slot) |
|---|---|
| 🖱️ Mouse | Mecânica |
| ⌨️ Teclado | Laning |
| 🎧 Headset | Comunicação |
| 🖥️ Monitor | Teamfight |
| 🪑 Cadeira | Consistência |
| 🖱️ Mousepad | Mecânica (precisão) |

> Os 4 periféricos atuais viram 4 desses slots; Mousepad e Teclado entram como novos.

### 1.2 Raridades (5) e nº de afixos
Quanto mais raro, mais afixos e rolls maiores. (Cores reusam a paleta do jogo.)
| Raridade | Cor | Afixos aleatórios |
|---|---|---|
| Comum | cinza `#9a90c0` | 1 |
| Raro | ciano `#19e6e0` | 2 |
| Épico | roxo `#9a6bff` | 3 |
| Lendário | rosa `#ff2d7e` | 4 |
| Mítico | ouro `#ffe14d` | 5 |

Cada item tem: **1 afixo implícito fixo** (do slot) + N **afixos aleatórios** (pela raridade).

### 1.3 Afixos (RNG — "mesmo item, status diferentes")
O pool de afixos **reusa os substats que já existem no Carreira Booster** (`data/gacha.ts`
`SUBSTATS` + faixas por raridade). Cada afixo é `{chave, valor}` com `valor` sorteado num
range pela raridade. Pool:
- Atributos: Mecânica, Macro, Laning, Teamfight, Consistência, Mental, Comunicação, Champ Pool.
- Especiais: +XP%, +CoinPoints%, anti-decaimento, +Draft, **+maestria por partida%**, **+regen de energia%**.

→ Dois "Mouse Pro X" Épicos podem ter afixos totalmente diferentes. É o que cria a caça
ao **roll perfeito** (endgame + sink de CoinPoints via reroll).

### 1.4 Nível do item (iLvl)
O item tem um `iLvl` que **escala os ranges dos afixos** (item dropado num campeonato de
tier alto sai com iLvl maior → rolls maiores). Permite "o mesmo item" ser melhor conforme
a fonte. Upgrade de iLvl custa material + CoinPoints.

### 1.5 Sets (montar build)
4 sets temáticos (espelham os **estilos** das lendas), com bônus por peças equipadas:
| Set | 2 peças | 4 peças |
|---|---|---|
| Agressivo | +Teamfight | +Teamfight forte + variância+ (snowball) |
| Estrategista | +Macro | +Macro forte + Draft |
| Mecânico | +Mecânica | +Mecânica forte + maestria% |
| Resiliente | +Consistência | +Consistência forte + anti-tilt (reduz variância) |

Itens carregam `setId`. Incentiva **builds** (focar num set) vs **stat-stick** (pegar os
melhores afixos avulsos). Os dois viáveis = profundidade.

### 1.6 Efeito na partida
Os afixos dos itens equipados **somam em `bonusAtributos`** (exatamente como os periféricos
já entram em `forcaRota`), mais os efeitos especiais (XP/CoinPoints/energia/draft). Aparecem
no painel **"LENDAS EM CAMPO"** do draft (renomear pra "EFEITOS EM CAMPO": lendas + itens + set).

### 1.7 Aquisição (de onde dropa)
- **Campeonatos por ingresso** (prêmio principal — itens raros, iLvl alto).
- **Recompensas do Passe** (free e premium).
- **Drop raro em partidas** (chance pequena de cair item comum/raro).
- RNG em 2 camadas: sorteia **raridade** → sorteia **afixos**.

### 1.8 Inventário, reroll e desmonte (sinks)
- **Inventário** (bag): itens não equipados; equipar/desequipar; **comparar** com o equipado.
- **Reroll de afixos**: re-sorteia os afixos do item — custa **CoinPoints** (caça ao perfeito).
- **Upgrade de iLvl**: sobe o poder — custa **material + CoinPoints**.
- **Desmontar (salvage)**: vira **material** (e um pouco de CoinPoints). Limpa duplicatas.
→ Reroll/upgrade são **sinks de CoinPoints** que sustentam a economia (e a venda de CoinPoints).

---

## 2. PASSE DE BATALHA

### 2.1 Estrutura
- **60 níveis**, em **6 páginas × 10 níveis** (1–10, 11–20, … 51–60).
- Duas trilhas no mesmo lugar: **GRÁTIS** e **PREMIUM** (comprado).
- **Temporada** do passe: **tempo real (~42 dias / 6 semanas)**, independente da temporada
  in-game. Renova o passe e as recompensas a cada temporada.

### 2.2 Trilhas
- **GRÁTIS — 6 recompensas (1 por página):** ao fechar cada página (níveis 10/20/30/40/50/60).
  Modestas: CoinPoints + 1 item (comum→raro) + **1 ingresso** na última página.
- **PREMIUM — recompensa em (quase) todo nível (~60):** CoinPoints maiores, itens melhores
  (raros/épicos), **molduras de avatar exclusivas**, consumíveis (refil de energia/cargas,
  boost de XP), e **ingressos** em marcos (níveis 20/40/60).
- **Recompensa final (nível 60):** grande pacote de CoinPoints **+ ingresso de campeonato**
  valendo **equipamentos raros** (fecha o loop com os itens RPG).

### 2.3 Pontos de Passe (XP) e missões
Missões dão **Pontos de Passe (PP)**; acumular PP sobe nível (ex.: **100 PP/nível**).
- **Diárias (3/dia, renovam 24h):** "Jogue 3 partidas" (50), "Vença 1" (40), "Treine 2x"
  (30), "Suba 1 div. de elo" (60), "Faça 1 stream" (30) — sorteadas do pool.
- **Semanais (renovam 7 dias, maiores):** "Vença 10 partidas" (200), "Jogue 1 de liga"
  (150), "Puxe no Booster" (100), "Equipe um set 2 peças" (120), "Reroll 1 item" (80).
- **Pacing (alvo):** ~6 semanas. Dailies (~120 PP/dia × 42 = 5040) + semanais (~600 × 6 =
  3600) ≈ **8640 PP** vs **6000** pra fechar → dá pra completar com folga só nas dailies;
  premium pode dar **+10% PP**. (Números ajustáveis no balanceamento.)

### 2.4 Compra & monetização
- **Passe Premium = dinheiro real** (verificado no servidor — IAP/Stripe). É a via principal
  de monetização, junto com **pacotes de CoinPoints**.
- Opcional: **comprar níveis avulsos** (pra quem quer pular) e bundle "Passe + 25 níveis".
- Comprar o premium **libera retroativamente** as recompensas premium já passadas.

---

## 3. CAMPEONATOS POR INGRESSO (ponte passe ↔ itens)
- O **ingresso** (vindo do passe/recompensas) dá entrada num **campeonato especial** (reusa
  a engine de bracket da liga/torneio) cujos **prêmios são itens raros** (iLvl alto) + CoinPoints.
- Mais pra frente, no **modo online**, esses campeonatos podem ser **entre pessoas** (Fase C),
  valendo os mesmos itens/molduras — encaixa perfeito no que já planejamos.

---

## 4. INTEGRAÇÃO COM O QUE JÁ EXISTE
- **CoinPoints**: já é por conta no servidor (Fase A). Itens (reroll/upgrade) e o passe gastam/dão CoinPoints via a função `ajustar_coinpoints` (autoritativa).
- **Periféricos atuais** (`Equip` em `engine/types.ts` + `engine/economia.ts`): viram os
  primeiros slots do sistema RPG (migração) — não dois sistemas paralelos.
- **Substats do gacha** (`data/gacha.ts`): o pool/faixas de afixos é reusado nos itens.
- **Missões** reusam as ações que já existem (partida, treino, stream, liga, booster, elo).
- **Painel de efeitos no draft** (`EfeitosLendas`) passa a somar **itens + set**.
- **Servidor (Supabase)**: passe (nível/premium/resgatados), inventário **por conta** e
  CoinPoints ficam no servidor — anti-trapaça e pré-requisito da monetização.

---

## 5. MODELO DE DADOS (esboço)
```ts
// ---- Itens RPG ----
type SlotGear = "MOUSE" | "TECLADO" | "HEADSET" | "MONITOR" | "CADEIRA" | "MOUSEPAD";
type RaridadeItem = 1 | 2 | 3 | 4 | 5; // Comum..Mítico

interface Afixo { chave: string; valor: number; }       // reusa SUBSTATS do gacha
interface Item {
  id: string;            // instância única
  baseId: string;        // tipo/nome do item
  slot: SlotGear;
  raridade: RaridadeItem;
  iLvl: number;
  implicito: Afixo;      // fixo do slot
  afixos: Afixo[];       // aleatórios (RNG) — nº pela raridade
  setId?: string;
}
interface Inventario {
  itens: Item[];                            // bag
  equipado: Partial<Record<SlotGear, string>>; // slot -> item.id
}

// ---- Passe de Batalha ----
interface Missao {
  id: string; tipo: string; alvo: number; progresso: number;
  pp: number; escopo: "diaria" | "semanal"; expiraEm: number; concluida: boolean;
}
interface PasseDeBatalha {
  temporadaId: string; nivel: number; pp: number; premium: boolean;
  resgatadasFree: number[]; resgatadasPremium: number[];
  missoes: Missao[];
}
```
- **Inventário + passe = por conta (servidor)** (segue o jogador, monetizável).
- Tabelas Supabase: `inventario` (itens jsonb por user), `battle_pass` (temporada/nível/
  premium/resgates), `missoes` (ou dentro do battle_pass). RLS + funções autoritativas
  pra resgate/compra (igual `ajustar_coinpoints`).

---

## 6. FASEAMENTO SUGERIDO (uma fase por vez)
1. **Itens RPG (single-player primeiro)** — slots, raridades, afixos RNG, inventário, sets,
   efeito na partida, drops de campeonato/partida. **Auto-contido, dá profundidade já** e é
   pré-requisito (o passe dá itens). Começa local; depois sobe pro servidor (por conta).
2. **Missões + Passe (trilha grátis)** — missões diárias/semanais, PP, níveis 1–60, 6
   recompensas grátis. Server-backed.
3. **Premium + monetização** — trilha premium, compra com dinheiro real (verificada no
   servidor), níveis avulsos; campeonatos por ingresso com prêmios de item.

> Encaixa com o **modo online**: Fase A (conta/saldo) feita; B (1v1) e C (campeonatos entre
> pessoas) podem usar os mesmos itens/ingressos como prêmio.

---

## 7. DECISÕES A CONFIRMAR (antes de codar)
1. **Por onde começar:** Itens RPG primeiro (recomendado) · Passe primeiro · Modo online (B) primeiro.
2. **Escopo de itens/passe:** por **conta** (servidor; segue o jogador; monetizável — recomendado)
   · por **carreira** (local; mais simples; some ao trocar de carreira).
3. **Premium do passe:** **dinheiro real** (monetização — recomendado) · ou também comprável com CoinPoints.
4. **Temporada do passe:** **tempo real ~6 semanas** (recomendado) · ou atrelada à temporada in-game.

> Números (pacing, faixas de afixo, custos de reroll) são propostas iniciais — afinamos no
> balanceamento depois de jogar.
