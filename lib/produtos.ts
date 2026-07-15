// 🛒 Catálogo de produtos da loja — FONTE DA VERDADE do preço e do que se recebe.
// O cliente só manda o `id`; o servidor lê o valor/moedas AQUI (nunca confia em
// preço vindo do cliente). O mesmo módulo é usado na UI só pra exibir.
//
// valorCentavos = quanto a pessoa paga (em centavos de R$). moedas = CoinPoints
// creditados. concedePasse = liga o Passe Premium. destaque = selo visual.

export interface Produto {
  id: string;
  nome: string;
  valorCentavos: number;
  moedas: number;
  concedePasse: boolean;
  destaque?: string;
}

export const PRODUTOS: Record<string, Produto> = {
  passe_premium: { id: "passe_premium", nome: "Passe Premium", valorCentavos: 990, moedas: 0, concedePasse: true, destaque: "Oferta de lançamento" },

  moedas_10:  { id: "moedas_10",  nome: "1.000 moedas",  valorCentavos: 1000,  moedas: 1000,  concedePasse: false },
  moedas_25:  { id: "moedas_25",  nome: "2.700 moedas",  valorCentavos: 2500,  moedas: 2700,  concedePasse: false, destaque: "+8%" },
  moedas_50:  { id: "moedas_50",  nome: "5.750 moedas",  valorCentavos: 5000,  moedas: 5750,  concedePasse: false, destaque: "+15%" },
  moedas_100: { id: "moedas_100", nome: "12.500 moedas", valorCentavos: 10000, moedas: 12500, concedePasse: false, destaque: "+25%" },
  moedas_200: { id: "moedas_200", nome: "27.000 moedas", valorCentavos: 20000, moedas: 27000, concedePasse: false, destaque: "+35%" },
  moedas_300: { id: "moedas_300", nome: "45.000 moedas", valorCentavos: 30000, moedas: 45000, concedePasse: false, destaque: "+50% · melhor" },
};

/** Lista os pacotes de moeda (sem o passe), na ordem de preço. */
export const PACOTES_MOEDA: Produto[] = [
  PRODUTOS.moedas_10, PRODUTOS.moedas_25, PRODUTOS.moedas_50,
  PRODUTOS.moedas_100, PRODUTOS.moedas_200, PRODUTOS.moedas_300,
];

export function produto(id: string): Produto | null {
  return PRODUTOS[id] ?? null;
}

/** "R$ 9,90" a partir de centavos. */
export function formatarReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
