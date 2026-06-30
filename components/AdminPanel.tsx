"use client";

import { ImageIcon, LogOut, Mic, RefreshCw, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatFullTime } from "@/lib/dates";
import type { ChatMessage, MessageType } from "@/lib/types";

const TEXT = {
  checking: "\u68c0\u67e5\u7ba1\u7406\u5458\u72b6\u6001...",
  loginTitle: "\u7ba1\u7406\u5458\u767b\u5f55",
  login: "\u767b\u5f55",
  wrongPassword: "\u5bc6\u7801\u4e0d\u6b63\u786e",
  adminTitle: "\u7ba1\u7406\u540e\u53f0",
  adminSubtitle: "\u516c\u5f00\u6d88\u606f\u4e0e\u7528\u6237\u79c1\u4fe1",
  refresh: "\u5237\u65b0",
  logout: "\u9000\u51fa",
  readFailed: "\u8bfb\u53d6\u6d88\u606f\u5931\u8d25",
  publishFailed: "\u53d1\u5e03\u5931\u8d25",
  publishFailedDetail: "\u53d1\u5e03\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5\u73af\u5883\u53d8\u91cf\u3001\u6570\u636e\u5e93\u6216 Storage",
  deleteFailed: "\u5220\u9664\u5931\u8d25",
  chooseFile: "\u9009\u62e9\u5a92\u4f53\u6587\u4ef6",
  published: "\u5df2\u53d1\u5e03",
  text: "\u6587\u672c",
  image: "\u56fe\u7247",
  motion: "\u5b9e\u51b5",
  voice: "\u8bed\u97f3",
  textPlaceholder: "\u8f93\u5165\u516c\u5f00\u6587\u672c\u6d88\u606f",
  optionalCaption: "\u53ef\u9009\u8bf4\u660e\u6587\u5b57",
  publish: "\u53d1\u5e03",
  durationReady: "\u5df2\u81ea\u52a8\u8bc6\u522b\u65f6\u957f",
  durationPending: "\u9009\u62e9\u8bed\u97f3\u540e\u81ea\u52a8\u8bc6\u522b\u65f6\u957f",
  durationFailed: "\u672a\u80fd\u8bc6\u522b\u65f6\u957f\uff0c\u4ecd\u53ef\u53d1\u5e03",
  adminPublic: "\u7ba1\u7406\u5458\u516c\u5f00\u6d88\u606f",
  anonymous: "\u533f\u540d\u7528\u6237",
  mediaMessage: "\u5a92\u4f53\u6d88\u606f",
  deleteMessage: "\u5220\u9664\u6d88\u606f",
  motionStill: "\u5c01\u9762\u56fe\uff08\u9009 .jpg\uff09",
  motionVideo: "\u52a8\u6001\u89c6\u9891\uff08\u9009\u540c\u540d .mp4\uff0c\u4e0d\u662f .jpg\uff09",
  motionStillChosen: "\u5c01\u9762\uff1a",
  motionVideoChosen: "\u89c6\u9891\uff1a",
  motionNeedBoth: "\u8bf7\u540c\u65f6\u9009\u62e9\u5c01\u9762\u56fe\u548c\u52a8\u6001\u89c6\u9891",
};

