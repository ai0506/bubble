"use client";

import Image from "next/image";
import { X, User, Play, Pause } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { VoiceBubble } from "@/components/VoiceBubble";
import { formatClock } from "@/lib/dates";
import type { ChatMessage } from "@/lib/types";

const ME_LABEL = "\u6211";
const IMAGE_ALT = "\u804a\u5929\u56fe\u7247";
const PREVIEW_ALT = "\u653e\u5927\u67e5\u770b\u804a\u5929\u56fe\u7247";
const CLOSE_PREVIEW_LABEL = "\u5173\u95ed\u56fe\u7247\u9884\u89c8";
const LIVE_LABEL = "\u5b9e\u51b5"; // \u5b9e\u51b5
const PLAY_MOTION_LABEL = "\u64ad\u653e\u5b9e\u51b5\u89c6\u9891"; // \u64ad\u653e\u5b9e\u51b5\u89c6\u9891
const ADMIN_AVATAR_ALT = "asw";
const IMAGE_BOX_MAX_WIDTH = 260;
const IMAGE_BOX_MAX_HEIGHT = 288;
const IMAGE_BOX_FALLBACK = { width: 260, height: 180 };

type MediaSize = {
  width: number;
  height: number;
};

type ChatBubbleProps = {
  message: ChatMessage;
  viewerName: string;
  onMediaReady?: () => void;
};

function UserAvatar() {
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-300 text-slate-500">
      <User size={17} />
    </div>
  );
}

function AdminAvatar() {
  return (
    <Image
      src="/profile_image.webp"
      alt={ADMIN_AVATAR_ALT}
      width={32}
      height={32}
      className="h-8 w-8 shrink-0 rounded-full object-cover"
      priority
    />
  );
}

