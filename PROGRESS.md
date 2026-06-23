# Progresso — Carreira LoL

## Status das fases
- [x] 0  Setup + base pixel art
- [ ] 1  Criação de jogador + dashboard + save
- [ ] 2  Banco de campeões
- [ ] 3  Draft (pick & ban)
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

## Como rodar

> Pré-requisito: Node 18+ instalado na máquina.

```bash
npm install      # 1ª vez
npm run dev      # http://localhost:3000
npm run test     # Vitest (deve passar o dummy)
npm run build    # build de produção
```