function formatDurationLabel(seconds: string) {
  const value = Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return "";
  const minutes = Math.floor(value / 60);
  const remaining = Math.round(value % 60);
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

export function AdminPanel() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [motionVideoFile, setMotionVideoFile] = useState<File | null>(null);
  const [type, setType] = useState<MessageType>("text");
  const [duration, setDuration] = useState("");
  const [durationStatus, setDurationStatus] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const loadMessages = useCallback(async () => {
    const response = await fetch("/api/admin/messages", { cache: "no-store" });
    if (response.status === 401) {
      setAuthenticated(false);
      return;
    }
    if (!response.ok) {
      setStatus(TEXT.readFailed);
      return;
    }
    const data = (await response.json()) as { messages: ChatMessage[] };
    setMessages(data.messages);
    setAuthenticated(true);
  }, []);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  function resetMediaState(nextType?: MessageType) {
    setFile(null);
    setMotionVideoFile(null);
    setDuration("");
    setDurationStatus(nextType === "voice" ? TEXT.durationPending : "");
  }

  function handleType(nextType: MessageType) {
    setType(nextType);
    resetMediaState(nextType);
  }

  function readMediaDuration(nextFile: File) {
    if (type !== "voice") return;

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
        setDurationStatus(`${TEXT.durationReady} ${formatDurationLabel(String(nextDuration))}`);
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
    setDuration("");
    setDurationStatus(type === "voice" ? TEXT.durationPending : "");
    if (nextFile) readMediaDuration(nextFile);
  }

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setStatus(TEXT.wrongPassword);
        return;
      }
      setPassword("");
      setAuthenticated(true);
      await loadMessages();
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setMessages([]);
  }

  async function publish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      let response: Response;
      if (type === "text") {
        response = await fetch("/api/admin/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "text", contentText: text }),
        });
      } else if (type === "motion") {
        if (!file || !motionVideoFile) {
          setStatus(TEXT.motionNeedBoth);
          return;
        }
        const formData = new FormData();
        formData.append("file", file);
        formData.append("motionVideo", motionVideoFile);
        formData.append("type", "motion");
        formData.append("contentText", text);
        response = await fetch("/api/admin/upload", {
          method: "POST",
          body: formData,
        });
      } else {
        if (!file) {
          setStatus(TEXT.chooseFile);
          return;
        }
        const formData = new FormData();
        formData.append("file", file);
        formData.append("type", type);
        formData.append("contentText", text);
        if (duration) formData.append("mediaDuration", duration);
        response = await fetch("/api/admin/upload", {
          method: "POST",
          body: formData,
        });
      }

      if (!response.ok) {
        const detail = await response
          .clone()
          .json()
          .then((data) => (data as { error?: string }).error)
          .catch(() => "");
        setStatus(`${TEXT.publishFailed} (${response.status})${detail ? `: ${detail}` : ""}`);
        return;
      }

      setText("");
      resetMediaState(type);
      setStatus(TEXT.published);
      await loadMessages();
    } catch (error) {
      setStatus(`${TEXT.publishFailedDetail}${error instanceof Error ? `: ${error.message}` : ""}`);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error(TEXT.deleteFailed);
      await loadMessages();
    } catch {
      setStatus(TEXT.deleteFailed);
    } finally {
      setBusy(false);
    }
  }

  if (authenticated === null) {
    return <div className="p-6 text-center text-sm text-slate-500">{TEXT.checking}</div>;
  }

  if (!authenticated) {
    return (
      <div className="flex flex-1 items-center justify-center p-5">
        <form onSubmit={login} className="w-full rounded-2xl bg-white p-5 shadow-lg">
          <h1 className="text-lg font-semibold">{TEXT.loginTitle}</h1>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-4 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-slate-500"
            placeholder="ADMIN_PASSWORD"
          />
          {status ? <p className="mt-2 text-sm text-rose-600">{status}</p> : null}
          <button
            type="submit"
            disabled={busy || !password}
            className="mt-4 h-11 w-full rounded-full bg-ink text-sm font-semibold text-white disabled:bg-slate-300"
          >
            {TEXT.login}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-black/5 bg-white/85 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-base font-semibold">{TEXT.adminTitle}</h1>
            <p className="text-xs text-slate-500">{TEXT.adminSubtitle}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadMessages}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100"
              aria-label={TEXT.refresh}
            >
              <RefreshCw size={16} />
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100"
              aria-label={TEXT.logout}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <form onSubmit={publish} className="shrink-0 space-y-3 border-b border-black/5 bg-white/75 p-3">
        <div className="grid grid-cols-5 gap-1.5">
          {(["text", "image", "motion", "gif", "voice"] as MessageType[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => handleType(item)}
              className={`h-9 rounded-full text-xs font-medium ${
                type === item ? "bg-ink text-white" : "bg-slate-100 text-slate-700"
              }`}
            >
              {item === "text"
                ? TEXT.text
                : item === "image"
                  ? TEXT.image
                  : item === "motion"
                    ? TEXT.motion
                    : item === "gif"
                      ? "GIF"
                      : TEXT.voice}
            </button>
          ))}
        </div>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={2}
          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500"
          placeholder={type === "text" ? TEXT.textPlaceholder : TEXT.optionalCaption}
        />
        {type !== "text" ? (
          <div className="space-y-2">
            {type === "motion" ? (
              <>
                <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-600">
                  <ImageIcon size={16} />
                  {file ? `${TEXT.motionStillChosen}${file.name}` : TEXT.motionStill}
                  <input
                    type="file"
                    className="hidden"
                    accept="*/*"
                    onChange={(event) => setFile(event.target.files?.[0] || null)}
                  />
                </label>
                <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-600">
                  <ImageIcon size={16} />
                  {motionVideoFile ? `${TEXT.motionVideoChosen}${motionVideoFile.name}` : TEXT.motionVideo}
                  <input
                    type="file"
                    className="hidden"
                    accept="*/*"
                    onChange={(event) => setMotionVideoFile(event.target.files?.[0] || null)}
                  />
                </label>
              </>
            ) : (
              <label className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-600">
                {type === "voice" ? <Mic size={16} /> : <ImageIcon size={16} />}
                {file ? file.name : TEXT.chooseFile}
                <input
                  type="file"
                  className="hidden"
                  accept={
                    type === "voice"
                      ? "audio/*,video/mp4,video/quicktime"
                      : type === "gif"
                        ? "image/gif"
                        : "image/*"
                  }
                  onChange={(event) => handleFile(event.target.files?.[0] || null)}
                />
              </label>
            )}
            {type === "voice" ? <p className="px-1 text-xs text-slate-500">{durationStatus}</p> : null}
          </div>
        ) : null}
        {status ? <p className="text-sm text-slate-600">{status}</p> : null}
        <button
          type="submit"
          disabled={busy || (type === "text" ? !text.trim() : type === "motion" ? !file || !motionVideoFile : !file)}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-white disabled:bg-slate-300"
        >
          <Send size={16} />
          {TEXT.publish}
        </button>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {messages.map((message) => (
          <article key={message.id} className="mb-3 rounded-xl bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">
                  {message.sender_kind === "admin" ? TEXT.adminPublic : message.nickname || TEXT.anonymous}
                </p>
                <p className="mt-0.5 break-all text-xs text-slate-500">
                  {message.visitor_id ? `visitor_id: ${message.visitor_id}` : "public"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(message.id)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600"
                aria-label={TEXT.deleteMessage}
              >
                <Trash2 size={15} />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-800">
              {message.type === "text" ? message.content_text : `${message.type} - ${message.content_text || TEXT.mediaMessage}`}
            </p>
            <p className="mt-2 text-xs text-slate-400">{formatFullTime(message.created_at)}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
