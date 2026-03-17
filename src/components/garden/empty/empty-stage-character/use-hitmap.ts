import { useEffect, useState } from "react";
import type { HitmapData } from "./empty-stage-character.types";

export function useHitmap(
  hitmapUrl: string | undefined,
  worldWidth: number,
  worldHeight: number,
) {
  const [hitmapData, setHitmapData] = useState<HitmapData | null>(null);

  useEffect(() => {
    if (!hitmapUrl) {
      setHitmapData(null);
      return;
    }

    let isCancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      if (isCancelled) return;
      
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      setHitmapData({
        data: new Uint8ClampedArray(imageData.data),
        width: img.width,
        height: img.height,
        worldWidth,
        worldHeight,
      });
    };

    img.onerror = () => {
      if (!isCancelled) setHitmapData(null);
    };

    img.src = hitmapUrl;

    return () => {
      isCancelled = true;
    };
  }, [hitmapUrl, worldWidth, worldHeight]);

  return hitmapData;
}
