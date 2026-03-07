"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { clamp } from "@/lib/utils/math";
import { getSupabaseClient } from "@/lib/supabase/client";
import { get, set, del } from "idb-keyval"; // 魔法のツールをインポート！

export function useAudio() {
  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(0);
  
  // 録音した音声データを保存する新しいステート
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // ユーザーID管理（useGardenと同じ仕組み）
  const [userId, setUserId] = useState<string | null>(null);

  // マイクや録音機能を裏側で管理するためのRefたち
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 1. ユーザーIDの取得
  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || "local_guest");
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id || "local_guest");
    });
    return () => subscription.unsubscribe();
  }, []);

  // 2. ページ読み込み時にIndexedDBから音声を復元する
  useEffect(() => {
    if (!userId) return;
    // IndexedDBからデータを引っ張り出す
    get(`kazenagare_audio_${userId}`).then((savedBlob) => {
      if (savedBlob instanceof Blob) {
        setAudioBlob(savedBlob);
        setAudioUrl(URL.createObjectURL(savedBlob));
      }
    });
  }, [userId]);

  // 古いURLのメモリ解放（ブラウザが重くなるのを防ぐプロの技）
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  // 3. マイクの起動と録音スタート
  const startListening = async () => {
    try {
      // ブラウザにマイクの許可を求める
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 音量（ボリューム）を計算するための準備
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      // 録音機の準備（軽く圧縮されるwebm形式を指定）
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      // 音声データが細切れで送られてくるので、配列に貯める
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      // 録音が終わった瞬間の処理
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));

        // ここがキモ！IndexedDBに音声ファイルを超速で保存！
        if (userId) {
          await set(`kazenagare_audio_${userId}`, blob);
        }
      };

      mediaRecorder.start();
      setIsListening(true);

      // リアルタイムで音量を計算して画面に送るループ
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        const sum = dataArray.reduce((a, b) => a + b, 0);
        const avg = sum / dataArray.length;
        // 0〜1の間にギュッと丸める
        setVolume(clamp(avg / 128, 0, 1));
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

    } catch (err) {
      console.error("マイクのアクセスに失敗しました:", err);
      alert("マイクの使用を許可してください！");
    }
  };

  // 4. マイクの停止と録音終了
  const stopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop(); // ここでonstopが発動して保存される
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop()); // マイクの赤いランプを消す
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    setIsListening(false);
    setVolume(0);
  };

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, userId]); // userIdがないと保存できないので依存配列に追加

  // やり直したい時用に、音声を削除する機能も作っておく
  const clearAudio = useCallback(async () => {
    setAudioBlob(null);
    setAudioUrl(null);
    if (userId) {
      await del(`kazenagare_audio_${userId}`); // IndexedDBからも削除
    }
  }, [userId]);

  return {
    isListening,
    volume,
    audioBlob,       // サーバーに送る時用のデータ本体
    audioUrl,        // 画面で再生して確認する用のURL
    toggleListening,
    clearAudio,      // 追加：録音を消す関数
  };
}