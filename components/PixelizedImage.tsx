"use client";

import { useEffect, useRef, useState } from "react";

// 🖼️ Pixeliza uma imagem em runtime pra integrá-la à estética do jogo: downscale num
// canvas pequeno com imageSmoothingEnabled=false + upscale com image-rendering:pixelated.
// Se o canvas falhar (CORS/erro de load), cai no <img> original.

export default function PixelizedImage({
  src,
  alt,
  larguraPixel = 96, // largura interna do downscale (menor = mais "pixelado")
  className,
  style,
}: {
  src: string;
  alt: string;
  larguraPixel?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [falhou, setFalhou] = useState(false);
  const [proporcao, setProporcao] = useState(2 / 3);

  useEffect(() => {
    let vivo = true;
    const img = new Image();
    img.onload = () => {
      if (!vivo) return;
      const canvas = ref.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) {
        setFalhou(true);
        return;
      }
      try {
        const prop = img.naturalHeight / Math.max(1, img.naturalWidth);
        setProporcao(prop);
        canvas.width = larguraPixel;
        canvas.height = Math.round(larguraPixel * prop);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      } catch {
        setFalhou(true);
      }
    };
    img.onerror = () => vivo && setFalhou(true);
    img.src = src;
    return () => {
      vivo = false;
    };
  }, [src, larguraPixel]);

  if (falhou) return <img src={src} alt={alt} className={className} style={style} />;
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={alt}
      className={className}
      style={{ imageRendering: "pixelated", aspectRatio: `1 / ${proporcao}`, ...style }}
    />
  );
}
