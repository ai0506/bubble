"use client";

import { ArrowLeft, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { ChatComposer } from "@/components/ChatComposer";
import { DateDivider } from "@/components/DateDivider";
import { NicknameModal } from "@/components/NicknameModal";
import { SubscribeOverlay } from "@/components/SubscribeOverlay";
import { formatDateDivider } from "@/lib/dates";
import { getMessagesSignature } from "@/lib/messageSignature";
import type { ChatMessage, Idol } from "@/lib/types";
import {
  activateOneYearSubscription,
  decrementRemainingMessages,
  getNickname,
  getOrCreateVisitorId,
  getRemainingMessages,
  getSubscriptionExpiresAt,
  isSubscriptionActive,
  setNickname as saveNickname,
  syncAllowanceWithLatestAdminMessage,
} from "@/lib/visitor";

const UNSUBSCRIBED_LABEL = "\u672a\u8ba2\u9605";
const REFRESH_LABEL = "\u5237\u65b0\u6d88\u606f";
const BACK_LABEL = "\u8fd4\u56de\u7231\u8c46\u5217\u8868"; // \u8fd4\u56de\u7231\u8c46\u5217\u8868
const LOADING_LABEL = "\u52a0\u8f7d\u4e2d...";
const EMPTY_LABEL = "\u8fd8\u6ca1\u6709\u6d88\u606f";

function getLatestAdminMessageId(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.sender_kind === "admin" && message.visibility === "public") {
      return message.id;
    }
  }
  return null;
}

function formatSubscriptionExpiresLabel(expiresAt: string | null) {
  if (!expiresAt) return UNSUBSCRIBED_LABEL;

  const date = new Date(expiresAt);
  if (!Number.isFinite(date.getTime())) return UNSUBSCRIBED_LABEL;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `\u8ba2\u9605\u6709\u6548\u81f3${year}-${month}-${day}`;
}

type ChatScreenProps = {
  idol: Pick<Idol, "id" | "handle" | "display_name">;
  onBack: () => void;
};

export function ChatScreen({ idol, onBack }: ChatScreenProps) {
  const idolId = idol.id;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [visitorId, setVisitorId] = useState("");
  const [nickname, setNickname] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [subscriptionExpiresAt, setSubscriptionExpiresAt] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [remainingMessages, setRemainingMessages] = useState(3);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const needsNickname = useMemo(() => Boolean(visitorId) && !nickname, [visitorId, nickname]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  // 稳定引用，供 memo 化的 ChatBubble 复用（内联箭头会破坏 memo）
  const handleMediaReady = useCallback(() => scrollToBottom("auto"), [scrollToBottom]);

  const loadMessages = useCallback(
    async (id: string, markRead = false) => {
      const response = await fetch(
        `/api/messages?visitorId=${encodeURIComponent(id)}&idolId=${encodeURIComponent(idolId)}${markRead ? "&markRead=true" : ""}`,
        { cache: "no-store" },
      );
      if (!response.ok) return;
      const data = (await response.json()) as { messages: ChatMessage[] };
      setMessages((currentMessages) =>
        getMessagesSignature(currentMessages) === getMessagesSignature(data.messages) ? currentMessages : data.messages,
      );
      setRemainingMessages(syncAllowanceWithLatestAdminMessage(idolId, getLatestAdminMessageId(data.messages)));
    },
    [idolId],
  );

  useEffect(() => {
    const id = getOrCreateVisitorId();
    setVisitorId(id);
    setNickname(getNickname());
    setSubscriptionExpiresAt(getSubscriptionExpiresAt(idolId));
    setSubscribed(isSubscriptionActive(idolId));
    setRemainingMessages(getRemainingMessages(idolId));
    setInitialized(true);

    setLoading(true);
    loadMessages(id, isSubscriptionActive(idolId) && document.visibilityState === "visible").finally(() =>
      setLoading(false),
    );
  }, [loadMessages, idolId]);

  useEffect(() => {
    scrollToBottom("smooth");
  }, [messages, subscribed, scrollToBottom]);

  useEffect(() => {
    if (!visitorId) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (isSubscriptionActive(idolId)) void loadMessages(visitorId, true);
    }, 15_000);

    // 页面从后台切回前台时立即拉一次，避免等下一个轮询周期
    const onVisible = () => {
      if (document.visibilityState === "visible" && isSubscriptionActive(idolId)) {
        void loadMessages(visitorId, true);
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [idolId, loadMessages, visitorId]);

  async function sendPrivateMessage(text: string) {
    if (!visitorId || !nickname || !subscribed) return;

    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, nickname, contentText: text, idolId }),
    });

    if (!response.ok) {
      throw new Error("Failed to send message.");
    }

    setRemainingMessages(decrementRemainingMessages(idolId));
    await loadMessages(visitorId);
  }

  function handleNickname(value: string) {
    saveNickname(value);
    setNickname(value);
  }

  function handleSubscribe() {
    const expiresAt = activateOneYearSubscription(idolId);
    setSubscriptionExpiresAt(expiresAt);
    setSubscribed(true);
    if (visitorId && document.visibilityState === "visible") void loadMessages(visitorId, true);
  }

  let lastDivider = "";

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-black/5 bg-white/85 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700"
              aria-label={BACK_LABEL}
            >
              <ArrowLeft size={17} />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold">{idol.display_name}</h1>
              <p className="text-xs text-slate-500">
                {!initialized ? " " : subscribed ? formatSubscriptionExpiresLabel(subscriptionExpiresAt) : UNSUBSCRIBED_LABEL}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => visitorId && loadMessages(visitorId, subscribed && document.visibilityState === "visible")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700"
            aria-label={REFRESH_LABEL}
          >
            <RefreshCw size={17} />
          </button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <div className={`h-full overflow-y-auto px-1 py-3 scrollbar-thin ${initialized && !subscribed ? "blur-sm" : ""}`}>
          {loading ? <p className="p-6 text-center text-sm text-slate-500">{LOADING_LABEL}</p> : null}
          {!loading && messages.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500">{EMPTY_LABEL}</p>
          ) : null}
          {messages.map((message) => {
            const divider = formatDateDivider(message.created_at);
            const showDivider = divider !== lastDivider;
            lastDivider = divider;
            return (
              <div key={message.id}>
                {showDivider ? <DateDivider label={divider} /> : null}
                <ChatBubble message={message} viewerName={nickname} onMediaReady={handleMediaReady} />
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        {initialized && !needsNickname && !subscribed ? <SubscribeOverlay onSubscribe={handleSubscribe} /> : null}
      </div>

      <ChatComposer
        disabled={!initialized || !subscribed || !nickname}
        remainingMessages={remainingMessages}
        onSend={sendPrivateMessage}
      />
      {initialized && needsNickname ? <NicknameModal onSave={handleNickname} /> : null}
    </div>
  );
}
