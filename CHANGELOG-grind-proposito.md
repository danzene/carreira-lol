# CHANGELOG — Grind com Propósito (Sucata · Árvore de Talentos · Baús)

Três sistemas que vivem **dentro** do grind de normais, ligados por uma economia
**fechada**: a Sucata só nasce jogando e só morre na árvore de talentos; os talentos
aceleram/enriquecem o próprio grind; os baús premiam **desejo** (cosméticos do diorama),
nunca poder. Nada disso toca PDL/MMR/CoinPoints/passe/energia/gacha.

Engine puro e seedado em `engine/grindProposito.ts` (+ integração em `engine/grind.ts`);
dados de balanço em `data/grindProposito.ts`; cena em `components/grind/diorama/cena.ts`;
UI em `components/grind/PainelGrind.tsx` + `DioramaGrind.tsx`. Tudo coberto por
`engine/grindProposito.test.ts` (22 casos) e integrado no admin/feed/recap/hall.

---

## As 8 regras invioláveis — como cada uma é garantida

1. **Economia FECHADA.** A Sucata é um tipo próprio; não há nenhuma função que troque
   Sucata↔$↔CoinPoints em nenhuma direção. Testado por varredura (nenhuma recompensa de
   baú/talento produz moeda externa).
2. **Lista proibida absoluta.** O tipo `RecompensaBau` é uma união fechada
   (`sucata | dinheiro | item Comum | maestriaPack | cosmetico`) — não existe variante
   capaz de expressar PDL/CoinPoints/passe/energia/carga/Raro+/Lenda/pity-do-gacha. É a
   Regra 2 **por construção**, e ainda assim há um teste que rola 400+ baús de todos os
   tiers e confere que todo `tipo` sai da whitelist.
3. **Lendário = desejo, não poder.** O baú Lendário concede um cosmético inédito da
   Coleção do Grind (skin com hue-shift, trilha, pet) + jackpot de Sucata. Cosmético
   **não altera nenhum número de gameplay** — só a cena.
4. **Teto re-simulado (≤ ~25% do ativo em 4 semanas).** Só dois talentos alavancam a
   economia real: **Velocidade de Ataque** (partidas mais curtas ⇒ mais partidas dentro
   do teto de 3h) e **+Ouro** (só $). A **maestria de partida NÃO é multiplicada** por
   talento. Números medidos abaixo.
5. **Engine puro seedado.** `mulberry32` (`criarRng`/`entre`), tier do baú derivado de
   `seedBau`, idempotência por índice de partida (recompensas estáveis mesmo que um
   talento encurte a duração).
6. **Compatibilidade de save + kill switch.** `normalizarGrind` migra saves antigos com
   defaults seguros (Sucata 0, talentos `{}`, sem baú). O kill switch do grind desliga
   tudo (sem Sucata, sem baú, sem cena).
7. **Performance intocada.** Zero alocação por frame (pools de parafusos/baú), tint
   memoizado por frame+cor, 30 fps mantidos, nada renderiza oculto.
8. **Testes + build verdes, commit por fase, código vence prompt.** 254 testes + build
   de produção verdes ao fechar a rodada.

---

## Constantes finais (congeladas)

### Sucata
- **Por partida:** 2–4 (representa os minions abatidos na cena).
- **Respec:** **grátis** (`respecCusto: 0`) — decisão de design: convidar a experimentar
  a árvore reduz o medo de "errar o build" e não há o que farmar de volta (respec nunca
  devolve recompensa já ganha, só reembolsa a Sucata investida).

### Baús — barra e tiers
- **Barra cheia:** 12 (só o **$ de vitória**, $2 base, carrega a barra). Um dia no teto
  ≈ 20 partidas ≈ 11 vitórias ≈ ~$22 ⇒ **~1.8 baús/dia**. Ritual, não chuva.
- **Distribuição:** Comum ~84% · **Raro 15%** · **Lendário 1%** (seedado).
- **Pity oculto do Lendário:** N=60; o talento de Sorte reduz N até o **piso 40**, nunca
  abaixo (proteção, não promessa). O tier fica **secreto até a abertura** do baú.
- **Máx. 1 baú pendente:** a barra trava em cheia; o transbordo de $ é carregado pra
  próxima barra (nada se perde), mas **nenhum 2º baú rola** até o pendente ser aberto.

### Recompensas por baú
| Tier | Sucata | $ | Extra |
|------|--------|---|-------|
| Comum | 8–15 | 1 | — |
| Raro | 25–45 | 2 | item Comum **ou** +1 maestria (`maestriaPack`) |
| Lendário | 150–250 | — | 1 cosmético **inédito** da Coleção; ×3 na Sucata se a coleção já estiver completa |

### Árvore de Talentos (3 ramos × 5 nós = 15)
Prereq **linear** dentro do ramo (nó `k` exige nó `k-1` com nível ≥ 1); custo escala
`custoBase · custoMult^nivel`. Efeitos são **modificadores puros** aplicados em
`resolverGrind` (nada hard-coded no loop).

- **⚔️ Combate** (acelera a cena; velocidade também rende mais partidas no teto):
  Velocidade de Ataque `{duracao −1.5%, encenação +8%}`×5 · Dano `{enc +6%}`×5 ·
  Golpe Duplo `{duplo +6%, enc +2%}`×5 · Foco `{duracao −0.8%, enc +4%}`×5 ·
  Fúria `{enc +5%}`×3.
- **💰 Fortuna** (só $ e Sucata — maestria fora):
  Ouro do Farm `{gold +3%}`×5 · Catador `{sucata +8%}`×5 · Ímã de Baú `{barra +6%}`×5 ·
  Bônus de Kill `{gold +1.2%}`×5 · Cofre `{sucata +5%}`×3.
