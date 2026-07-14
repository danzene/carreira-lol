# CHANGELOG — Gaming House (Sistema de Treino Profundo)

Os 4 botões vagos (TREINO −20 / ESPECIAL −35 / STREAM −15 / MENTAL −40) viraram a
**GAMING HOUSE**: uma cena pixel com 8 estações visitáveis onde treinar é decidir
**ONDE × COM QUE INTENSIDADE × COM QUE FOCO**. Inspiração Punch Club aplicada com a
lição-mãe: **ficamos com o TRADE-OFF e banimos o ROUBO**.

Engine puro em `engine/gamingHouse.ts` (+ `data/gamingHouse.ts`); cena em
`components/casa/cenaCasa.ts` (reusa os blocos do motor do diorama — Regra 5); tela em
`/casa`. 25+ testes novos em `engine/gamingHouse.test.ts`.

---

## Mapeamento estação → atributos (números FINAIS, calibrados pela simulação)

| Estação | Treina (por sessão NORMAL) | ⚡ | Fadiga |
|---|---|---|---|
| 📼 Sala de Replay | Macro +1.25 · Consistência +0.45 | 20 | 12 |
| 🎯 Aim Trainer | Mecânica +1.55 | 20 | 12 |
| ⚔️ Custom 1v1 | Laning +1.25 · Mecânica +0.45 | 20 | 14 |
| 🖥️ Simulador de Scrim | Teamfight +1.15 · Comunicação +0.85 | 25 | 16 |
| 🧙 Treino de Campeão | Champion Pool +1.1 · **+2.5 maestria** no campeão escolhido | 20 | 12 |
| 🛏️ Bem-estar | academia: Mental +1.4 (20⚡/10 fad) · **sono**: −35 fadiga, +2 moral, **sara burnout** (5⚡) · **terapia**: +12 moral, −10 fadiga (15⚡) · **traço** (alteração mental de sempre, −40⚡ — preservada como 4ª variante; código vence) | — | — |
| 🔴 Sala de Stream | tipos abaixo | 15 | por tipo |
| 📋 Quadro Tático | Análise de Adversário (abaixo) | 35 | 8 |

**Intensidades:** leve ×0.6 custo / ×0.55 ganho / ×0.55 fadiga · normal ×1 · intensa
×1.6 custo / ×1.7 ganho / ×1.8 fadiga / **−2 Moral**. Números explícitos na UI ANTES
de confirmar (extrato completo com todos os multiplicadores).

**Tipos de stream:** ranqueada $60 · +0.5 rep · fadiga 18 | react $35 · +0.3 rep ·
fadiga 10 · **+4 Moral** | co-stream $90 · +1.0 rep · fadiga 14 (**destrava com 40 de
reputação**).

## Os multiplicadores (transparentes na UI)

- **Moral:** ≥75 ⇒ **×1.18** · <30 ⇒ ×0.85 · meio ⇒ ×1. (O "humor" do Punch Club.)
- **Foco da Semana:** 2 atributos declarados ⇒ **+28%** nas sessões que os treinam;
  troca livre a cada semana. Especialização por ESCOLHA, sem punição.
- **Rendimento decrescente POR ESTAÇÃO:** n-ésima sessão da semana ⇒ ×max(0.4, 1 −
  0.30·(n−1)); **com Coach contratado o passo cai pra 0.18** (sentido contínuo ao
  contrato da loja). Empurra variedade sem travar.
- **Burnout:** sessões rendem ×0.4 e Moral perde −2 extra por sessão.

## Fadiga & Burnout (overtraining SEM roubo)

Fadiga 0-100: acumula por sessão (intensas e stream cobram mais), dissipa com **sono**
(−35, sara burnout), **avançar a semana** (−30) e **descansar** (zera + sara). Ao
estourar 100 ⇒ **burnout por 24h reais** (ou até dormir/descansar): visível na UI e na
CASA (escurece, herói desaba no sofá) — **nenhum atributo é perdido, nunca**.

## 🧗 Decay com PISOS DE CONSOLIDAÇÃO (Regra 2 — o coração)

