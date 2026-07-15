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
  initPoint: string; // URL do Checkout Pro (Pix + cartão)
}

export async function criarCheckout(produto: string): Promise<CheckoutResp> {
  const t = await token();
  const res = await fetch("/api/loja/checkout", {
    method: "POST",
    headers: { "content-type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    body: JSON.stringify({ produto }),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string; detalhe?: string };
    throw new Error(j.detalhe || j.error || `checkout ${res.status}`);
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

// ── Assinatura do Passe Premium (cartão recorrente) ──────────────────────────

export interface StatusAssinatura {
  status: string; // nenhuma | pendente | autorizada | pausada | cancelada
  proximoPagamento: string | null;
  premiumAte: string | null;
  premiumAtivo: boolean;
}

export async function criarAssinatura(): Promise<string> {
  const t = await token();
  const res = await fetch("/api/loja/assinar", {
    method: "POST",
    headers: t ? { Authorization: `Bearer ${t}` } : {},
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string; detalhe?: string };
    throw new Error(j.detalhe || j.error || `assinar ${res.status}`);
  }
  return ((await res.json()) as { initPoint: string }).initPoint;
}

export async function cancelarAssinatura(): Promise<void> {
  const t = await token();
  const res = await fetch("/api/loja/cancelar-assinatura", {
    method: "POST",
    headers: t ? { Authorization: `Bearer ${t}` } : {},
  });
  if (!res.ok) throw new Error(`cancelar ${res.status}`);
}

export async function statusAssinatura(): Promise<StatusAssinatura> {
  const t = await token();
  const res = await fetch("/api/loja/assinatura", {
    headers: t ? { Authorization: `Bearer ${t}` } : {},
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`status assinatura ${res.status}`);
  return res.json() as Promise<StatusAssinatura>;
}
