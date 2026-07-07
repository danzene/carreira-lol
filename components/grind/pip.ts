// 📌 Estado singleton da janela Picture-in-Picture do diorama.
// Com a PiP aberta, a cena conta como VISÍVEL mesmo com a aba principal em segundo
// plano — é o grande motivo de usar o recurso (trabalhar com o farm no canto do
// monitor). O heartbeat usa `grindVisivel()` como guard ÚNICO sobre UM acumulador
// de segundos: dupla contagem é impossível por construção (OR não soma duas vezes).

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

// Decisão PURA (testada): a cena/heartbeat estão "efetivamente visíveis"?
// só aba ⇒ conta · só PiP ⇒ conta · ambas ⇒ conta UMA vez · nenhuma ⇒ não conta.
export function visibilidadeEfetiva(abaVisivel: boolean, pipVisivel: boolean): boolean {
  return abaVisivel || pipVisivel;
}

// Guard de visibilidade do grind (borda): lê o documento + o singleton da PiP.
export function grindVisivel(): boolean {
  if (typeof document === "undefined") return false;
  return visibilidadeEfetiva(document.visibilityState === "visible", pipAberta());
}

// Suporte ao Document Picture-in-Picture (Chrome/Edge desktop).
export function suportaPip(): boolean {
  return typeof window !== "undefined" && "documentPictureInPicture" in window;
}