Marcos **20/40/60/80**: ao cruzar, viram permanentes. A consolidação roda ANTES de todo
decay (qualquer fonte de XP conta — sessão, partida, coach, bootcamp) e o decay semanal
(0.25, inalterado) **nunca derruba abaixo do último marco**. Testes: decay de 999 para
exatamente no piso; 200 semanas sem treinar nunca caem abaixo do consolidado. As Lendas
anti-decaimento seguem reduzindo o decay ACIMA do piso. **"Voltar à estaca zero" é
impossível por construção.**

## 📋 Análise de Adversário (a joia: treino → counters → draft)

Estudar (35⚡) arma um consumível contra o **próximo adversário oficial** da liga/torneio:
- **Revela as tendências** (2 classes favoritas, DETERMINÍSTICAS por hash do timeId) no
  banner ANALISADO da tela de draft;
- O time inimigo **pica de verdade** essas classes (~2/3 das vezes que há candidato —
  viés no `escolhaIA`), então counterá-las é acionável;
- **+2 de counterComp** na partida (pequeno, 1 partida, só contra o time estudado);
- Consumido no fim do jogo (telemetria `analise_partida_fim` com vitória — mede se o
  dever de casa paga). Fora do snapshot ranqueado de duelo, como sempre.

## 📊 Simulação comparativa (Regra 3 — MEDIDA, congelada no teste)

8 semanas, orçamento de 200⚡ de treino/semana, otimizador nos dois sistemas (antigo:
spam de ESPECIAL; novo: foco declarado + rotação de estações em intensa + sono
estratégico), virada de semana pelo caminho real (decay incluso):

| Sistema | Crescimento (soma dos 8 atributos) |
|---|---|
| Antigo | **14.00 attr/semana** |
| Gaming House | **14.69 attr/semana** |
| **Razão** | **1.05** ✔ (faixa exigida: 0.85–1.15) |

Nota de calibração: a 1ª versão rendia razão 0.63 (o overhead de fadiga/sono/rendimento
decrescente cobrava sem compensação) — os ganhos base subiram ~55% pra média casar. O
**pico por sessão** (intensa+foco+moral alta, 1ª da semana) fica ×1.45 do especial
antigo de propósito: é o prêmio da gestão, e a média semanal (o guarda real) fica em ±15%.

## UX / integrações

- Herói ANDA até a estação (sprites do atlas do diorama), pose por atividade, barra de
  progresso, fagulhas na cor da estação e "+X" reais no fim (engine aplica no clique; a
  cena é teatro). Estados visíveis: fadiga alta = véu+lentidão+zzz; burnout = casa
  apagada + sofá; moral alta = luz quente. Mobile 380px: faixa scrollável.
- Onboarding: 3 balões na primeira visita (estação → intensidade → foco), 1× por
  navegador. Unlocks progressivos respeitados (stream/mental semana 2, com 🔒).
- Recap semanal (card da casa), Hall (sessões totais, semanas honrando o foco, maior
  marco consolidado), feed (burnout > semana trancada), badge "🎯 declare o Foco".
- Passe: missões de "treinar"/"stream" seguem contando via mapeamento explícito
  (`chavePasseDaSessao`, testado). Análise não conta como treino.
- Telemetria: `sessao_treino` (estação/intensidade/foco/multiplicadores), `burnout_entrou`,
  `foco_semana_definido`, `stream_tipo`, `analise_adversario_usada`, `analise_partida_fim`.
  **Admin (migration 021 / setup v11):** uso por estação (estação morta), taxa de burnout
  (recalibrar se cruel), adoção do Foco, tipos de stream, análises.
- Limpeza: os 4 botões antigos e seus painéis saíram do `PainelSemana` (JOGAR + 🏠 GAMING
  HOUSE + avançar/descansar); ações `treinar`/`streaming` removidas do store. O engine
  `treinar`/`streaming` permanece APENAS como referência da simulação comparativa
  (documentado); `alteracaoMental` segue em uso real (variante traço).

## Candidatas futuras (NÃO implementadas)
- **Parceiros de treino** (companheiros de time como bônus de estação) — depende da
  rodada de companheiros.
- **Upgrades físicos da casa** (estações melhores compradas com $) — boa expansão quando
  a telemetria validar o uso por estação.
