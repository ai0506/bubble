"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { formatDuration } from "@/lib/dates";

const PLAY_LABEL = "\u64ad\u653e\u8bed\u97f3";
const PAUSE_LABEL = "\u6682\u505c\u8bed\u97f3";
const VOICE_PLAY_EVENT = "bubble:voice-play";

const WAVEFORM_BARS = [
  6, 10, 14, 8, 16, 11, 6, 13, 9, 7, 12, 18, 8, 11, 15, 9, 5, 12, 16, 8, 10, 14, 7, 11, 6, 9, 13, 8,
];

type VoiceBubbleProps = {
  url: string;
  duration: number | null;
  onReady?: () => void;
};

export function VoiceBubble({ url, duration, onReady }: VoiceBubbleProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const instanceIdRef = useRef(`voice-${Math.random().toString(36).slice(2)}`);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [detectedDuration, setDetectedDuration] = useState(duration || 0);

  const totalDuration = detectedDuration || duration || 0;
  const progress = totalDuration > 0 ? Math.min(100, (currentTime / totalDuration) * 100) : 0;

  useEffect(() => {
    const currentAudio = audioRef.current;
    if (!currentAudio) return;
    const audioElement: HTMLAudioElement = currentAudio;

    function handleLoadedMetadata() {
      if (Number.isFinite(audioElement.duration) && audioElement.duration > 0) {
        setDetectedDuration(Math.round(audioElement.duration));
      }
      onReady?.();
    }

    function handleCanPlay() {
      onReady?.();
    }

    function handleTimeUpdate() {
      setCurrentTime(audioElement.currentTime);
    }

    function handlePause() {
      setPlaying(false);
    }

    function handleEnded() {
      setPlaying(false);
      setCurrentTime(0);
      audioElement.currentTime = 0;
    }

    audioElement.addEventListener("loadedmetadata", handleLoadedMetadata);
    audioElement.addEventListener("canplay", handleCanPlay);
    audioElement.addEventListener("timeupdate", handleTimeUpdate);
    audioElement.addEventListener("pause", handlePause);
    audioElement.addEventListener("ended", handleEnded);

    return () => {
      audioElement.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audioElement.removeEventListener("canplay", handleCanPlay);
      audioElement.removeEventListener("timeupdate", handleTimeUpdate);
      audioElement.removeEventListener("pause", handlePause);
      audioElement.removeEventListener("ended", handleEnded);
    };
  }, [onReady, url]);

  useEffect(() => {
    function handleOtherVoicePlay(event: Event) {
      const audio = audioRef.current;
      if (!audio) return;

      const detail = (event as CustomEvent<{ id?: string }>).detail;
      if (detail?.id === instanceIdRef.current) return;
      audio.pause();
    }

    window.addEventListener(VOICE_PLAY_EVENT, handleOtherVoicePlay);
    return () => window.removeEventListener(VOICE_PLAY_EVENT, handleOtherVoicePlay);
  }, []);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;

    if (playing) {
      audio.pause();
      return;
    }

    try {
      window.dispatchEvent(new CustomEvent(VOICE_PLAY_EVENT, { detail: { id: instanceIdRef.current } }));
      await audio.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }

  const playedBars = Math.round((progress / 100) * WAVEFORM_BARS.length);

  return (
    <div className="flex h-12 w-56 items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-ink shadow-sm transition active:scale-95"
        aria-label={playing ? PAUSE_LABEL : PLAY_LABEL}
      >
        {playing ? <Pause size={18} /> : <Play size={18} />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex h-6 items-center gap-[2px]">
          {WAVEFORM_BARS.map((height, index) => (
            <span
              key={index}
              className={`w-[2px] flex-1 rounded-full transition-colors ${
                index < playedBars ? "bg-ink" : "bg-slate-300"
              }`}
              style={{ height: `${height}px` }}
            />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-slate-500">
          <span>{formatDuration(Math.floor(currentTime))}</span>
          <span>{formatDuration(totalDuration)}</span>
        </div>
      </div>
      <audio ref={audioRef} src={url} preload="metadata" hidden playsInline />
    </div>
  );
}
