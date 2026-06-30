"use client";

/* eslint-disable @next/next/no-img-element */

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
const IMAGE_BOX_SIZE = { width: 240, height: 180 };

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
  const [motionUrl, setMotionUrl] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [motionPlaying, setMotionPlaying] = useState(false);
  const [motionPreviewReady, setMotionPreviewReady] = useState(false);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const isUser = message.sender_kind === "user";

  useEffect(() => {
    let cancelled = false;

    async function loadMedia() {
      if (!message.media_path) {
        setMediaUrl("");
        return;
      }

      const isStillImage = message.type === "image" || message.type === "gif" || message.type === "motion";
      const mediaWidth = isStillImage ? String(IMAGE_BOX_SIZE.width * 2) : "";
      const params = new URLSearchParams({ mediaPath: message.media_path });
      if (mediaWidth) params.set("width", mediaWidth);
      if (!cancelled) {
        setMediaUrl(`/api/media/file?${params.toString()}`);
      }
    }

    loadMedia();
    return () => {
      cancelled = true;
    };
  }, [message.media_path, message.type, onMediaReady]);

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
    if (!motionPreviewReady) return;
    if (motionPlaying) {
      video.currentTime = 0;
      void video.play();
    } else {
      video.pause();
      video.currentTime = 0.001;
    }
  }, [motionPlaying, motionPreviewReady]);

  useEffect(() => {
    if (previewOpen) {
      setMotionPreviewReady(false);
      setMotionPlaying(false);
    }
  }, [previewOpen, motionUrl]);

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
  const hasChatPreview = Boolean(mediaUrl) || motionVideoOnly;

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
              {hasChatPreview ? (
                <button
                  type="button"
                  onClick={() => setPreviewOpen(true)}
                  onContextMenu={(event) => event.preventDefault()}
                  className={`relative block overflow-hidden rounded-2xl shadow-sm ${cornerClass}`}
                  style={{ width: IMAGE_BOX_SIZE.width, height: IMAGE_BOX_SIZE.height, maxWidth: "240px" }}
                  aria-label={PREVIEW_ALT}
                >
                  {motionVideoOnly ? (
                    // 纯视频实况：用 video 冻在第一帧作为缩略图
                    <span className="flex h-full w-full items-center justify-center bg-slate-200 text-slate-600">
                      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/85 shadow-sm">
                        <Play size={22} className="fill-current" />
                      </span>
                    </span>
                  ) : (
                    <img
                      src={mediaUrl}
                      alt={IMAGE_ALT}
                      width={IMAGE_BOX_SIZE.width}
                      height={IMAGE_BOX_SIZE.height}
                      loading="lazy"
                      decoding="async"
                      onLoad={onMediaReady}
                      draggable={false}
                      className="block h-full w-full select-none object-cover"
                      style={{ WebkitTouchCallout: "none" } as React.CSSProperties}
                    />
                  )}
                  {!motionVideoOnly ? (
                    <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/25 px-1.5 py-0.5 text-[11px] font-medium text-white/75 shadow-sm">
                      {watermarkLabel}
                    </span>
                  ) : null}
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
                  style={{ width: IMAGE_BOX_SIZE.width, height: IMAGE_BOX_SIZE.height, maxWidth: "240px" }}
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
                    <div className="relative flex items-center justify-center" onClick={(event) => event.stopPropagation()}>
                      {isMotion && motionUrl ? (
                        // 单一 video 元素，通过 ref 控制播放/暂停，避免切换时尺寸抖动
                        <div
                          className="relative flex items-center justify-center overflow-hidden rounded-2xl"
                          style={{ width: "min(78vw, 360px)", height: "min(calc(100vh - 10rem), 480px)" }}
                        >
                          {!motionPreviewReady ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/10 text-white/70">
                              <Play size={32} className="fill-current" />
                            </div>
                          ) : null}
                          <video
                            ref={previewVideoRef}
                            src={motionUrl}
                            playsInline
                            preload="auto"
                            disablePictureInPicture
                            controlsList="nodownload nofullscreen noremoteplayback"
                            onLoadedMetadata={(event) => {
                              event.currentTarget.currentTime = 0.001;
                            }}
                            onLoadedData={() => {
                              setMotionPreviewReady(true);
                              onMediaReady?.();
                            }}
                            onCanPlay={() => {
                              setMotionPreviewReady(true);
                              onMediaReady?.();
                            }}
                            onEnded={() => setMotionPlaying(false)}
                            onContextMenu={(event) => event.preventDefault()}
                            className={`block h-full w-full select-none object-contain ${
                              motionPreviewReady ? "visible" : "invisible"
                            }`}
                            style={{ WebkitTouchCallout: "none" } as React.CSSProperties}
                          />
                        </div>
                      ) : isMotion ? (
                        <div
                          className="flex items-center justify-center rounded-2xl bg-white/10 text-white/70"
                          style={{ width: "min(78vw, 360px)", height: "min(calc(100vh - 10rem), 480px)" }}
                        >
                          <Play size={32} className="fill-current" />
                        </div>
                      ) : mediaUrl ? (
                        <img
                          src={mediaUrl}
                          alt={PREVIEW_ALT}
                          width={1200}
                          height={900}
                          loading="eager"
                          decoding="async"
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
