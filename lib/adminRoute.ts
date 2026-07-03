// Decisão pura do middleware de rota (testável, sem next/server).
// O middleware é camada de UX: bloqueia /admin sem o marcador de cookie. NÃO é o
// limite de segurança — esse é o requireAdmin() server-side em cada rota de API.
export function decidirRotaAdmin(pathname: string, temMarcador: boolean): "next" | "bloqueia" {
  if (!pathname.startsWith("/admin")) return "next";
  return temMarcador ? "next" : "bloqueia";
}
