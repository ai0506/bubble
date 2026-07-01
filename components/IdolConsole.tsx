"use client";

/* eslint-disable @next/next/no-img-element */

import { LogOut, Mic2, Pencil, RefreshCw, Trash2, User, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { DateDivider } from "@/components/DateDivider";
import { IdolComposer } from "@/components/IdolComposer";
import { formatDateDivider } from "@/lib/dates";
import type { ChatMessage, Idol } from "@/lib/types";

const TEXT = {
  checking: "检查登录状态...",
  loginTitle: "爱豆登录",
  loginSubtitle: "登录后在这里发布消息、查看粉丝留言",
  handlePlaceholder: "账号（handle）",
  passwordPlaceholder: "密码",
  login: "登录",
  wrongCredentials: "账号或密码不正确",
  loading: "加载中...",
  empty: "还没有消息，发一条试试",
  refresh: "刷新",
  logout: "退出",
  editProfile: "编辑资料",
  deleteTitle: "确认删除这条消息？",
  deleteBody: "删除后会同时移除数据库记录和媒体文件，不可撤回。",
  cancel: "取消",
  confirmDelete: "确认删除",
  deleteMessage: "删除消息",
  profileTitle: "编辑资料",
  displayNameLabel: "显示名",
  avatarLabel: "头像",
  changeAvatar: "更换头像",
  save: "保存",
  saveFailed: "保存失败",
};

export function IdolConsole() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [idol, setIdol] = useState<Idol | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ChatMessage | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDisplayName, setProfileDisplayName] = useState("");
  const [profileAvatarFile, setProfileAvatarFile] = useState<File | null>(null);
  const [profileAvatarPreview, setProfileAvatarPreview] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  const loadMessages = useCallback(async () => {
    const response = await fetch("/api/idol/messages", { cache: "no-store" });
    if (response.status === 401) {
      setAuthed(false);
      return;
    }
    if (!response.ok) return;
    const data = (await response.json()) as { messages: ChatMessage[] };
    setMessages(data.messages);
  }, []);

  const bootstrap = useCallback(async () => {
    const response = await fetch("/api/idol/me", { cache: "no-store" });
    if (!response.ok) {
      setAuthed(false);
      setLoading(false);
      return;
    }
    const data = (await response.json()) as { idol: Idol };
    setIdol(data.idol);
    setAuthed(true);
    await loadMessages();
    setLoading(false);
  }, [loadMessages]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    scrollToBottom("smooth");
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!authed) return;
    const timer = window.setInterval(() => void loadMessages(), 15_000);
    return () => window.clearInterval(timer);
  }, [authed, loadMessages]);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setLoginError("");
    try {
      const response = await fetch("/api/idol/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, password }),
      });
      if (!response.ok) {
        setLoginError(TEXT.wrongCredentials);
        return;
      }
      const data = (await response.json()) as { idol: Idol };
      setIdol(data.idol);
      setAuthed(true);
      setPassword("");
      setLoading(true);
      await loadMessages();
      setLoading(false);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/idol/logout", { method: "POST" });
    setAuthed(false);
    setIdol(null);
    setMessages([]);
  }

  async function sendText(text: string) {
    const response = await fetch("/api/idol/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentText: text }),
    });
    if (!response.ok) throw new Error("send failed");
    await loadMessages();
  }

  async function upload(formData: FormData) {
    const response = await fetch("/api/idol/upload", { method: "POST", body: formData });
    if (!response.ok) {
      const detail = await response
        .clone()
        .json()
        .then((data) => (data as { error?: string }).error)
        .catch(() => "");
      throw new Error(detail || "upload failed");
    }
    await loadMessages();
  }

  function openEditProfile() {
    setProfileDisplayName(idol?.display_name || "");
    setProfileAvatarFile(null);
    setProfileAvatarPreview("");
    setProfileError("");
    setEditingProfile(true);
  }

  function pickAvatar(file: File | null) {
    setProfileAvatarFile(file);
    setProfileAvatarPreview(file ? URL.createObjectURL(file) : "");
  }

  async function saveProfile() {
    const displayName = profileDisplayName.trim();
    if (!displayName && !profileAvatarFile) {
      setEditingProfile(false);
      return;
    }
    setProfileBusy(true);
    setProfileError("");
    try {
      const formData = new FormData();
      if (displayName && displayName !== idol?.display_name) formData.append("displayName", displayName);
      if (profileAvatarFile) formData.append("avatar", profileAvatarFile);
      if ([...formData.keys()].length === 0) {
        setEditingProfile(false);
        return;
      }
      const response = await fetch("/api/idol/profile", { method: "PATCH", body: formData });
      if (!response.ok) {
        const detail = await response
          .clone()
          .json()
          .then((d) => (d as { error?: string }).error)
          .catch(() => "");
        setProfileError(detail || TEXT.saveFailed);
        return;
      }
      const data = (await response.json()) as { idol: Idol };
      setIdol(data.idol);
      if (profileAvatarFile) setAvatarVersion((v) => v + 1);
      setEditingProfile(false);
    } finally {
      setProfileBusy(false);
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    setBusy(true);
    try {
      const response = await fetch("/api/idol/messages", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pendingDelete.id }),
      });
      if (response.ok) {
        setPendingDelete(null);
        await loadMessages();
      }
    } finally {
      setBusy(false);
    }
  }

  if (authed === null) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-slate-500">{TEXT.checking}</div>
    );
  }

  if (!authed) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <form onSubmit={login} className="w-full max-w-xs rounded-2xl bg-white p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white">
              <Mic2 size={18} />
            </span>
            <div>
              <h1 className="text-lg font-semibold">{TEXT.loginTitle}</h1>
              <p className="text-xs text-slate-500">{TEXT.loginSubtitle}</p>
            </div>
          </div>
          <input
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            className="mt-4 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-slate-500"
            placeholder={TEXT.handlePlaceholder}
            autoCapitalize="none"
            autoCorrect="off"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-slate-500"
            placeholder={TEXT.passwordPlaceholder}
          />
          {loginError ? <p className="mt-2 text-sm text-rose-600">{loginError}</p> : null}
          <button
            type="submit"
            disabled={busy || !handle.trim() || !password}
            className="mt-4 h-11 w-full rounded-full bg-ink text-sm font-semibold text-white disabled:bg-slate-300"
          >
            {TEXT.login}
          </button>
        </form>
      </div>
    );
  }

  const viewerName = idol?.display_name || "";
  let lastDivider = "";

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-black/5 bg-white/85 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <button type="button" onClick={openEditProfile} className="flex min-w-0 items-center gap-2 text-left">
            {idol?.avatar_path ? (
              <img
                src={`/api/media/avatar?idolId=${idol.id}&v=${avatarVersion}`}
                alt={idol.display_name}
                width={36}
                height={36}
                className="h-9 w-9 shrink-0 rounded-full bg-slate-200 object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-white">
                <User size={17} />
              </span>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold">{idol?.display_name}</h1>
              <p className="text-xs text-slate-500">@{idol?.handle}</p>
            </div>
          </button>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={openEditProfile}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700"
              aria-label={TEXT.editProfile}
              title={TEXT.editProfile}
            >
              <Pencil size={16} />
            </button>
            <button
              type="button"
              onClick={() => void loadMessages()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700"
              aria-label={TEXT.refresh}
            >
              <RefreshCw size={17} />
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700"
              aria-label={TEXT.logout}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 py-3 scrollbar-thin">
        {loading ? <p className="p-6 text-center text-sm text-slate-500">{TEXT.loading}</p> : null}
        {!loading && messages.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">{TEXT.empty}</p>
        ) : null}
        {messages.map((message) => {
          const divider = formatDateDivider(message.created_at);
          const showDivider = divider !== lastDivider;
          lastDivider = divider;
          return (
            <div key={message.id}>
              {showDivider ? <DateDivider label={divider} /> : null}
              <div className="group relative">
                <ChatBubble
                  message={message}
                  viewerName={viewerName}
                  selfKind="admin"
                  onMediaReady={() => scrollToBottom("auto")}
                />
                <button
                  type="button"
                  onClick={() => setPendingDelete(message)}
                  className="absolute right-2 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/80 text-slate-400 opacity-0 shadow-sm transition group-hover:opacity-100 focus:opacity-100"
                  aria-label={TEXT.deleteMessage}
                  title={TEXT.deleteMessage}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <IdolComposer disabled={loading} onSendText={sendText} onUpload={upload} />

      {pendingDelete ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold">{TEXT.deleteTitle}</h2>
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                aria-label={TEXT.cancel}
              >
                <X size={16} />
              </button>
            </div>
            <p className="mt-1 text-sm leading-6 text-slate-500">{TEXT.deleteBody}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="h-11 rounded-full bg-slate-100 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                {TEXT.cancel}
              </button>
              <button
                type="button"
                onClick={() => void confirmDelete()}
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

      {editingProfile ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 px-5">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold">{TEXT.profileTitle}</h2>
              <button
                type="button"
                onClick={() => setEditingProfile(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                aria-label={TEXT.cancel}
              >
                <X size={16} />
              </button>
            </div>

            <div className="mt-4 flex flex-col items-center gap-2">
              <label className="relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-slate-200">
                {profileAvatarPreview || idol?.avatar_path ? (
                  <img
                    src={profileAvatarPreview || `/api/media/avatar?idolId=${idol?.id}&v=${avatarVersion}`}
                    alt={TEXT.avatarLabel}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User size={28} className="text-slate-500" />
                )}
                <span className="absolute inset-x-0 bottom-0 bg-black/45 py-1 text-center text-[10px] text-white">
                  {TEXT.changeAvatar}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(event) => pickAvatar(event.target.files?.[0] || null)}
                />
              </label>
            </div>

            <label className="mt-4 block text-xs font-medium text-slate-500">{TEXT.displayNameLabel}</label>
            <input
              value={profileDisplayName}
              onChange={(event) => setProfileDisplayName(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-slate-500"
            />

            {profileError ? <p className="mt-2 text-sm text-rose-600">{profileError}</p> : null}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEditingProfile(false)}
                className="h-11 rounded-full bg-slate-100 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                {TEXT.cancel}
              </button>
              <button
                type="button"
                onClick={() => void saveProfile()}
                disabled={profileBusy || !profileDisplayName.trim()}
                className="h-11 rounded-full bg-ink text-sm font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-300"
              >
                {TEXT.save}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
