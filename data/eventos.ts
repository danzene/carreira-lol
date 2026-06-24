// ⭐ Partidas-evento (Fase 11 p2): oportunidades especiais com recompensa própria.

export interface ModeloEvento {
  id: string;
  nome: string;
  desc: string;
  bonusInimigo: number; // o quão mais forte é o adversário
  premioDinheiro: number;
  premioReputacao: number;
  repMin: number; // reputação mínima pra o convite aparecer
}

export const EVENTOS: ModeloEvento[] = [
  {
    id: "showmatch",
    nome: "Showmatch Beneficente",
    desc: "Amistoso de exibição. Sem pressão de rank — só vitrine e cachê.",
    bonusInimigo: 4,
    premioDinheiro: 350,
    premioReputacao: 3,
    repMin: 0,
  },
  {
    id: "duelo",
    nome: "Duelo de Mídia",
    desc: "Confronto contra um nome forte, holofotes ligados.",
    bonusInimigo: 8,
    premioDinheiro: 700,
    premioReputacao: 6,
    repMin: 25,
  },
  {
    id: "convite",
    nome: "Convite Internacional",
    desc: "Um time de elite te convidou pra um showmatch lá fora.",
    bonusInimigo: 13,
    premioDinheiro: 2500,
    premioReputacao: 12,
    repMin: 60,
  },
];

export const CHANCE_EVENTO = 0.18; // chance por semana de surgir um evento (se não houver um ativo)
