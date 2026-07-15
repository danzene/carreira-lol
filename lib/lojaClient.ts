import { getSupabase } from "./supabaseClient";

// Cliente da loja (browser): anexa o access_token da sessão nos endpoints de compra.
// O servidor valida tudo; aqui só transportamos o token e o id do produto.

async function token(): Promise<string | undefined> {
  const { data } = await getSupabase().auth.getSession();
  return data.session?.access_token;
}

export interface CheckoutResp {
  pedidoId: string;
  produto: string;
  nome: string;
  valorCentavos: number;
  qrCode: string; // copia e cola
  qrCodeBase64: string; // imagem do QR (base64)
  ticketUrl: string | null;
}

export async function criarCheckout(produto: string): Promise<CheckoutResp> {
  const t = await token();
  const res = await fetch("/api/loja/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: JSON.stringify({ produto }),
  });
  if (!res.ok) {
    const erro = (await res.json().catch(() => ({})))?.error as string | undefined;
    throw new Error(erro ?? `checkout ${res.status}`);
  }
  return res.json() as Promise<CheckoutResp>;
}

export async function statusPedido(id: string): Promise<string> {
  const t = await token();
  const res = await fetch(`/api/loja/pedido/${id}`, {
    headers: t ? { Authorization: `Bearer ${t}` } : {},
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`status ${res.status}`);
  return ((await res.json()) as { status: string }).status;
}