- **🍀 Sorte** (muda distribuição e pity):
  Faro Raro `{raro +2%}`×5 · Presságio `{pity −4}`×5 · **Segunda Chance** (Raro abre 2,
  escolhe 1) ×1, custo 120 · Instinto `{raro +1%}`×5 · Trevo `{raro +1.5%}`×3.

Clamps de sanidade no engine: `duracaoMult ≥ 0.5`, `golpeDuplo ≤ 0.6`, `pityN ≥ piso`.

### Coleção do Grind v1 (9 cosméticos)
4 skins (Carmesim/Esmeralda/Áureo/Sombrio) · 3 trilhas (Ciano/Áurea/Verde) ·
2 pets (Poro / Mini-Barão). Skins usam **hue-shift que preserva a luz** do sprite
(blend `color` + `destination-in` pra recortar o alpha), memoizado por frame+cor.

---

## Simulação de economia — Regra 4 (medida, congelada no teste)

Modelo **honesto** do jogador engajado: grind no teto **todos os dias por 4 semanas**,
partidas entrando uma a uma (como os ticks de 5s da borda) e **baú aberto assim que cai**
(o $ e a maestria dos baús contam). É o **limite superior** de rendimento.

Referência ativa (mesmas 4 semanas de progressão normal): **$4175 · 921.5 maestria**.

| Cenário | Partidas | Baús | $ | Maestria | Sucata | % do ativo ($ / maestria) |
|---------|----------|------|---|----------|--------|---------------------------|
| Talentos **ZERADOS** | 546 | 49 | $645 | 160.4 | 2405 | **15.4% / 17.4%** |
| Talentos **MAXIMIZADOS** | 620 | 88 | $924 | 192.0 | 4762 | **22.1% / 20.8%** |

O critério da rodada (MAX ≤ 25% em $ **e** maestria) passa com folga, e o loop de upgrade
é real (MAX rende mais partidas e mais $ que ZERADO). **Se qualquer constante mudar,
rodar `npx vitest run grindProposito` e recongelar estes números aqui.**

### Recalibração feita nesta rodada (por quê)
A 1ª simulação aplicava o dia inteiro num único `aplicarGrind`, o que travava a barra no
"máx. 1 pendente" e **desperdiçava ouro**, subestimando o rendimento em ~24%. Reescrita
pro modelo honesto (partida a partida), o MAX apareceu em **26.9% ($) / 25.2% (maestria)**
— **acima** do teto. Constantes ajustadas até caber:
`atkspeed.duracao 0.02→0.015` · `foco.duracao 0.01→0.008` · `gold 0.05→0.03` ·
`bonus 0.02→0.012` · `raro.maestriaPack 2→1` · `barraCheia 22→12`. Resultado final: 22.1% / 20.8%.

---

## Integração (esta fase)

- **Cena (`cena.ts` / `DioramaGrind.tsx`):** drop de parafusos com homing pro HUD, barra
  de baú, baú caindo (física com 2 quiques + poeira) e cerimônia de abertura por tier
  (comum 0.7s / raro 1.5s / lendário 3.0s com escurecer + feixe dourado + troféu). Overlay
  de **Segunda Chance** quando o talento está ativo. Cosméticos/mods reaplicados na
  reidratação da cena (PiP/economia de bateria).
- **Painel (`PainelGrind.tsx`):** abas RESUMO / TALENTOS / COLEÇÃO. Árvore em 3 colunas
  por ramo (nível/custo/efeito, micro-juice ao comprar, respec com confirmação inline);
  Coleção X/9.
- **Feed (`engine/feed.ts`):** gatilho `grind_lendario` (relevância 72, o mais alto do
  grind, teto de 1 post/semana) — o flex do cosmético entra no feed com o **nome bonito**
  (`nomeCosmetico`), nunca o id.
- **Recap semanal:** card do grind mostra Sucata, baús por tier e talentos comprados.
- **Hall:** placas "baús abertos" e "coleção do grind X/9" (✔ quando completa).
- **Telemetria:** `grind_bau_aberto` (com `tier` e `pity`), `grind_cosmetico_ganho`,
  `grind_talento_comprado`, `grind_respec`, `grind_cosmetico_equipado` (fire-and-forget).
- **Admin (`/admin/engajamento`, migration 018):** seção Endgame ganha a **distribuição
  real de tiers** (validar contra 84/15/1% + pity), **% do grind com ≥1 talento** (mede
  se o loop fecha), respecs e cosméticos equipados. `admin_grind` recriada (SECURITY
  DEFINER, revoke public / grant service_role). Consolidado em `setup-admin.sql` **v8**.

---

## Decisões de design registradas
- **Respec grátis:** experimentar a árvore não deve custar — não há economia de "arrependimento".
- **Tier secreto até abrir:** a barra é a antecipação; a abertura é o payoff. Rolar no
  fundo revelaria cedo demais.
- **1 baú pendente:** protege o ritual (você abre antes de acumular o próximo) e serve de
  freio natural de rendimento sem "perder" ouro (transbordo carrega).
- **Maestria fora dos talentos:** a maestria é o vetor de progressão mais próximo de
  "poder"; deixá-la fora dos multiplicadores é o que mantém o grind ≤25% do ativo.

## Candidato futuro (NÃO implementado)
**Prestígio da Coleção:** ao completar a Coleção do Grind, um reset opcional que devolve a
progressão cosmética por uma variação de paleta (ex.: versões "prisma"). Fica registrado
como ideia; **não** foi implementado nesta rodada e **não** deve entrar sem re-simular o
teto — qualquer coisa que reabra o loop de Lendários precisa passar de novo pela Regra 4.
