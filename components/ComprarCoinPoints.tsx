"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PACOTES_MOEDA, PRODUTOS, formatarReais, type Produto } from "@/lib/produtos";
import { RARIDADES } from "@/data/gacha";
import { criarCheckout, statusPedido, type CheckoutResp } from "@/lib/lojaClient";
import { tocarSom } from "@/lib/som";
import { rastrear } from "@/lib/telemetria";
import { useProfile } from "@/store/profileStore";
import { usePasse } from "@/store/passeStore";

// 💳 Comprar CoinPoints / Passe Premium com Pix (Mercado Pago). O servidor faz tudo
// que importa (preço, cobrança, crédito); aqui só pedimos o QR e ficamos ouvindo o
// pedido até o Pix cair. Estilo casado com o resto do jogo.

type Fase = "escolha" | "gerando" | "aguardando" | "pago" | "erro";

export default function ComprarCoinPoints() {
  const recarregarPerfil = useProfile((s) => s.carregar);
  const recarregarPasse = usePasse((s) => s.carregar);
  const jaPremium = usePasse((s) => s.passe?.premium === true);

  const [fase, setFase] = useState<Fase>("escolha");
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [pix, setPix] = useState<CheckoutResp | null>(null);
  const passe = PRODUTOS.passe_premium;

  async function comprar(p: Produto) {
    setErro(null);
    setCopiado(false);
    setFase("gerando");
    rastrear("compra_iniciada", { produto: p.id, valor: p.valorCentavos });
    try {
      const resp = await criarCheckout(p.id);
      setPix(resp);
      setFase("aguardando");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "erro";
      setErro(
        msg === "pagamento_nao_configurado"
          ? "Pagamentos ainda não ativados aqui. Volte em breve!"
          : "Não deu pra gerar o Pix agora. Tenta de novo.",
      );
      setFase("erro");
    }
  }

  const aoPagar = useCallback(async () => {
    setFase("pago");
    tocarSom("moeda");
    rastrear("compra_aprovada", { produto: pix?.produto });
    await Promise.all([recarregarPerfil(), recarregarPasse()]);
  }, [pix, recarregarPerfil, recarregarPasse]);

  function fechar() {
    setPix(null);
    setFase("escolha");
    setErro(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-pixel text-[11px] text-rosa">🪙 COMPRAR COINPOINTS</h2>
        <span className="text-[10px] text-suave">via Pix</span>
      </div>

      {/* Passe Premium — oferta de lançamento */}
      <button
        type="button"
        disabled={jaPremium || fase === "gerando"}
        onClick={() => comprar(passe)}
        className="flex items-center justify-between gap-3 border-2 border-amber-400/70 bg-amber-400/10 p-3 text-left transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div className="min-w-0">
          <p className="text-sm text-amber-300">👑 Passe Premium</p>
          <p className="text-[11px] text-suave">
            {jaPremium ? "Você já tem o Passe Premium ✓" : "Libera a trilha premium do passe · oferta de lançamento"}
          </p>
        </div>
        {!jaPremium && (
          <span className="shrink-0 font-pixel text-[11px] text-amber-300">{formatarReais(passe.valorCentavos)}</span>
        )}
      </button>

      {/* Pacotes de moeda */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PACOTES_MOEDA.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={fase === "gerando"}
            onClick={() => comprar(p)}
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
          Compra de item virtual, sem valor em dinheiro real e não reembolsável após o crédito. Maiores de 18.
        </p>
      </details>

      {/* Modal Pix */}
      {(fase === "gerando" || fase === "aguardando" || fase === "pago" || fase === "erro") && (
        <ModalPix
          fase={fase}
          erro={erro}
          pix={pix}
          copiado={copiado}
          onCopiar={() => {
            if (!pix) return;
            navigator.clipboard?.writeText(pix.qrCode).then(
              () => {
                setCopiado(true);
                tocarSom("tick");
              },
              () => setCopiado(false),
            );
          }}
          onPago={aoPagar}
          onFechar={fechar}
        />
      )}
    </div>
  );
}

function ModalPix({
  fase,
  erro,
  pix,
  copiado,
  onCopiar,
  onPago,
  onFechar,
}: {
  fase: Fase;
  erro: string | null;
  pix: CheckoutResp | null;
  copiado: boolean;
  onCopiar: () => void;
  onPago: () => void;
  onFechar: () => void;
}) {
  const jaPagou = useRef(false);

  // polling do pedido enquanto aguarda o Pix cair
  useEffect(() => {
    if (fase !== "aguardando" || !pix) return;
    let vivo = true;
    const t = setInterval(async () => {
      try {
        const st = await statusPedido(pix.pedidoId);
        if (vivo && st === "aprovado" && !jaPagou.current) {
          jaPagou.current = true;
          clearInterval(t);
          onPago();
        }
      } catch {
        /* tenta na próxima */
      }
    }, 3500);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [fase, pix, onPago]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 px-4" onClick={onFechar}>
      <div className="w-full max-w-xs border-2 border-rosa bg-fundo p-4 text-center" onClick={(e) => e.stopPropagation()}>
        {fase === "gerando" && <p className="py-8 text-sm text-suave">Gerando seu Pix…</p>}

        {fase === "erro" && (
          <>
            <p className="py-6 text-sm text-rosa">{erro}</p>
            <button type="button" onClick={onFechar} className="border-2 border-borda px-4 py-1.5 text-[11px] text-suave hover:text-texto">
              Fechar
            </button>
          </>
        )}

        {fase === "aguardando" && pix && (
          <>
            <p className="font-pixel text-[11px] text-rosa">{pix.nome}</p>
            <p className="mt-0.5 text-[11px] text-suave">{formatarReais(pix.valorCentavos)} · pague pelo app do banco</p>
            {pix.qrCodeBase64 ? (
              <img src={`data:image/png;base64,${pix.qrCodeBase64}`} alt="QR Code Pix" className="mx-auto my-3 h-44 w-44 border-2 border-borda bg-white" />
            ) : (
              <div className="my-3 text-[11px] text-suave">Use o código copia-e-cola abaixo:</div>
            )}
            <button
              type="button"
              onClick={onCopiar}
              className="w-full border-2 border-rosa bg-rosa/10 px-3 py-2 font-pixel text-[10px] text-rosa transition hover:bg-rosa hover:text-fundo"
            >
              {copiado ? "✓ Copiado!" : "Copiar código Pix"}
            </button>
            <p className="mt-3 flex items-center justify-center gap-2 text-[11px] text-suave">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
              Aguardando pagamento…
            </p>
            <button type="button" onClick={onFechar} className="mt-2 text-[10px] text-suave underline hover:text-texto">
              cancelar
            </button>
          </>
        )}

        {fase === "pago" && (
          <>
            <p className="py-6 text-2xl">🎉</p>
            <p className="font-pixel text-[11px] text-ciano">Pagamento confirmado!</p>
            <p className="mt-1 text-[11px] text-suave">Seu saldo já foi creditado.</p>
            <button
              type="button"
              onClick={onFechar}
              className="mt-4 border-2 border-ciano bg-ciano/10 px-4 py-1.5 font-pixel text-[10px] text-ciano transition hover:bg-ciano hover:text-fundo"
            >
              Boa!
            </button>
          </>
        )}
      </div>
    </div>
  );
}
