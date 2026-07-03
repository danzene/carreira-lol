import { getSupabase } from "./supabaseClient";

// Cliente admin (browser): anexa o access_token da sessão (localStorage) no header.
// O servidor (requireAdmin) é quem valida o papel — aqui só transportamos o token.
export async function fetchAdmin<T = unknown>(path: string, dias?: number): Promise<T> {
  const sb = getSupabase();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  const url = dias !== undefined ? `/api/admin/${path}${path.includes("?") ? "&" : "?"}dias=${dias}` : `/api/admin/${path}`;
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {}, cache: "no-store" });
  if (!res.ok) throw new Error(`admin ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function postAdmin<T = unknown>(path: string, body: unknown): Promise<T> {
  const sb = getSupabase();
  const { data } = await sb.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`/api/admin/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `admin ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}
