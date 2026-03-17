"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { clamp } from "@/lib/utils/math";
import { getSupabaseClient, getSupabaseSessionOrNull } from "@/lib/supabase/client";
import { get, set, del } from "idb-keyval";

export function useAudio() {
  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(0);
  
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    
    void getSupabaseSessionOrNull(supabase).then((session) => {
      setUserId(session?.user?.id || "local_guest");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || "local_guest");
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    get(`kazenagare_audio_${userId}`).then((savedBlob) => {
      if (savedBlob instanceof Blob) {
        setAudioBlob(savedBlob);
        setAudioUrl(URL.createObjectURL(savedBlob));
      }
    });
  }, [userId]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 【修正ポイント】anyを使わずに型を定義してパトロール隊を黙らせる！
      const CustomWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
      const audioCtx = new (window.AudioContext || CustomWindow.webkitAudioContext!)();
      
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));

        if (userId) {
          await set(`kazenagare_audio_${userId}`, blob);
        }
      };

      mediaRecorder.start();
      setIsListening(true);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const avg = sum / dataArray.length;
        setVolume(clamp(avg / 128, 0, 1));
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

    } catch (err) {
      console.error("マイクのアクセスに失敗しました:", err);
      alert("マイクの使用を許可してください！");
    }
  }, [userId]);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsListening(false);
    setVolume(0);
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const clearAudio = useCallback(async () => {
    setAudioBlob(null);
    setAudioUrl(null);
    if (userId) {
      await del(`kazenagare_audio_${userId}`);
    }
  }, [userId]);

  return {
    isListening,
    volume,
    audioBlob,
    audioUrl,
    toggleListening,
    clearAudio,
  };
}