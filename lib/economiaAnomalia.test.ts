import { describe, expect, it } from "vitest";
import { classificarAnomalia } from "./economiaAnomalia";

describe("detector de anomalia de economia", () => {
  it("delta = saldo − soma dos eventos; severidade cresce com a magnitude", () => {
    expect(classificarAnomalia(1000, 1000)).toEqual({ delta: 0, severidade: "ok" });
    expect(classificarAnomalia(1050, 1000).severidade).toBe("ok"); // 50 = ruído de telemetria
    expect(classificarAnomalia(1400, 1000).severidade).toBe("baixa"); // 400
    expect(classificarAnomalia(2500, 1000).severidade).toBe("media"); // 1500
    expect(classificarAnomalia(9000, 1000).severidade).toBe("alta"); // 8000 (trapaça provável)
  });

  it("pega tanto crédito indevido (delta+) quanto débito não registrado (delta−)", () => {
    expect(classificarAnomalia(5000, 100).delta).toBe(4900);
    expect(classificarAnomalia(100, 5000).delta).toBe(-4900);
    expect(classificarAnomalia(100, 5000).severidade).toBe("alta");
  });
});
