// Busca a lista de campeões do Data Dragon (grátis, sem chave) e cacheia em localStorage.
// Usado só no cliente (componentes "use client").

export interface Campeao {
  id: string; // ex.: "Aatrox"
  nome: string; // nome localizado
  icone: string; // URL do ícone
  tags: string[]; // ex.: ["Fighter", "Tank"]
}

const LOCALE = "pt_BR";
const VERSOES_URL = "https://ddragon.leagueoflegends.com/api/versions.json";
const CACHE_KEY = "carreira-lol:ddragon:campeoes:v1";

interface Cache {
  versao: string;
  campeoes: Campeao[];
}

interface CampeaoDDragon {
  id: string;
  name: string;
  image: { full: string };
  tags: string[];
}

async function versaoMaisRecente(): Promise<string> {
  const r = await fetch(VERSOES_URL);
  if (!r.ok) throw new Error("Falha ao buscar versões do Data Dragon.");
  const versoes = (await r.json()) as string[];
  return versoes[0];
}

function lerCache(): Cache | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Cache) : null;
  } catch {
    return null;
  }
}

function gravarCache(cache: Cache): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage cheio/indisponível — segue sem cache
  }
}

export async function buscarCampeoes(): Promise<Campeao[]> {
  const versao = await versaoMaisRecente();

  const cache = lerCache();
  if (cache && cache.versao === versao) return cache.campeoes;

  const url = `https://ddragon.leagueoflegends.com/cdn/${versao}/data/${LOCALE}/champion.json`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("Falha ao buscar campeões do Data Dragon.");

  const json = (await r.json()) as { data: Record<string, CampeaoDDragon> };

  const campeoes: Campeao[] = Object.values(json.data)
    .map((c) => ({
      id: c.id,
      nome: c.name,
      icone: `https://ddragon.leagueoflegends.com/cdn/${versao}/img/champion/${c.image.full}`,
      tags: c.tags,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  gravarCache({ versao, campeoes });
  return campeoes;
}