export function ChatBubble({ message, viewerName, onMediaReady }: ChatBubbleProps) {
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaSize, setMediaSize] = useState<MediaSize | null>(null);
  const [motionUrl, setMotionUrl] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [motionPlaying, setMotionPlaying] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const isUser = message.sender_kind === "user";

  useEffect(() => {
    let cancelled = false;

    async function loadMedia() {
      if (!message.media_path) {
        setMediaUrl("");
        setMediaSize(null);
        return;
      }

      const isStillImage = message.type === "image" || message.type === "gif" || message.type === "motion";
      const mediaWidth = isStillImage ? "520" : "";
      const params = new URLSearchParams({ mediaPath: message.media_path });
      if (mediaWidth) params.set("width", mediaWidth);
      if (!cancelled) {
        setMediaUrl(`/api/media/file?${params.toString()}`);
        setMediaSize(null);
        window.requestAnimationFrame(() => onMediaReady?.());
      }
    }

    loadMedia();
    return () => {
      cancelled = true;
    };
  }, [message.media_path, message.type, onMediaReady]);

  useEffect(() => {
    const isStillImage = message.type === "image" || message.type === "gif" || message.type === "motion";
    if (!mediaUrl || !isStillImage) return;

    let cancelled = false;
    const probe = new window.Image();
    probe.onload = () => {
      if (cancelled) return;

      const naturalWidth = probe.naturalWidth || IMAGE_BOX_FALLBACK.width;
      const naturalHeight = probe.naturalHeight || IMAGE_BOX_FALLBACK.height;
      const scale = Math.min(IMAGE_BOX_MAX_WIDTH / naturalWidth, IMAGE_BOX_MAX_HEIGHT / naturalHeight, 1);
      setMediaSize({
        width: Math.round(naturalWidth * scale),
        height: Math.round(naturalHeight * scale),
      });
      window.requestAnimationFrame(() => onMediaReady?.());
    };
    probe.onerror = () => {
      if (!cancelled) setMediaSize(IMAGE_BOX_FALLBACK);
    };
    probe.src = mediaUrl;

    return () => {
      cancelled = true;
    };
  }, [mediaUrl, message.type, onMediaReady]);

  useEffect(() => {
    if (message.type !== "motion" || !message.motion_video_path) {
      setMotionUrl("");
      return;
    }
    const params = new URLSearchParams({ mediaPath: message.motion_video_path });
    setMotionUrl(`/api/media/file?${params.toString()}`);
  }, [message.type, message.motion_video_path]);

  useEffect(() => {
    const video = previewVideoRef.current;
    if (!video) return;
    if (motionPlaying) {
      video.currentTime = 0;
      void video.play();
    } else {
      video.pause();
      video.currentTime = 0.001;
    }
  }, [motionPlaying]);

  function closePreview() {
    setPreviewOpen(false);
    setMotionPlaying(false);
  }

  const isMotion = message.type === "motion";
  const isImage = message.type === "image" || message.type === "gif" || isMotion;
  const cornerClass = isUser ? "rounded-br-md" : "rounded-bl-md";
  const justifyClass = isUser ? "justify-end" : "justify-start";
  const watermarkName = viewerName.trim() || ME_LABEL;
  const watermarkLabel = `@${watermarkName}`;
  // 纯视频实况（没有封面静态图）时，尺寸等 video 元数据加载后再知道
  const motionVideoOnly = isMotion && !message.media_path;
  const imageBoxSize = mediaSize ?? IMAGE_BOX_FALLBACK;

  return (
    <div className="px-3 py-1.5">
      <div className={`flex items-end gap-2 ${justifyClass}`}>
        {!isUser ? <AdminAvatar /> : null}
        <div className={`flex max-w-[76%] flex-col ${isUser ? "items-end" : "items-start"}`}>
          {isUser ? <span className="mb-1 px-1 text-[11px] text-slate-500">{message.nickname || ME_LABEL}</span> : null}

          {message.type === "text" ? (
            <div
              className={`rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm ${cornerClass} ${
                isUser ? "bg-user" : "bg-white"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{message.content_text}</p>
            </div>
          ) : null}

          {isImage ? (
            <>
              {/* 缩略图 */}
              {mediaUrl || (motionVideoOnly && motionUrl) ? (
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  onContextMenu={(event) => event.preventDefault()}
                  className={`relative block overflow-hidden rounded-2xl shadow-sm ${cornerClass}`}
                  style={motionVideoOnly ? undefined : { width: imageBoxSize.width, height: imageBoxSize.height }}
                  aria-label={PREVIEW_ALT}
                >
                  {motionVideoOnly ? (
                    // 纯视频实况：用 video 冻在第一帧作为缩略图
                    <video
                      src={motionUrl}
                      muted
                      playsInline
                      preload="metadata"
                      disablePictureInPicture
                      controlsList="nodownload nofullscreen noremoteplayback"
                      onLoadedMetadata={(event) => {
                        event.currentTarget.currentTime = 0.001;
                        onMediaReady?.();
                      }}
                      onContextMenu={(event) => event.preventDefault()}
                      draggable={false}
                      className="block h-auto max-h-72 w-[260px] select-none object-cover"
                      style={{ WebkitTouchCallout: "none" } as React.CSSProperties}
                    />
                  ) : mediaSize ? (
                    <Image
                      src={mediaUrl}
                      alt={IMAGE_ALT}
                      width={imageBoxSize.width}
                      height={imageBoxSize.height}
                      unoptimized
                      onLoad={onMediaReady}
                      draggable={false}
                      className="block h-full w-full select-none object-cover"
                      style={{ WebkitTouchCallout: "none" } as React.CSSProperties}
                    />
                  ) : (
                    <span className="block h-full w-full animate-pulse bg-slate-200" />
                  )}
                  <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/25 px-1.5 py-0.5 text-[11px] font-medium text-white/75 shadow-sm">
                    {watermarkLabel}
                  </span>
                  {isMotion ? (
                    <span className="pointer-events-none absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[11px] font-medium text-white shadow-sm backdrop-blur">
                      <Play size={11} className="fill-current" />
                      {LIVE_LABEL}
                    </span>
                  ) : null}
                </button>
              ) : (
                <div
                  className={`animate-pulse rounded-2xl bg-slate-200 ${cornerClass}`}
                  style={{ width: imageBoxSize.width, height: imageBoxSize.height }}
                />
              )}

              {/* 预览覆层 */}
              {previewOpen ? (
                <div
                  className="fixed inset-0 z-50 flex flex-col bg-black/95"
                  onClick={closePreview}
                  onContextMenu={(event) => event.preventDefault()}
                  role="dialog"
                  aria-modal="true"
                  aria-label={PREVIEW_ALT}
                >
                  {/* 顶部关闭按钮 */}
                  <div className="flex h-14 shrink-0 items-center justify-end px-3">
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur"
                      onClick={closePreview}
                      aria-label={CLOSE_PREVIEW_LABEL}
                    >
                      <X size={20} />
                    </button>
                  </div>

                  {/* 媒体内容区 */}
                  <div className="flex min-h-0 flex-1 items-center justify-center px-4">
                    <div
                      className="relative"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {isMotion && motionUrl ? (
                        // 单一 video 元素，通过 ref 控制播放/暂停，避免切换时尺寸抖动
                        <video
                          ref={previewVideoRef}
                          src={motionUrl}
                          playsInline
                          preload="metadata"
                          disablePictureInPicture
                          controlsList="nodownload nofullscreen noremoteplayback"
                          onLoadedMetadata={(event) => { event.currentTarget.currentTime = 0.001; }}
                          onEnded={() => setMotionPlaying(false)}
                          onContextMenu={(event) => event.preventDefault()}
                          className="block max-h-[calc(100vh-9rem)] w-auto max-w-full select-none object-contain"
                          style={{ WebkitTouchCallout: "none" } as React.CSSProperties}
                        />
                      ) : mediaUrl ? (
                        <Image
                          src={mediaUrl}
                          alt={PREVIEW_ALT}
                          width={1200}
                          height={900}
                          unoptimized
                          draggable={false}
                          className="block max-h-[calc(100vh-9rem)] w-auto max-w-full select-none object-contain"
                          style={{ WebkitTouchCallout: "none" } as React.CSSProperties}
                        />
                      ) : null}
                      <span className="pointer-events-none absolute bottom-3 right-3 rounded bg-black/30 px-2 py-1 text-sm font-medium text-white/70 shadow-sm">
                        {watermarkLabel}
                      </span>
                    </div>
                  </div>

                  {/* 底部：实况播放控制 */}
                  {isMotion ? (
                    <div
                      className="flex h-16 shrink-0 items-center justify-center"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setMotionPlaying((prev) => !prev)}
                        className="flex items-center gap-2 rounded-full bg-white/15 px-6 py-2.5 text-sm font-medium text-white backdrop-blur transition active:bg-white/25"
                        aria-label={PLAY_MOTION_LABEL}
                      >
                        {motionPlaying ? <Pause size={16} className="fill-current" /> : <Play size={16} className="fill-current" />}
                        {motionPlaying ? "暂停" : "播放实况"}
                      </button>
                    </div>
                  ) : (
                    <div className="h-10 shrink-0" />
                  )}
                </div>
              ) : null}
            </>
          ) : null}

          {message.type === "voice" ? (
            <div className={`rounded-2xl px-3 py-2 shadow-sm ${cornerClass} ${isUser ? "bg-user" : "bg-white"}`}>
              {mediaUrl ? (
                <VoiceBubble url={mediaUrl} duration={message.media_duration} onReady={onMediaReady} />
              ) : (
                <div className="h-12 w-56 animate-pulse rounded-xl bg-slate-200" />
              )}
            </div>
          ) : null}
        </div>
        {isUser ? <UserAvatar /> : null}
      </div>
      <div className={`mt-1 flex ${justifyClass} ${isUser ? "pr-10" : "pl-10"}`}>
        <span className="px-1 text-[11px] text-slate-400">{formatClock(message.created_at)}</span>
      </div>
    </div>
  );
}
