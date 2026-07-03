import { rotaAdmin } from "@/lib/adminHandler";

export const dynamic = "force-dynamic";

// Triagem de integridade do leaderboard: outliers de prova (z-score na semana) e
// winrates impossíveis de duelo. Validação DEFINITIVA vem por Edge Function na
// rodada de monetização — aqui é só sinal pra o admin investigar.
export const GET = rotaAdmin(async (admin, _ctx, req) => {
  const semana = Number(new URL(req.url).searchParams.get("semana"));
  const [outliers, duelos] = await Promise.all([
    admin.rpc("admin_prova_outliers", { p_semana: Number.isFinite(semana) && semana > 0 ? semana : null }),
    admin.rpc("admin_duelo_suspeitos"),
  ]);
  if (outliers.error) throw outliers.error;
  if (duelos.error) throw duelos.error;
  return { prova_outliers: outliers.data ?? [], duelo_suspeitos: duelos.data ?? [] };
});
