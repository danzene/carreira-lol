import { NextResponse, type NextRequest } from "next/server";
import { decidirRotaAdmin } from "@/lib/adminRoute";

// Camada de UX: manda pra home quem acessa /admin sem o marcador (setado pelo layout
// admin após o /api/admin/me confirmar o papel). NÃO é segurança — o limite real é o
// requireAdmin() em cada rota de API, que revalida o token+papel no servidor.
export function middleware(req: NextRequest) {
  const temMarcador = req.cookies.get("carreira_admin")?.value === "1";
  if (decidirRotaAdmin(req.nextUrl.pathname, temMarcador) === "bloqueia") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  return NextResponse.next();
}

// Só as SUB-rotas: a entrada /admin passa livre (é ela que verifica o papel via
// /api/admin/me e seta o marcador; se não for admin, o layout redireciona).
export const config = { matcher: ["/admin/:path+"] };
