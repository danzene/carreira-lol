// 📌 Estado singleton da janela Picture-in-Picture do diorama.
// Com a PiP aberta, a cena conta como VISÍVEL mesmo com a aba principal em segundo
// plano — é o grande motivo de usar o recurso (trabalhar com o farm no canto do
// monitor). O heartbeat usa `grindVisivel()` como guard único: OR simples, sem
// dupla contagem possível (é um único acumulador de segundos).

let pipWin: Window | null = null;

export function marcarPip(w: Window | null): void {
  pipWin = w;
}

export function pipAberta(): boolean {
  return pipWin !== null && !pipWin.closed;
}

export function janelaPip(): Window | null {
  return pipAberta() ? pipWin : null;
}

// Guard de visibilidade do grind: aba visível OU janela PiP aberta.
export function grindVisivel(): boolean {
  if (typeof document === "undefined") return false;
  return document.visibilityState === "visible" || pipAberta();
}

// Suporte ao Document Picture-in-Picture (Chrome/Edge desktop).
export function suportaPip(): boolean {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
}
