# CHANGELOG — Dois Modos de Treino (Passivo seguro + Expedição com risco)

O grind virou **dois modos explícitos**, ligados pela mesma Sucata/árvore/baús mas com
contratos opostos de risco:

- **TREINO (Passivo)** — idle seguro e confiável. Roda em segundo plano/PiP, sem morte, sem
  vigilância, Sucata pingando devagar. É o chão que nunca trai o jogador.
- **EXPEDIÇÃO (Ativo)** — opcional, arriscado, presencial. "Scrim hardcore" em fases de
  dificuldade crescente com HP e o dilema **Continuar/Recuar**. Morrer só custa o loot da
  corrida — jamais o patrimônio da carreira.

Engine puro/seedado em `engine/expedicao.ts` (+ wrappers em `engine/grind.ts`); balanço em
`data/expedicao.ts`; a tela em `components/grind/ExpedicaoView.tsx` (rota `/expedicao`), que
**reusa o motor do diorama** como cenário. Coberto por `engine/expedicao.test.ts` (27 casos).

---

## ⚠️ Nota de premissa: o "Ritmo de Treino" não existia

A missão assumia um "Ritmo de Treino" já pronto de uma rodada anterior — mas ele **nunca foi
construído neste projeto** (código vence o prompt; documentado). Foi criado **nesta rodada**,
no molde do item de loja `preparacao`: buff **temporário/consumível/capado** da próxima
partida de soloq, **fora do snapshot de duelo ranqueado** (o `snapshotDePlayer` não o lê, então
ninguém enfrenta o Ritmo). Ganho pouco no passivo (via baús/futuro) e melhor na Expedição.

---

## O princípio inviolável (a espinha)

O modo **Passivo nunca tem risco de morte nem exige atenção** — risco que acontece "nas costas"
do jogador mata o apelo idle. Todo risco vive na Expedição, um modo **ativo e opcional**. Garantido
por construção: o guard `passivoAtivo(modo, expedicao)` faz o heartbeat do passivo **só** acumular
quando não há corrida ativa; a Expedição tem loop próprio, dirigido por decisão (nada progride sozinho).

## Separação (Fase 0)

`EstadoGrind` ganhou `modo: "PASSIVO"|"EXPEDICAO"`, `expedicao`, `ritmo`, `recordeFaseExpedicao`,
`expedicaoDia/expedicoesNoDia` — save antigo migra pra passivo seguro sem perder Sucata/talentos/
cosméticos. Corridas já encerradas (`morto`/`recuou`) **não ressuscitam** ao carregar.

## Escala de dificuldade + fórmula de dano/HP (Fase 1)

Reusa a **mesma matemática do jogo** (`forcaRota` = poder do herói), sem inventar combate:

- **HP** = `round(60 + forcaRota*0.9 + bonusHp)` → força 50 ≈ 105 HP. +4% de cura ao limpar uma fase.
- **Força da fase** = `34 + (fase-1)*5.5`, ×1.35 nas fases-boss (a cada 5).
- **Dano da fase** = `hpMax * 0.11 * (forçaDaFase / poderHerói) * (1 ± 0.18 jitter seedado)`.
  Quando a fase iguala o herói custa ~11% do HP; fundo demais ⇒ razão > 1 ⇒ o dano cresce ⇒ a
  morte se aproxima. O **jitter** é a tensão: o preview mostra um risco estimado (faixa de dano +
  chance de morte), nunca o número exato que a seed já fixou.
- **HP zerou ⇒ morte**; a fase fatal **não** conta (o loot preservado é só o das fases COMPLETADAS).

## Push-your-luck: o que se perde (Fase 1)

Ao limpar cada fase, o jogador escolhe **Continuar** (mais fundo, mais loot, mais risco) ou
**Recuar** (embolsa o garantido). Decisão e resolução são **atômicas** no engine (entrar/continuar
já devolvem a fase resolvida) — anti save-scum: recarregar não permite "tentar de novo" a fase fatal.
Morrer/recuar **não afeta a carreira real** (elo, atributos, itens equipados, Sucata já guardada,
talentos, cosméticos) — perde só o loot em progresso.

## Robustez de estado (Fase 2)

**Regra escolhida:** sair da tela (navegar/fechar/recarregar) **encerra a corrida e embolsa o loot
das fases COMPLETADAS** (a fase em andamento é perdida) — nunca resume por trás, nunca duplica, e
remove qualquer incentivo a "sair pra não morrer" (a morte só é infligida por um Continuar explícito).
O loot é aplicado ao save **no instante** da morte/recuo (fechar a aba nunca perde); uma corrida que
sobrou "no meio" é finalizada no `carregar()`. A Expedição **não** roda em PiP/segundo plano.

## Limitador de entrada (escolhido)

