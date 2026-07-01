"use client";

import {
  AlertTriangle,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Power,
  RefreshCw,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { formatFullTime } from "@/lib/dates";
import type { Idol } from "@/lib/types";

const TEXT = {
  checking: "检查管理员状态...",
  loginTitle: "管理员登录",
  loginSubtitle: "创建与管理爱豆账号",
  login: "登录",
  wrongPassword: "密码不正确",
  title: "爱豆管理",
  subtitle: "创建 / 停用 / 改密 / 删除爱豆",
  createTitle: "新建爱豆",
  handleLabel: "handle（登录名 / 链接）",
  handleHint: "2-32 位小写字母、数字、_ 或 -",
  displayNameLabel: "显示名",
  passwordLabel: "初始密码（至少 6 位）",
  create: "创建爱豆",
  listTitle: "爱豆列表",
  count: "个爱豆",
  empty: "还没有爱豆",
  active: "启用中",
  inactive: "已停用",
  enable: "启用",
  disable: "停用",
  resetPassword: "重置密码",
  delete: "删除",
  refresh: "刷新",
  logout: "退出",
  loadFailed: "读取失败",
  createFailed: "创建失败",
  actionFailed: "操作失败",
  resetTitle: "重置密码",
  resetHint: "输入新密码（至少 6 位）",
  newPassword: "新密码",
  confirm: "确认",
  cancel: "取消",
  deleteTitle: "确认删除该爱豆？",
  deleteBody: "会同时删除 TA 的全部消息和媒体文件，粉丝将无法再看到该爱豆，操作不可撤回。",
  confirmDelete: "确认删除",
};

export function AdminPanel() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [idols, setIdols] = useState<Idol[]>([]);
  const [handle, setHandle] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Idol | null>(null);
  const [pendingReset, setPendingReset] = useState<Idol | null>(null);
  const [resetValue, setResetValue] = useState("");

  const loadIdols = useCallback(async () => {
    const response = await fetch("/api/admin/idols", { cache: "no-store" });
    if (response.status === 401) {
      setAuthenticated(false);
      return;
    }
    if (!response.ok) {
      setStatus(TEXT.loadFailed);
      return;
    }
    const data = (await response.json()) as { idols: Idol[] };
    setIdols(data.idols);
    setAuthenticated(true);
  }, []);

  useEffect(() => {
    void loadIdols();
  }, [loadIdols]);

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
      await loadIdols();
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setIdols([]);
  }

  async function createIdol(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/idols", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handle, displayName, password: newPassword }),
      });
      if (!response.ok) {
        const detail = await response
          .clone()
          .json()
          .then((d) => (d as { error?: string }).error)
          .catch(() => "");
        setStatus(`${TEXT.createFailed}${detail ? `：${detail}` : ""}`);
        return;
      }
      setHandle("");
      setDisplayName("");
      setNewPassword("");
      await loadIdols();
    } finally {
      setBusy(false);
    }
  }

  async function patchIdol(id: string, payload: Record<string, unknown>) {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/idols", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...payload }),
      });
      if (!response.ok) {
        setStatus(TEXT.actionFailed);
        return false;
      }
      await loadIdols();
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function removeIdol(id: string) {
    setBusy(true);
    setStatus("");
    try {
      const response = await fetch("/api/admin/idols", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) {
        setStatus(TEXT.actionFailed);
        return;
      }
      setPendingDelete(null);
      await loadIdols();
    } finally {
      setBusy(false);
    }
  }

  async function submitReset() {
    if (!pendingReset || resetValue.length < 6) return;
    const ok = await patchIdol(pendingReset.id, { password: resetValue });
    if (ok) {
      setPendingReset(null);
      setResetValue("");
    }
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
              <p className="text-xs text-slate-500">{TEXT.loginSubtitle}</p>
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
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-4 sm:px-6 lg:py-6">
        <header className="shrink-0 rounded-2xl border border-white/70 bg-white/85 px-4 py-4 shadow-sm backdrop-blur sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white">
                <Users size={20} />
              </span>
              <div>
                <h1 className="text-xl font-semibold sm:text-2xl">{TEXT.title}</h1>
                <p className="text-sm text-slate-500">{TEXT.subtitle}</p>
              </div>
            </div>
            <div className="flex gap-2 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => void loadIdols()}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                aria-label={TEXT.refresh}
                title={TEXT.refresh}
              >
                <RefreshCw size={17} />
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                aria-label={TEXT.logout}
                title={TEXT.logout}
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-4 py-4 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
          <section className="rounded-2xl border border-white/70 bg-white/85 p-4 shadow-sm backdrop-blur lg:sticky lg:top-6 lg:self-start">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                <UserPlus size={18} />
              </span>
              <h2 className="text-base font-semibold">{TEXT.createTitle}</h2>
            </div>
            <form onSubmit={createIdol} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-slate-500">{TEXT.handleLabel}</label>
                <input
                  value={handle}
                  onChange={(event) => setHandle(event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-500"
                  placeholder="e.g. asw"
                  autoCapitalize="none"
                  autoCorrect="off"
                />
                <p className="mt-1 text-[11px] text-slate-400">{TEXT.handleHint}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">{TEXT.displayNameLabel}</label>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-500"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">{TEXT.passwordLabel}</label>
                <input
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-slate-500"
                />
              </div>
              {status ? <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">{status}</p> : null}
              <button
                type="submit"
                disabled={busy || !handle.trim() || !displayName.trim() || newPassword.length < 6}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-300"
              >
                <UserPlus size={16} />
                {TEXT.create}
              </button>
            </form>
          </section>

          <section className="min-h-0 rounded-2xl border border-white/70 bg-white/70 shadow-sm backdrop-blur">
            <div className="flex items-center gap-3 border-b border-black/5 px-4 py-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-700">
                <Users size={18} />
              </span>
              <div>
                <h2 className="text-base font-semibold">{TEXT.listTitle}</h2>
                <p className="text-xs text-slate-500">
                  {idols.length} {TEXT.count}
                </p>
              </div>
            </div>
            <div className="space-y-3 p-3">
              {idols.length === 0 ? (
                <div className="rounded-xl bg-white/80 px-4 py-10 text-center text-sm text-slate-500">{TEXT.empty}</div>
              ) : (
                idols.map((idol) => (
                  <article key={idol.id} className="rounded-xl bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{idol.display_name}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">@{idol.handle}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">{formatFullTime(idol.created_at)}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          idol.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {idol.is_active ? TEXT.active : TEXT.inactive}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void patchIdol(idol.id, { isActive: !idol.is_active })}
                        disabled={busy}
                        className="flex h-9 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
                      >
                        <Power size={13} />
                        {idol.is_active ? TEXT.disable : TEXT.enable}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingReset(idol);
                          setResetValue("");
                        }}
                        disabled={busy}
                        className="flex h-9 items-center gap-1.5 rounded-full bg-slate-100 px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
                      >
                        <KeyRound size={13} />
                        {TEXT.resetPassword}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDelete(idol)}
                        disabled={busy}
                        className="flex h-9 items-center gap-1.5 rounded-full bg-rose-50 px-3 text-xs font-medium text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
                      >
                        <Trash2 size={13} />
                        {TEXT.delete}
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {pendingReset ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-5">
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{TEXT.resetTitle}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  @{pendingReset.handle}｜{TEXT.resetHint}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingReset(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                aria-label={TEXT.cancel}
              >
                <X size={16} />
              </button>
            </div>
            <input
              value={resetValue}
              onChange={(event) => setResetValue(event.target.value)}
              className="mt-4 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-slate-500"
              placeholder={TEXT.newPassword}
            />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPendingReset(null)}
                className="h-11 rounded-full bg-slate-100 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
              >
                {TEXT.cancel}
              </button>
              <button
                type="button"
                onClick={() => void submitReset()}
                disabled={busy || resetValue.length < 6}
                className="h-11 rounded-full bg-ink text-sm font-semibold text-white transition hover:bg-slate-800 disabled:bg-slate-300"
              >
                {TEXT.confirm}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {pendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/35 px-3 py-3 sm:items-center sm:justify-center sm:p-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                  <AlertTriangle size={18} />
                </span>
                <div>
                  <h2 className="text-base font-semibold">{TEXT.deleteTitle}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-500">{TEXT.deleteBody}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"
                aria-label={TEXT.cancel}
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 rounded-xl bg-slate-50 p-3">
              <p className="text-sm font-medium">{pendingDelete.display_name}</p>
              <p className="mt-1 text-sm text-slate-600">@{pendingDelete.handle}</p>
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
                onClick={() => void removeIdol(pendingDelete.id)}
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
