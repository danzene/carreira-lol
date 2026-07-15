# 💳 Loja de Pagamentos (Mercado Pago)

- **Moedas (CoinPoints):** compra avulsa via **Checkout Pro** — aceita **Pix e cartão**.
- **Passe Premium:** **assinatura recorrente** (cartão) de **R$9,90/mês** até cancelar
  (Netflix-style), via API de Assinaturas (**PreApproval**).

Tudo server-authoritative. Tratado como **venda de bem digital** (é o que é juridicamente,
independente do rótulo "doação").

## Arquitetura (por que é seguro)

**Moedas (Checkout Pro):**
```
/api/loja/checkout (cria pedido + preferência Checkout Pro) → pessoa paga no MP (Pix/cartão)
   → webhook type=payment → creditarSePago(): verdade no MP, credita 1x (claim atômico)
```

**Assinatura do Premium (PreApproval):**
```
/api/loja/assinar (cria preapproval) → pessoa autoriza o cartão no MP
   → webhook type=subscription_preapproval → sincronizarAssinatura(): liga premium com
     VALIDADE (premium_ate = próximo pagamento + graça). Renova mês a mês; cancelou → não
     estende mais e expira sozinho. Fallback: GET /api/loja/assinatura re-sincroniza.
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
| Passe Premium | R$ 9,90 **/mês** (assinatura) | trilha premium enquanto assinar |
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
5. **Supabase** → rode `setup-base.sql` (migrations 023 `pedidos`/`creditar_compra` +
   025 `assinaturas`/`ativar_premium`/`premium_ate`) e `setup-admin.sql` v13 (024 receita).
6. **Habilite cartão e assinaturas na conta MP** — Pix costuma liberar na hora, mas
   **cartão e Assinaturas (PreApproval) podem exigir completar o cadastro/verificação**
   da conta. Sem isso, o Checkout Pro com cartão e a assinatura não funcionam.
7. **Teste** com credenciais e **cartões de teste** do MP (dinheiro fake) antes de ir a
   dinheiro real — tanto uma compra de moedas (Pix + cartão) quanto uma assinatura.

## Admin

Painel `/admin/economia` ganhou o bloco **Receita real (R$)** — receita, pedidos pagos,
ticket médio, por dia e por produto (fonte: tabela `pedidos`, status `aprovado`).

## Pendências conhecidas (rodada futura)

- Ganho de moeda **por gameplay** ainda é client-side (teto 700 por chamada). A COMPRA é
  segura; o farm de moeda de jogo é a próxima rodada de server-authority.
- **Renovação da assinatura** depende do webhook `subscription_preapproval` + do fallback
  (a pessoa abrir a loja re-sincroniza o `premium_ate`). Sem cron, se alguém pagar e sumir
  por semanas, o premium só reflete a renovação no próximo acesso — aceitável no MVP.
- Reembolso/estorno: tratar `refunded`/`chargeback` do MP e debitar/revogar.
- Nota fiscal / imposto: encaminhar com um contador (a receita é tributável).