**2 expedições por dia real** (`EXPEDICAO.maxPorDia`). A Expedição é o *evento* do dia, não um
moedor 24h — o limite protege o horizonte da árvore (ver simulação) e mantém o passivo como fonte
principal de Sucata.

## Variantes superiores de Ritmo por profundidade

| Variante | Desbloqueia em | Cargas | +Comp | +Counter |
|----------|----------------|--------|-------|----------|
| Aquecimento | fase 1 | 1 | +1 | 0 |
| Scrim | fase 4 | 1 | +2 | +1 |
| Scrim de Elite | fase 8 | 2 | +4 | +2 |

O melhor Ritmo (`RITMO_CAP` = comp 4 / counter 2) é da **ordem do `preparacao` da loja** (comp 3 /
counter 1) — não abre um novo patamar de poder, e continua temporário/consumível/fora do ranqueado.

## Talentos que ligam a árvore à Expedição (Fase 3)

Os 3 capstones ganham um efeito de Expedição (além do original): **Fúria** → +12 HP/nível,
**Cofre** → +10% de loot/nível, **Trevo** (maxado) → começa **1 fase à frente**.

---

## Simulação dupla (Regra 4 — medida, congelada)

Jogador **mais engajado**: passivo no teto TODOS os dias + `maxPorDia` Expedições/dia com estratégia
sensata (continua enquanto a chance de morte < 50%, senão recua), 14 dias, talentos zerados.
Árvore completa custa **4868 de Sucata**.

| Fonte | Renda | Árvore completa |
|-------|-------|-----------------|
| Passivo sozinho (chão lento) | ~35 Sucata/dia | ~139 dias (~4,5 meses) |
| **Passivo + Expedição (engajado)** | ~105 Sucata/dia | **~47 dias (~1,6 mês)** |

Fase-final média das corridas: ~9. O engajado acelera ~3× sobre o passivo puro, mas o combinado
**segue dentro de ~1,5–2,5 meses** (Regra 4 ✓). O passivo puro é o "chão seguro devagar"; a
Expedição é o acelerador com esforço/risco. **Se qualquer constante mudar, rodar
`npx vitest run expedicao` e recongelar estes números.**

### Recalibração feita nesta rodada (por quê)
A 1ª Expedição rendia ~1400 Sucata/dia → árvore em **3 dias** (furava o teto). Como o passivo
sozinho já enchia o horizonte (~57 dias na calibração anterior), **não havia orçamento** pra a
Expedição sem recalibrar. Decisão (a missão pede em Fase 3: "recalibre se a Expedição acelerou
demais"): **o passivo virou o CHÃO genuinamente lento** — Sucata do passivo reduzida ~½
(`sucataPartida 2-4→1-2`; baús `comum 8-15→4-8`, `raro 25-45→12-22`, `lendário 150-250→80-130`) —
e a **Sucata da Expedição é um bônus modesto** (`sucataFaseBase 5→0.13`, `maxPorDia 3→2`, baús mais
raros fora do boss). O valor real da Expedição é **Ritmo + cosméticos + o recorde de profundidade**,
não farmar Sucata. Isso **não** mexe no teto de $/maestria (Regra 4 da rodada anterior — Sucata é
economia fechada à parte). Ver também a nota no `CHANGELOG-grind-proposito.md`.

## Ponte de carreira, feed, hall, admin (Fase 3)

- **Ritmo aplicado** no draft de soloq (comp/counterLane, junto do `preparacao`) e **consumido**
  no mesmo caminho — a UI narra Expedição = scrim hardcore e o Ritmo = auge de preparo.
- **Recap/Hall/Feed:** fase mais funda da semana no recap; placa de recorde de profundidade no Hall;
  gatilho de feed `grind_expedicao` (relevância 55) reage a corridas fundas.
- **Telemetria:** `expedicao_iniciada / fase_limpa / escolha / fim / ritmo_variante`.
- **Admin (`/engajamento`, migration 019):** distribuição da FASE-FINAL (a curva de dificuldade real),
  taxa continuar×recuar (o dilema tem dente?), % dos grinders que usam a Expedição, mortes×recuos.
  `admin_grind` recriada; consolidado em `setup-admin.sql` **v9**.

## Kill switch & compatibilidade
`GRIND.habilitado` (global) **e** `EXPEDICAO.habilitado` (sub-switch) desligam a Expedição sem tocar
no passivo nem quebrar saves. Save antigo migra com defaults seguros. Performance do diorama intocada
(a Expedição só adiciona 2 hooks de draw-time e um loop próprio; passivo idêntico).

## Candidato futuro (NÃO implementado)
**Prestígio da árvore:** ao completar a árvore, um reset opcional por um bônus permanente pequeno.
Fica anotado como ideia; **não** foi implementado e **não** deve entrar sem re-simular o horizonte —
qualquer coisa que reabra o loop de Sucata precisa passar de novo pela Regra 4.
