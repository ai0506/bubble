"use client";

import { ImageIcon, Mic, Paperclip, Send, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import type { MessageType } from "@/lib/types";

const READY_PLACEHOLDER = "发送公开消息...";
const CAPTION_PLACEHOLDER = "可选说明文字";
const SEND_LABEL = "发送";
const CANCEL_LABEL = "取消";
const TEXT = {
  image: "图片",
  gif: "GIF",
  voice: "语音",
  motion: "实况",
  chooseFile: "选择文件",
  motionStill: "封面图（.jpg）",
  motionVideo: "动态视频（.mp4）",
  motionStillChosen: "封面：",
  motionVideoChosen: "视频：",
  motionNeedBoth: "请同时选择封面图和动态视频",
  chooseFileFirst: "请先选择媒体文件",
  durationPending: "识别时长中...",
  durationReady: "时长",
  durationFailed: "未能识别时长，仍可发布",
};

// 可作为附件的媒体类型（文字走 send 按钮）
const MEDIA_TYPES: Exclude<MessageType, "text" | "video">[] = ["image", "gif", "voice", "motion"];

type IdolComposerProps = {
  disabled: boolean;
  onSendText: (text: string) => Promise<void>;
  onUpload: (formData: FormData) => Promise<void>;
};

function formatDurationLabel(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export function IdolComposer({ disabled, onSendText, onUpload }: IdolComposerProps) {
  const [text, setText] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [pendingType, setPendingType] = useState<Exclude<MessageType, "text" | "video"> | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [motionVideoFile, setMotionVideoFile] = useState<File | null>(null);
  const [duration, setDuration] = useState("");
  const [durationStatus, setDurationStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const blocked = disabled || busy;

  function resetMedia() {
    setPendingType(null);
    setFile(null);
    setMotionVideoFile(null);
    setDuration("");
    setDurationStatus("");
  }

  function chooseType(nextType: Exclude<MessageType, "text" | "video">) {
    setError("");
    setAttachOpen(false);
    setPendingType(nextType);
    setFile(null);
    setMotionVideoFile(null);
    setDuration("");
    setDurationStatus(nextType === "voice" ? TEXT.durationPending : "");
  }

  function readMediaDuration(nextFile: File) {
    setDuration("");
    setDurationStatus(TEXT.durationPending);
    const objectUrl = URL.createObjectURL(nextFile);
    const media = document.createElement(nextFile.type.startsWith("video/") ? "video" : "audio");
    media.preload = "metadata";
    media.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      const nextDuration = Math.round(media.duration);
      if (Number.isFinite(nextDuration) && nextDuration > 0) {
        setDuration(String(nextDuration));
        setDurationStatus(`${TEXT.durationReady} ${formatDurationLabel(nextDuration)}`);
      } else {
        setDurationStatus(TEXT.durationFailed);
      }
    };
    media.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setDurationStatus(TEXT.durationFailed);
    };
    media.src = objectUrl;
  }

  function handleFile(nextFile: File | null) {
    setFile(nextFile);
    if (nextFile && pendingType === "voice") readMediaDuration(nextFile);
  }

  async function sendText() {
    const value = text.trim();
    if (!value || blocked) return;
    setError("");
    setBusy(true);
    try {
      await onSendText(value);
      setText("");
    } catch (error) {
      setError(error instanceof Error && error.message ? error.message : "发送失败");
    } finally {
      setBusy(false);
    }
  }

  async function sendMedia() {
    if (!pendingType || blocked) return;
    if (pendingType === "motion") {
      if (!file || !motionVideoFile) {
        setError(TEXT.motionNeedBoth);
        return;
      }
    } else if (!file) {
      setError(TEXT.chooseFileFirst);
      return;
    }

    setError("");
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("type", pendingType);
      formData.append("contentText", text);
      if (pendingType === "motion") {
        formData.append("file", file as File);
        formData.append("motionVideo", motionVideoFile as File);
      } else {
        formData.append("file", file as File);
        if (pendingType === "voice" && duration) formData.append("mediaDuration", duration);
      }
      await onUpload(formData);
      setText("");
      resetMedia();
    } catch (error) {
      setError(error instanceof Error && error.message ? error.message : "发送失败");
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.ctrlKey || event.metaKey || event.shiftKey) return;
    event.preventDefault();
    if (pendingType) void sendMedia();
    else void sendText();
  }

  return (
    <div className="shrink-0 border-t border-black/5 bg-white/80 p-3">
      {/* 附件类型菜单 */}
      {attachOpen ? (
        <div className="mb-2 grid grid-cols-4 gap-1.5">
          {MEDIA_TYPES.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => chooseType(item)}
              className="flex h-9 items-center justify-center gap-1 rounded-full bg-slate-100 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
            >
              {item === "voice" ? <Mic size={14} /> : item === "motion" ? <Sparkles size={14} /> : <ImageIcon size={14} />}
              {TEXT[item]}
            </button>
          ))}
        </div>
      ) : null}

      {/* 待发送媒体面板 */}
      {pendingType ? (
        <div className="mb-2 space-y-2 rounded-2xl bg-slate-50 p-2.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-slate-600">{TEXT[pendingType]}</span>
            <button type="button" onClick={resetMedia} className="text-slate-400 hover:text-slate-600" aria-label={CANCEL_LABEL}>
              <X size={16} />
            </button>
          </div>
          {pendingType === "motion" ? (
            <>
              <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-600 hover:border-slate-400">
                <ImageIcon size={14} />
                <span className="truncate">{file ? `${TEXT.motionStillChosen}${file.name}` : TEXT.motionStill}</span>
                <input type="file" className="hidden" accept="*/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
              <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-600 hover:border-slate-400">
                <Sparkles size={14} />
                <span className="truncate">
                  {motionVideoFile ? `${TEXT.motionVideoChosen}${motionVideoFile.name}` : TEXT.motionVideo}
                </span>
                <input type="file" className="hidden" accept="*/*" onChange={(e) => setMotionVideoFile(e.target.files?.[0] || null)} />
              </label>
            </>
          ) : (
            <label className="flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-xs text-slate-600 hover:border-slate-400">
              {pendingType === "voice" ? <Mic size={14} /> : <ImageIcon size={14} />}
              <span className="truncate">{file ? file.name : TEXT.chooseFile}</span>
              <input
                type="file"
                className="hidden"
                accept={pendingType === "voice" ? "audio/*,video/mp4,video/quicktime" : pendingType === "gif" ? "image/gif" : "image/*"}
                onChange={(e) => handleFile(e.target.files?.[0] || null)}
              />
            </label>
          )}
          {pendingType === "voice" && durationStatus ? <p className="px-1 text-[11px] text-slate-500">{durationStatus}</p> : null}
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => {
            if (pendingType) resetMedia();
            setAttachOpen((prev) => !prev);
          }}
          disabled={blocked}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition disabled:opacity-40 ${
            attachOpen ? "bg-ink text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
          aria-label={CANCEL_LABEL}
        >
          <Paperclip size={18} />
        </button>
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError("");
          }}
          onKeyDown={handleKeyDown}
          disabled={blocked}
          rows={1}
          className="max-h-24 min-h-10 flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:bg-slate-100"
          placeholder={pendingType ? CAPTION_PLACEHOLDER : READY_PLACEHOLDER}
        />
        <button
          type="button"
          onClick={() => (pendingType ? sendMedia() : sendText())}
          disabled={blocked || (pendingType ? (pendingType === "motion" ? !file || !motionVideoFile : !file) : !text.trim())}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-white transition hover:bg-slate-700 disabled:bg-slate-300"
          aria-label={SEND_LABEL}
        >
          <Send size={18} />
        </button>
      </div>
      {error ? <p className="mt-2 px-2 text-xs text-rose-600">{error}</p> : null}
    </div>
  );
}
