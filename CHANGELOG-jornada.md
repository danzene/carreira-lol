# CHANGELOG — Jornada de Treino (fases estilo Task Bar Hero + Skills + Desafio de Região)

Rodada nascida do feedback do dono ("queria fases, interação de verdade e algo rodando
que prende no tempo ocioso — igual o Task Bar Hero") e do consenso fechado em chat:
**jornada unificada · parede sem morte · 3 slots de skills · 1ª dificuldade agora**.

O Treino passivo virou uma **trilha de 40 fases (4 regiões)** que o diorama luta sozinho
(inclusive em PiP): a alavanca **⤴ AVANÇAR** sobe uma fase a cada vitória; **🌾 FARMAR**
segura na fase escolhida. A cada 10 fases um **gate** trava a jornada até o jogador vencer
o **Desafio de Região** — o gauntlet presencial de 5 ondas (a Expedição desta base) cujo
final é o boss. **Skills** compradas com Sucata dão poder interno e espetáculo auto-cast.

---

## Princípios preservados (invioláveis)

1. **Idle seguro:** no passivo NUNCA há morte. Fase forte demais = **parede natural** — o
   WR cai, o avanço estanca, nada se perde, nada exige vigilância. Morte só existe no
   Desafio (presencial, opt-in, e só custa o loot da corrida).
2. **Economia da Regra 4 PROTEGIDA por construção:** a força inimiga da fase tem **piso
   47** (o mínimo da faixa neutra antiga validada) — farm raso nunca rende mais $ que o
   grind calibrado; fase funda só fica MAIS difícil (WR cai ⇒ $ cai). Os valores unitários
   de $ e maestria por partida **não mudaram** (testado). O que escala com a profundidade
   é a **Sucata** (economia fechada — o prêmio de empurrar a parede).
3. **Skills nunca viram poder de carreira:** whitelist varrida por teste (poder/escudo/
   cura/hp — todos internos do treino), caps duros (poder ≤15, escudo ≤35%), snapshot
   ranqueado limpo. Compradas SÓ com Sucata; respec grátis.
4. **Kill switches independentes:** `JORNADA.habilitado` (desliga fases ⇒ grind volta ao
   comportamento pré-jornada exato), `EXPEDICAO.habilitado` (desliga o Desafio) e o
   `GRIND.habilitado` global. Save antigo migra com defaults seguros (`faseMax` herda o
   recorde da Expedição antiga).

## Constantes (congeladas)

- **Trilha:** 40 fases · 4 regiões (Campos de Treino, Ginásio da Elite, Sala das Lendas,
  Palco Mundial) · gate nas fases 10/20/30/40.
- **Força inimiga:** `max(47, 44 + fase·1.8)`, teto 95.
- **Sucata:** `mult = 1 + (fase−1)·0.08`, cap 2.8×.
- **Skills (6, nivelMax 5, 3 slots):** Golpe Giratório (poder 2/nv) · Chuva de Flechas
  (poder 1.2 + hp 3) · Muralha (escudo 4%/nv) · Vampirismo (cura 1.5%/nv) · Fúria de
  Batalha (hp 10/nv) · Foco Letal (poder 0.8 + escudo 1.5%). Custos 30-50 · ×1.6/nível.
- **Desafio:** 5 ondas (boss na última), `danoFracaoBase 0.15`, `danoJitter 0.28`,
  2 tentativas/dia. Ritmo por profundidade do desafio: Aquecimento (onda 6) → Scrim
  (onda 8) → Scrim de Elite (matou o boss).

## Números MEDIDOS (congelados nos testes)

- **Progressão do jogador médio (attrs 50, sem skills):** chega ao **gate da região 1
  (fase 10) em ~10 dias** de teto — o Desafio vira o objetivo natural da primeira semana.
  Renda ~66 Sucata/dia ⇒ **árvore completa em ~74 dias** (na faixa alvo de 1,5-3 meses).
- **Desafio região 1 (boss 10):** **32%** de vitória sem skills (2-3 tentativas ou
  investir) · **100%** com defensivas maxadas (Muralha+Vampirismo+Fúria ≈ 600 Sucata —
  ~9 dias de farm; merecido).
- **Desafio região 2 (boss 20):** ≤15% sem skills — o muro que dá propósito à Sucata.
- **Recalibração documentada:** `danoFracaoBase 0.11→0.15` (o gauntlet agora é SÓ o boss
  — precisa de dente) e `danoJitter 0.18→0.28`. O jitter alto é DESIGN: a soma de 5 ondas
  tem um precipício seco (0.14 ⇒ 83% de vitória; 0.16 ⇒ 2%) — a variância alta suaviza a
  curva e torna cada tentativa uma aposta de verdade.

## O que mudou por camada

- **Engine:** `EstadoGrind.jornada` {fase, faseMax, modoAvanco, bossVencidos} + `skills`/
  `skillSlots`; `resolverGrind` com `ContextoJornada` opcional (sem contexto = pré-jornada
  exato); avanço idempotente no `aplicarGrind`; `desafioDisponivel`/conquista de região no
  finalize; `engine/skills.ts` puro (compra/slots/mods/respec/normalização).
- **UI:** HUD da jornada no dock (FASE X · região, alavanca, botão ⚔️ DESAFIO! pulsando no
  gate); aba SKILLS no painel (slots clicáveis, compra, respec); `/expedicao` virou a
  arena do Desafio (lançamento contextual, banner REGIÃO CONQUISTADA); auto-cast visual
  das skills na cena (timers defasados, burst na cor, pools reusados — zero alocação).
- **Mundo vivo:** recap (fase da jornada + onda do desafio), Hall (fase máx, regiões
  conquistadas X/4), cerimônia na conquista.
- **Telemetria/Admin:** `grind_partida` agora carrega a fase; `jornada_modo`,
  `skill_comprada/equipada/respec`, `jornada_regiao_conquistada`. Migration **020** +
  `setup-admin.sql` **v10**: distribuição de fase (a parede real), avançar×farm, adoção
  de skills, funil do Desafio (tentativas → conquistas por gate).

## Trade-offs documentados

- Todas as partidas pendentes de um tick resolvem na fase CORRENTE (quem volta depois de
  horas resolve o lote na fase da manhã; a Sucata funda entra no tick seguinte) —
  determinístico e simples; o checkpoint nunca re-paga.
- O teste antigo de "sim dupla" (expedições livres diárias) foi substituído: o modo livre
  não existe mais — o gauntlet é só o Desafio (gate), e a economia combinada é a da
  jornada (medida acima).

## Candidatas futuras (NÃO implementadas)
- **Dificuldades Pesadelo/Inferno/Tormento:** re-rodar a trilha com multiplicadores —
  desenhado, mas só entra quando a calibração da 1ª dificuldade for validada com uso real.
- **Prestígio da árvore** (nota antiga mantida) e **loot ARPG/Cube** (ver
  DESIGN-passe-e-itens.md) — rodadas próprias.
