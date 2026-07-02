# Rodada "Retenção & Dopamina" — CHANGELOG

Jogo já funcionava; esta rodada faz ele **sentir** bem: cerimônia/juice nos momentos de
recompensa, ritual diário de retorno, unlock progressivo e polish de hierarquia visual.
Nenhum sistema de gameplay novo complexo — amplificação do que existia.

## Fase 0 — Fundação (EventBus + Cerimônias + Som + Juice)

- `engine/cerimonias.ts` (puro, testado): eventos tipados derivados de transições de
  estado — `cerimoniaDeElo`, `cerimoniasDePasse` (missão concluída + level up com as
  recompensas dos níveis cruzados), `cerimoniasDeConquistas`, drop e gacha.
- `store/cerimoniaStore.ts`: fila transiente; **uma fullscreen por vez** + toasts
  paralelos (máx. 3 visíveis).
- `lib/som.ts`: chiptune **sintetizado** via Web Audio (square/triangle, envelopes
  curtos) — zero assets. Partituras por evento e por tier de raridade; volume/mute
  persistidos em `localStorage`.
- `data/juice.ts`: paleta por tier 1–5, durações/easings, antecipação maior pra tiers
  altos, `corElo()`.
- `components/juice/`: `AnimatedNumber` (rAF, easing, `deZero` p/ deltas),
  `AnimatedBar` (flash ao completar), `PixelBurst` (canvas, **PRNG seedado do engine**).
- `CeremonyManager` no layout: fases antecipação → revelação → celebração; sempre
  dispensável com 1 clique; toggle de mute no overlay.

**Decisão (adaptação ao repo):** a fila `pendingCeremonies` vive num **store Zustand
dedicado**, não dentro do `CareerState` — os eventos cruzam três domínios de estado
(carreira local, inventário por conta, passe por conta) e são transientes (não devem
ser salvos). O engine segue 100% puro: funções `cerimoniasDe*` derivam os eventos e
são testadas; os stores só encaminham (mesmo padrão do `verificarConquistas` →
`{career, novas}` que já existia).

## Fase 1 — Cerimônias dos 4 grandes momentos

- **Drop de item** (`CerimoniaDrop`): item cai girando com raridade escondida →
  suspense (maior em tier 4/5) → raridade **acende** (glow + flash + partículas + som
  do tier + shake). Botões EQUIPAR AGORA / GUARDAR.
- **Gacha** (upgrade in-place do `AnimacaoGacha`): **fake-out** no 5★+ (começa com cara
  de comum e "quebra" no meio com flash), 10× revela em ordem de raridade com a melhor
  **por último** (tick por carta), **barra de pity animada** após cada puxada (destaque
  "RESETOU ✨" ao tirar 5★), som do tier no estouro.
- **Elo** (`CerimoniaElo`): promoção = moldura antiga se **despedaça** em cacos pixel
  (seedado) → novo elo se forma com pop + fanfarra + partículas. Queda = sóbria, 1,5s,
  tom neutro ("A subida continua — próxima é sua.").
- **Passe** (`CerimoniaPasse`): barra enche com estouro, nível dá pop, recompensas dos
  níveis cruzados deslizam, **RESGATAR na própria cerimônia**.
- Números não teleportam: `AnimatedNumber`/`AnimatedBar` em energia, atributos, LP,
  saldo do gacha, barra de PP.

**Decisão:** o gacha **não** passa pelo `CeremonyManager` — o `AnimacaoGacha` já era a
cerimônia dedicada (interativa, com resultados/substats); ele foi enriquecido no lugar
pra não haver dupla apresentação. O evento `GACHA_PULLED` existe no engine (testado)
pra uso futuro.

## Fase 2 — Ritual diário de retorno

- `engine/diario.ts` (puro, testado): `registrarLoginDiario` — streak com **escudo
  semanal** (1 dia perdido consome o escudo em vez de zerar; 2+ zera), recompensas em
  ciclo de 7 dias (dia 1 pequeno → dia 7 = **item garantido**), `coletarDiaria`,
  puxada grátis diária, marcos (3 dias e múltiplos de 7 → cerimônia STREAK_MILESTONE).
- `engine/statsSemana.ts` (puro): partidas/vitórias/melhor KDA/melhor nota/LP líquido/
  drops por raridade; `fecharSemanaStats` vira a semana.
- **Daily Hub**: overlay na 1ª abertura do dia — calendário de 7 dias, escudo, energia,
  missões diárias, COLETAR. Fechável em 1 clique.
- **Recap semanal "wrapped"** ao avançar a semana (ANTES do resumo): 3–4 cards
  (números da semana, melhor momento, PDL líquido, loot) com setinhas ↑↓ vs semana
  anterior; cards vazios são pulados.
- **Puxada diária grátis** no Booster com badge.

**Decisões:**
- A puxada grátis **CONTA pro pity** (mais generoso; o pity é retenção).
- O estado diário (`diario`) vive no `CareerState` (por carreira/slot, não por conta) —
  manter no save local evita nova tabela no servidor nesta rodada.
- **TODO(monetização):** recompensas de streak em CoinPoints exigem crédito
  server-side via `ajustar_coinpoints`; nesta rodada só recompensas locais
  ($, energia, item). Marcado no código.

