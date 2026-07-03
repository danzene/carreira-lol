import { describe, expect, it } from "vitest";
import { autorizarAdmin } from "./adminAuth";
import { decidirRotaAdmin } from "./adminRoute";

// Segurança do admin: a decisão pura de autorização (usada pelo requireAdmin em TODA
// rota) e a decisão do middleware (camada de UX). Ambas cobertas por teste.

describe("autorizarAdmin (limite de segurança das rotas)", () => {
  it("só o papel 'admin' passa", () => {
    expect(autorizarAdmin("admin")).toBe(true);
    expect(autorizarAdmin("player")).toBe(false);
    expect(autorizarAdmin(undefined)).toBe(false); // perfil sem role / inexistente
    expect(autorizarAdmin(null)).toBe(false);
    expect(autorizarAdmin("Admin")).toBe(false); // case-sensitive de propósito
    expect(autorizarAdmin("")).toBe(false);
  });
});

describe("decidirRotaAdmin (middleware / UX)", () => {
  it("bloqueia /admin sem marcador; libera com marcador; ignora fora de /admin", () => {
    expect(decidirRotaAdmin("/admin/economia", false)).toBe("bloqueia");
    expect(decidirRotaAdmin("/admin/economia", true)).toBe("next");
    expect(decidirRotaAdmin("/dashboard", false)).toBe("next");
    expect(decidirRotaAdmin("/", false)).toBe("next");
  });
});
