"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { rastrearTela } from "@/lib/telemetria";

// 📊 Registra `tela_visitada` (throttled a 1x/30s por rota). Invisível, nunca quebra.

export default function TelemetriaTela() {
  const pathname = usePathname();
  useEffect(() => {
    if (pathname) rastrearTela(pathname);
  }, [pathname]);
  return null;
}
