"use client";

import { useEffect, useState } from "react";
import { PACOTES_MOEDA, formatarReais, type Produto } from "@/lib/produtos";
import { RARIDADES } from "@/data/gacha";
import {
  cancelarAssinatura,
  criarAssinatura,
  criarCheckout,
  statusAssinatura,
  statusPedido,
  type StatusAssinatura,
} from "@/lib/lojaClient";
import { tocarSom } from "@/lib/som";
import { rastrear } from "@/lib/telemetria";
import { useProfile } from "@/store/profileStore";
import { usePasse } from "@/store/passeStore";

// 💳 Comprar CoinPoints (Pix ou cartão via Checkout Pro) e assinar o Passe Premium
// (cartão recorrente, R$9,90/mês até cancelar). O servidor faz tudo que importa
// (preço, cobrança, crédito); aqui a gente redireciona pro MP e trata o retorno.

function msgErro(e: unknown): string {
  const m = e instanceof Error ? e.message : "";
  if (m === "pagamento_nao_configurado") return "Pagamentos ainda não ativados aqui. Volte em breve!";
  if (m === "sem_email") return "Sua conta precisa de um e-mail pra pagar.";
  if (m === "falha_checkout" || m === "falha_assinatura" || !m) return "Não deu pra continuar agora. Tenta de novo.";
  return `Erro do Mercado Pago: ${m}`; // mostra o motivo real (diagnóstico)
}

const fmtData = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—");

export default function ComprarCoinPoints() {
  const recarregarPerfil = useProfile((s) => s.carregar);
  const recarregarPasse = usePasse((s) => s.carregar);

  const [ass, setAss] = useState<StatusAssinatura | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null); // id da ação em andamento
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // status da assinatura ao abrir
  useEffect(() => {
    statusAssinatura().then(setAss).catch(() => {});
  }, []);

  // retorno do Checkout Pro / assinatura (back_url do MP)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const pedido = q.get("pedido");
    const assin = q.get("assinatura");
    if (!pedido && !assin) return;
    (async () => {
      if (pedido) {
        try {
          await statusPedido(pedido); // força confirmar no MP se o webhook atrasou
        } catch {
          /* ignora */
        }
        await recarregarPerfil();
        setAviso("Pagamento recebido! Seu saldo foi atualizado. 🎉");
        tocarSom("moeda");
      }
      if (assin) {
        const s = await statusAssinatura().catch(() => null);
        if (s) setAss(s);
        await recarregarPasse();
        setAviso("Assinatura ativada! Passe Premium liberado. 👑");
        tocarSom("moeda");
      }
      window.history.replaceState({}, "", "/loja"); // limpa a query
    })();
  }, [recarregarPerfil, recarregarPasse]);

  async function comprarMoedas(p: Produto) {
    setErro(null);
    setOcupado(p.id);
    rastrear("compra_iniciada", { produto: p.id, valor: p.valorCentavos });
    try {
      const { initPoint } = await criarCheckout(p.id);
      window.location.href = initPoint; // Checkout Pro (Pix + cartão)
    } catch (e) {
      setErro(msgErro(e));
      setOcupado(null);
    }
  }

  async function assinar() {
    setErro(null);
    setOcupado("passe");
    rastrear("assinatura_iniciada", {});
    try {
      const initPoint = await criarAssinatura();
      window.location.href = initPoint; // página do cartão no MP
    } catch (e) {
      setErro(msgErro(e));
      setOcupado(null);
    }
  }

  async function cancelar() {
    if (!window.confirm("Cancelar a assinatura? O Premium continua ativo até o fim do período já pago.")) return;
    setOcupado("cancelar");
    try {
      await cancelarAssinatura();
      const s = await statusAssinatura().catch(() => null);
      if (s) setAss(s);
      setAviso("Assinatura cancelada. Premium segue até o fim do período pago.");
    } catch {
      setErro("Não deu pra cancelar agora. Tenta de novo.");
    }
    setOcupado(null);
  }

  const premiumAtivo = ass?.premiumAtivo ?? false;
  const cancelada = ass?.status === "cancelada";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-pixel text-[11px] text-rosa">🪙 COMPRAR</h2>
        <span className="text-[10px] text-suave">Pix ou cartão</span>
      </div>

      {aviso && <p className="border-2 border-ciano/40 bg-ciano/10 p-2 text-sm text-ciano">{aviso}</p>}
      {erro && <p className="border-2 border-rosa/40 bg-rosa/10 p-2 text-sm text-rosa">{erro}</p>}

      {/* Passe Premium — assinatura recorrente */}
      {premiumAtivo ? (
        <div className="flex items-center justify-between gap-3 border-2 border-amber-400/70 bg-amber-400/10 p-3">
          <div className="min-w-0">
            <p className="text-sm text-amber-300">👑 Passe Premium ativo</p>
            <p className="text-[11px] text-suave">
              {cancelada
                ? `Cancelada — ativo até ${fmtData(ass?.premiumAte ?? null)}`
                : `Renova em ${fmtData(ass?.proximoPagamento ?? ass?.premiumAte ?? null)} · R$ 9,90/mês`}
            </p>
          </div>
          {!cancelada && (
            <button
              type="button"
              disabled={ocupado === "cancelar"}
              onClick={cancelar}
              className="shrink-0 border-2 border-borda px-3 py-1.5 text-[10px] text-suave transition hover:border-rosa hover:text-rosa disabled:opacity-50"
            >
              {ocupado === "cancelar" ? "…" : "Cancelar"}
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={ocupado === "passe"}
          onClick={assinar}
          className="flex items-center justify-between gap-3 border-2 border-amber-400/70 bg-amber-400/10 p-3 text-left transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <div className="min-w-0">
            <p className="text-sm text-amber-300">👑 Assinar Passe Premium</p>
            <p className="text-[11px] text-suave">Libera a trilha premium · cobra no cartão, cancela quando quiser</p>
          </div>
          <span className="shrink-0 text-right font-pixel text-[11px] text-amber-300">
            R$ 9,90<span className="block text-[8px] text-suave">/mês</span>
          </span>
        </button>
      )}

      {/* Pacotes de moeda */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PACOTES_MOEDA.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={ocupado !== null}
            onClick={() => comprarMoedas(p)}
            className="relative flex flex-col items-center gap-1 border-2 border-borda bg-painel p-3 transition hover:border-rosa disabled:opacity-50"
          >
            {p.destaque && (
              <span className="absolute -top-2 right-1 border border-rosa bg-fundo px-1 text-[8px] text-rosa">{p.destaque}</span>
            )}
            <span className="font-pixel text-[13px] text-rosa">🪙 {p.moedas.toLocaleString("pt-BR")}</span>
            <span className="text-[11px] text-texto">{formatarReais(p.valorCentavos)}</span>
          </button>
        ))}
      </div>

      {/* Chances do gacha — transparência (boa prática legal) */}
      <details className="border-2 border-borda bg-painel/50 p-2 text-[11px] text-suave">
        <summary className="cursor-pointer select-none text-texto">🎲 Chances do Scout Gacha</summary>
        <ul className="mt-2 flex flex-col gap-0.5">
          {RARIDADES.map((r) => (
            <li key={r.n} className="flex items-center justify-between">
              <span style={{ color: r.cor }}>
                {r.n}★ {r.nome}
              </span>
              <span>{(r.chance * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[10px] text-suave">
          Compra de item virtual, sem valor em dinheiro real e não reembolsável após o crédito. Maiores de 18. A assinatura
          renova automaticamente até você cancelar.
        </p>
      </details>
    </div>
  );
}
