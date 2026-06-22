# Deploy & Infra — Carreira LoL

Projeto **independente** do `draft lol site`: repositório, Vercel e Supabase
**próprios e separados**. Stack Next.js → Vercel faz deploy sem config (detecta
o Next automaticamente).

> 🔒 **Regra de ouro:** nenhuma chave/segredo vai pro código nem pro git.
> Segredos vivem só no `.env.local` (local, ignorado pelo git) e nas
> *Environment Variables* do Vercel.

---

## 1. GitHub (repositório próprio)

O projeto já tem `git init` feito localmente. Falta o 1º commit e o repo remoto.

```bash
cd "C:\Users\User\Desktop\Carreira LoL"
git add .
git commit -m "chore: Fase 0 + infra (Vercel/Supabase)"
```

Crie um repositório **novo** no GitHub (ex.: `carreira-lol`) e suba:

```bash
# via CLI do GitHub (gh), se você tiver:
gh repo create carreira-lol --private --source=. --remote=origin --push

# ou manualmente, depois de criar o repo vazio no site:
git remote add origin https://github.com/SEU_USUARIO/carreira-lol.git
git branch -M main
git push -u origin main
```

## 2. Supabase (banco NOVO e separado)

1. Em `supabase.com`, **New project** — crie um projeto **só do Carreira LoL**
   (não reaproveite o do draft lol). Escolha uma região e uma senha forte de DB.
2. Aguarde provisionar. Por ora o banco fica **vazio** (sem tabelas) — é isso
   que combinamos. Quando formos fazer save na nuvem, eu crio as migrations.
3. Em **Settings → API**, copie:
   - **Project URL** → vira `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → vira `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - (A chave `service_role` é secreta e **não** é usada agora — não exponha.)

## 3. Variáveis de ambiente

**Local** (`.env.local`, já criado em branco) — preencha:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (a anon public)
```

> As `NEXT_PUBLIC_*` são embutidas no build, então precisam existir **também no
> Vercel antes do build**.

## 4. Vercel (deploy contínuo)

1. Em `vercel.com`, **Add New → Project** e importe o repo `carreira-lol` do GitHub.
2. Framework: o Vercel detecta **Next.js** sozinho (sem config).
3. Em **Settings → Environment Variables**, adicione (nos ambientes Production +
   Preview + Development):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. **Deploy.** A partir daí, todo `git push` na branch principal publica
   automaticamente.

## Estado atual

- Banco: **vazio de propósito** (sem schema). O cliente está pronto em
  `lib/supabaseClient.ts` (`getSupabase()` / `isSupabaseConfigured()`), mas
  **nada o usa ainda** — o save do jogo segue em `localStorage`.
- Quando você quiser **save na nuvem / login**, a gente liga: eu crio as
  migrations (tabelas + RLS) e o código de integração.
