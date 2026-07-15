# 💳 Loja de Pagamentos (Mercado Pago / Pix)

Venda de **CoinPoints** (moeda do gacha) e do **Passe Premium** com Pix, tudo
server-authoritative. Modelo de "doação com recompensa" no estilo PxG — mas tratado
tecnicamente como **venda de bem digital** (é o que é juridicamente).

## Arquitetura (por que é seguro)

```
cliente pede comprar → /api/loja/checkout (cria pedido + cobrança Pix no MP)
   → pessoa paga no app do banco (o servidor NUNCA vê cartão/conta)
   → webhook do MP → /api/webhooks/mercadopago (valida assinatura HMAC)
      → creditarSePago(): busca a verdade no MP, credita UMA vez (claim atômico)
```

- **Preço vem do servidor** (`lib/produtos.ts`), nunca do cliente.
- **Crédito só pelo servidor** (service_role → função SQL `creditar_compra`, incremento
  atômico). O RPC do cliente (`ajustar_coinpoints`, teto 700) não credita compra.
- **Premium autoritativo**: coluna `battle_pass.premium` que o cliente lê mas não escreve
  (o `update` é revogado; o upsert dele nunca a inclui).
- **Idempotente**: `pedidos.creditado_at` via claim atômico — webhook pode disparar 2x
  sem creditar em dobro. Fallback: o polling do pedido (`/api/loja/pedido/[id]`) também
  confirma no MP, caso o webhook atrase.
- **Assinatura do webhook** validada (HMAC, `WebhookSignatureValidator`, tolerância 300s).
  Sem `MP_WEBHOOK_SECRET`, o webhook rejeita tudo (fail-closed).

## Tabela de preços (ajustável em `lib/produtos.ts`)

| Produto | Paga | Recebe |
|---|---|---|
| Passe Premium | R$ 9,90 | trilha premium do passe |
| Pacote | R$ 10 | 🪙 1.000 |
| Pacote +8% | R$ 25 | 🪙 2.700 |
| Pacote +15% | R$ 50 | 🪙 5.750 |
| Pacote +25% | R$ 100 | 🪙 12.500 |
| Pacote +35% | R$ 200 | 🪙 27.000 |
| Pacote +50% | R$ 300 | 🪙 45.000 |

## Passo a passo pra ATIVAR (você faz no Mercado Pago)

1. **Conta** em mercadopago.com.br (CPF ou MEI).
2. **Suas Integrações → Criar aplicação** (modelo: pagamentos online). Copie:
   - **Access Token** (comece pelo de **teste**; troque pelo de produção no lançamento).
3. **Webhooks / Notificações** → configurar → evento **Pagamentos** → URL:
   `https://carreira-lol.vercel.app/api/webhooks/mercadopago`
   → gere a **chave secreta** da assinatura.
4. **Vercel → Settings → Environment Variables** (Production):
   - `MP_ACCESS_TOKEN` = o Access Token
   - `MP_WEBHOOK_SECRET` = a chave secreta do webhook
   - (redeploy depois de adicionar)
5. **Supabase** → rode `setup-base.sql` (já inclui a migration 023: `pedidos`,
   `premium`, `creditar_compra`) e `setup-admin.sql` v13 (migration 024: receita real).
6. **Teste** com as credenciais de teste + um comprador de teste do MP antes de ir a
   dinheiro real.

## Admin

Painel `/admin/economia` ganhou o bloco **Receita real (R$)** — receita, pedidos pagos,
ticket médio, por dia e por produto (fonte: tabela `pedidos`, status `aprovado`).

## Pendências conhecidas (rodada futura)

- Ganho de moeda **por gameplay** ainda é client-side (teto 700 por chamada). A COMPRA é
  segura; o farm de moeda de jogo é a próxima rodada de server-authority.
- Reembolso: hoje "não reembolsável após crédito" no aviso. Se for oferecer estorno,
  tratar o evento `refunded` do MP e debitar.
- Nota fiscal / imposto: encaminhar com um contador (a receita é tributável).
