"use client";

/* eslint-disable @next/next/no-img-element */

import {
  AlertTriangle,
  ImageIcon,
  Inbox,
  LayoutDashboard,
  LogOut,
  Megaphone,
  MessageSquareText,
  Mic,
  RefreshCw,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatFullTime } from "@/lib/dates";
import { compressImageForUpload } from "@/lib/clientImageCompression";
import type { ChatMessage, MessageType } from "@/lib/types";

const TEXT = {
  checking: "\u68c0\u67e5\u7ba1\u7406\u5458\u72b6\u6001...",
  loginTitle: "\u7ba1\u7406\u5458\u767b\u5f55",
  login: "\u767b\u5f55",
  wrongPassword: "\u5bc6\u7801\u4e0d\u6b63\u786e",
  adminTitle: "\u7ba1\u7406\u540e\u53f0",
  adminSubtitle: "\u516c\u5f00\u6d88\u606f\u4e0e\u7528\u6237\u79c1\u4fe1",
  publishTitle: "\u53d1\u5e03\u516c\u5f00\u6d88\u606f",
  publishHint: "\u6587\u672c\u4f1a\u76f4\u63a5\u51fa\u73b0\u5728\u8bbf\u5ba2\u804a\u5929\u9875\uff0c\u5a92\u4f53\u4f1a\u5148\u4e0a\u4f20\u5230\u79c1\u6709 Storage\u3002",
  messageTitle: "\u6d88\u606f\u5217\u8868",
  messageCount: "\u6761\u6d88\u606f",
  emptyMessages: "\u6682\u65e0\u6d88\u606f",
  receivedMessages: "\u7528\u6237\u53d1\u6765\u7684\u6d88\u606f",
  sentMessages: "\u7ba1\u7406\u5458\u53d1\u51fa\u7684\u6d88\u606f",
  emptyReceived: "\u6682\u65e0\u7528\u6237\u79c1\u4fe1",
  emptySent: "\u6682\u65e0\u7ba1\u7406\u5458\u6d88\u606f",
  deleteConfirmTitle: "\u786e\u8ba4\u5220\u9664\u8fd9\u6761\u6d88\u606f\uff1f",
  deleteConfirmBody: "\u5220\u9664\u540e\u4f1a\u540c\u65f6\u79fb\u9664\u6570\u636e\u5e93\u8bb0\u5f55\u548c\u5bf9\u5e94\u5a92\u4f53\u6587\u4ef6\uff0c\u8fd9\u4e2a\u64cd\u4f5c\u4e0d\u80fd\u64a4\u56de\u3002",
  cancel: "\u53d6\u6d88",
  confirmDelete: "\u786e\u8ba4\u5220\u9664",
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
  const [pendingDelete, setPendingDelete] = useState<ChatMessage | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState("");

  const receivedMessages = messages.filter((message) => message.sender_kind !== "admin");
  const sentMessages = messages.filter((message) => message.sender_kind === "admin");

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

  useEffect(() => {
    if (!file || !["image", "gif", "motion"].includes(type)) {
      setFilePreviewUrl("");
      return;
    }

    const url = URL.createObjectURL(file);
    setFilePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file, type]);

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

  async function getUploadFile(nextFile: File, nextType: MessageType) {
    if (nextType === "image" || nextType === "motion") {
      return compressImageForUpload(nextFile);
    }
    return nextFile;
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
        const uploadFile = await getUploadFile(file, type);
        const formData = new FormData();
        formData.append("file", uploadFile);
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
        const uploadFile = await getUploadFile(file, type);
        const formData = new FormData();
        formData.append("file", uploadFile);
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
      setPendingDelete(null);
      await loadMessages();
    } catch {
      setStatus(TEXT.deleteFailed);
    } finally {
      setBusy(false);
    }
  }

  function renderMessageCard(message: ChatMessage) {
    return (
      <article key={message.id} className="rounded-xl bg-white p-3 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {message.sender_kind === "admin" ? TEXT.adminPublic : message.nickname || TEXT.anonymous}
            </p>
            <p className="mt-0.5 break-all text-xs text-slate-500">
              {message.visitor_id ? `visitor_id: ${message.visitor_id}` : "public"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPendingDelete(message)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 transition hover:bg-rose-100"
            aria-label={TEXT.deleteMessage}
            title={TEXT.deleteMessage}
          >
            <Trash2 size={15} />
          </button>
        </div>
        <p className="mt-2 line-clamp-4 text-sm leading-6 text-slate-800">
          {message.type === "text" ? message.content_text : `${message.type} - ${message.content_text || TEXT.mediaMessage}`}
        </p>
        <p className="mt-2 text-xs text-slate-400">{formatFullTime(message.created_at)}</p>
      </article>
    );
  }

  function renderMessageGroup(title: string, count: number, emptyText: string, groupMessages: ChatMessage[], icon: React.ReactNode) {
    return (
      <div className="min-h-0 rounded-xl bg-white/55 p-2">
        <div className="mb-2 flex items-center justify-between gap-3 px-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-700 shadow-sm">
              {icon}
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold">{title}</h3>
              <p className="text-xs text-slate-500">
                {count} {TEXT.messageCount}
              </p>
            </div>
          </div>
        </div>
        {groupMessages.length === 0 ? (
          <div className="rounded-xl bg-white/80 px-4 py-8 text-center text-sm text-slate-500">{emptyText}</div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">{groupMessages.map(renderMessageCard)}</div>
        )}
      </div>
    );
  }

  if (authenticated === null) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 text-ink">
        <div className="rounded-2xl bg-white/85 px-5 py-4 text-center text-sm text-slate-500 shadow-lg">
          {TEXT.checking}
        </div>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center px-5 py-10 text-ink">
        <form onSubmit={login} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white">
              <LayoutDashboard size={18} />
            </span>
            <div>
              <h1 className="text-lg font-semibold">{TEXT.loginTitle}</h1>
              <p className="text-xs text-slate-500">{TEXT.adminSubtitle}</p>
            </div>
          </div>
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
      </main>
    );
  }

  return (
    <main className="min-h-screen text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <header className="shrink-0 rounded-2xl border border-white/70 bg-white/85 px-4 py-4 shadow-sm backdrop-blur sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white">
                <LayoutDashboard size={20} />
              </span>
              <div>
                <h1 className="text-xl font-semibold sm:text-2xl">{TEXT.adminTitle}</h1>
                <p className="text-sm text-slate-500">{TEXT.adminSubtitle}</p>
              </div>
            </div>
            <div className="flex gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={loadMessages}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                aria-label={TEXT.refresh}
                title={TEXT.refresh}
              >
                <RefreshCw size={17} />
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                aria-label={TEXT.logout}
                title={TEXT.logout}
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 py-4 xl:grid-cols-[minmax(320px,420px)_minmax(0,1fr)] lg:py-5">
          <section className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm backdrop-blur xl:sticky xl:top-6 xl:self-start">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                <Send size={18} />
              </span>
              <div>
                <h2 className="text-base font-semibold">{TEXT.publishTitle}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">{TEXT.publishHint}</p>
              </div>
            </div>

            <form onSubmit={publish} className="space-y-3">
              <div className="grid grid-cols-5 gap-1.5">
                {(["text", "image", "motion", "gif", "voice"] as MessageType[]).map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleType(item)}
                    className={`h-9 rounded-full text-xs font-medium transition ${
                      type === item ? "bg-ink text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
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
                rows={5}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-slate-500"
                placeholder={type === "text" ? TEXT.textPlaceholder : TEXT.optionalCaption}
              />

              {type !== "text" ? (
                <div className="space-y-2">
                  {type === "motion" ? (
                    <>
                      <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-slate-400">
                        <ImageIcon size={16} />
                        <span className="truncate">{file ? `${TEXT.motionStillChosen}${file.name}` : TEXT.motionStill}</span>
                        <input
                          type="file"
                          className="hidden"
                          accept="*/*"
                          onChange={(event) => setFile(event.target.files?.[0] || null)}
                        />
                      </label>
                      <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-slate-400">
                        <ImageIcon size={16} />
                        <span className="truncate">
                          {motionVideoFile ? `${TEXT.motionVideoChosen}${motionVideoFile.name}` : TEXT.motionVideo}
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          accept="*/*"
                          onChange={(event) => setMotionVideoFile(event.target.files?.[0] || null)}
                        />
                      </label>
                    </>
                  ) : (
                    <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-3 py-2 text-sm text-slate-600 transition hover:border-slate-400">
                      {type === "voice" ? <Mic size={16} /> : <ImageIcon size={16} />}
                      <span className="truncate">{file ? file.name : TEXT.chooseFile}</span>
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
                  {filePreviewUrl ? (
                    <div className="overflow-hidden rounded-xl bg-slate-100">
                      <img
                        src={filePreviewUrl}
                        alt={TEXT.chooseFile}
                        width={240}
                        height={160}
                        className="max-h-44 w-full object-cover"
                      />
                    </div>
                  ) : null}
                  {type === "voice" ? <p className="px-1 text-xs text-slate-500">{durationStatus}</p> : null}
                </div>
              ) : null}

              {status ? <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{status}</p> : null}

              <button
                type="submit"
                disabled={busy || (type === "text" ? !text.trim() : type === "motion" ? !file || !motionVideoFile : !file)}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-300"
              >
                <Send size={16} />
                {TEXT.publish}
              </button>
            </form>
          </section>

          <section className="min-h-0 rounded-2xl border border-white/70 bg-white/70 shadow-sm backdrop-blur">
            <div className="flex flex-col gap-3 border-b border-black/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                  <MessageSquareText size={18} />
                </span>
                <div>
                  <h2 className="text-base font-semibold">{TEXT.messageTitle}</h2>
                  <p className="text-xs text-slate-500">
                    {messages.length} {TEXT.messageCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="max-h-none overflow-y-auto p-3 xl:max-h-[calc(100dvh-164px)]">
              {messages.length === 0 ? (
                <div className="rounded-xl bg-white/80 px-4 py-10 text-center text-sm text-slate-500">{TEXT.emptyMessages}</div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {renderMessageGroup(TEXT.receivedMessages, receivedMessages.length, TEXT.emptyReceived, receivedMessages, <Inbox size={16} />)}
                  {renderMessageGroup(TEXT.sentMessages, sentMessages.length, TEXT.emptySent, sentMessages, <Megaphone size={16} />)}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/35 px-3 py-3 sm:items-center sm:justify-center sm:p-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                  <AlertTriangle size={18} />
                </span>
                <div>
                  <h2 className="text-base font-semibold">{TEXT.deleteConfirmTitle}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{TEXT.deleteConfirmBody}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                aria-label={TEXT.cancel}
                title={TEXT.cancel}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-medium">
                {pendingDelete.sender_kind === "admin" ? TEXT.adminPublic : pendingDelete.nickname || TEXT.anonymous}
              </p>
              <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-600">
                {pendingDelete.type === "text"
                  ? pendingDelete.content_text
                  : `${pendingDelete.type} - ${pendingDelete.content_text || TEXT.mediaMessage}`}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="h-11 rounded-full bg-slate-100 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                {TEXT.cancel}
              </button>
              <button
                type="button"
                onClick={() => remove(pendingDelete.id)}
                disabled={busy}
                className="flex h-11 items-center justify-center gap-2 rounded-full bg-rose-600 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:bg-slate-300"
              >
                <Trash2 size={16} />
                {TEXT.confirmDelete}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