## Fase 3 — Badges + unlock progressivo

- `engine/badges.ts` (puro): `getBadges` — puxada grátis, streak pra coletar,
  recompensas do passe liberadas, itens novos. (Desafio de duelo recebido ficou de
  fora: depende de dado do servidor — anotado.)
- `engine/unlocks.ts` (puro, testado): carreiras **novas** destravam por marcos —
  semana 2 (stream/mental/loja), 1ª promoção (booster), Bronze (itens), semana 3
  (passe), Prata **ou 2ª temporada** (online). `migrarUnlocks` marca saves com
  progresso como `unlocksLegacy` (tudo aberto). `cerimoniasDeUnlocks` emite
  FEATURE_UNLOCKED no diff.
- UI: banners bloqueados viram **cadeado com condição**; badges pulsantes; STREAM/
  MENTAL bloqueados no painel até a semana 2.

## Fase 4 — Polish visual

- **HeaderHud** fixo (sticky) em todas as telas: CoinPoints animado, mini-barra de
  energia, nível do passe, toggle de som.
- **BarraAtributo** com cor por faixa (<40 rosa · 40–69 âmbar · 70+ ciano/verde),
  largura animada e "+X" flutuante.
- Dashboard: banners → **cards de navegação** (ícone grande + título + subtítulo de
  contexto + badge). Ação (JOGAR) continua destacada no PainelSemana.
- **Contraste**: textos informativos que usavam `text-borda` (#2a2150, quase invisível
  — ex.: "A energia regenera sozinha...") subiram pra `text-suave` (#9a90c0, ~6.7:1
  AA sobre o fundo). Separadores decorativos mantidos.
- Coleção de Lendas: não obtidas mostram **silhueta pixelizada escurecida** + estrelas
  + dica "🔒 no Booster".
- **`<PixelizedImage>`**: pixelização em runtime (downscale canvas sem smoothing +
  upscale `image-rendering: pixelated`, fallback `<img>`). Aplicada na coleção; o
  reveal grande do gacha segue HD **de propósito** (momento de brilho).
- Mobile 380px conferido nas telas alteradas (header compacto, cards truncam).

## Fase 5 — Rivalidades + Hall da Carreira

- `engine/rivais.ts` (puro, testado — máquina de estados): 2 derrotas **seguidas** pro
  mesmo time ⇒ RIVAL (vencer antes esfria); sendo rival, 2 vitórias contra ⇒ **RIVAL
  SUPERADO** (perder no meio zera o progresso). Vencer rival dá `+10 moral`, `+$200` e
  `+15%` de chance de drop naquela partida (valores no engine). Cerimônias
  RIVAL_DECLARED / RIVAL_DEFEATED.
- Banner **RIVALIDADE** na página da liga quando o próximo adversário é rival.
- Rival **online** derivado do histórico do servidor (saldo de derrotas ≥ 2 contra o
  nick) → chip 😤 RIVAL no ladder. Não entra no save.
- `engine/records.ts` (puro, testado): Hall da Carreira — maior streak, melhor KDA,
  melhor nota, mais kills, elos pisados pela 1ª vez. Recordes **notáveis** (acima de
  pisos: 12 kills / nota 9 / streak 5) disparam ACHIEVEMENT_UNLOCKED — evita spam.
- Tela `/hall`: mural pixel com recordes, títulos internacionais, elos alcançados e
  todas as conquistas (obtidas/bloqueadas). Card 🏛️ HALL no dashboard (rota
  `/conquistas` continua acessível).

## Conformidade com as regras

- **Regra de jogo só no engine**: toda lógica nova é função pura testada
  (`cerimonias`, `diario`, `statsSemana`, `badges`, `unlocks`, `rivais`, `records`).
  Componentes React só apresentam e disparam ações de store.
- **Determinismo**: partículas/cacos usam `criarRng` seedado do engine. Seeds nascem
  na borda dos stores (padrão pré-existente do repo).
- **CoinPoints intocado**: nenhuma recompensa nova credita/debita moeda; tudo passa
  longe de `ajustar_coinpoints` (recompensas locais + TODO documentado).
- **Saves antigos**: todos os campos novos são opcionais (`diario`, `statsSemana`,
  `rivais`, `records`, `unlocksLegacy`); `migrarUnlocks` roda no load; save antigo
  carrega com tudo destravado e sem streak até o 1º login registrado.
- **Nunca trava**: cerimônias em fila (1 por vez), dispensáveis com 1 clique,
  auto-dismiss; toasts se auto-removem.
- **Testes**: 117 → **153** (36 novos). `tsc` limpo, `next build` ok.

## TODOs deixados pra rodada de monetização

1. Recompensas de streak/passe em **CoinPoints** via `ajustar_coinpoints` (server).
2. Premium do passe **server-authoritative** (coluna própria, liberada pós-pagamento).
3. Mover RNG de gacha/itens/passe pra **Edge Functions** (pré-PvP valendo moeda).
4. Badge de **desafio de duelo recebido** (precisa de query/subscription no servidor).
5. Pré-existente (fora do escopo desta rodada): o sorteio de campeão do Booster usa
   `Math.random()` na página (`app/gacha/page.tsx`) — mover pro engine seedado junto
   com a migração de RNG pra Edge Functions.
