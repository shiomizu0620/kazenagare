"use client";

import { useCallback, useEffect, useState } from "react";
import { clamp } from "@/lib/utils/math";

export function useAudio() {
  const [isListening, setIsListening] = useState(false);
  const [measuredVolume, setMeasuredVolume] = useState(0);

  useEffect(() => {
    if (!isListening) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setMeasuredVolume(clamp(Math.random(), 0, 1));
    }, 120);

    return () => window.clearInterval(intervalId);
  }, [isListening]);

  const toggleListening = useCallback(() => {
    setIsListening((current) => !current);
  }, []);

  return {
    isListening,
    volume: isListening ? measuredVolume : 0,
    toggleListening,
  };
}
