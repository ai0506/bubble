"use client";

import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { ChatComposer } from "@/components/ChatComposer";
import { DateDivider } from "@/components/DateDivider";
import { NicknameModal } from "@/components/NicknameModal";
import { SubscribeOverlay } from "@/components/SubscribeOverlay";
import { formatDateDivider } from "@/lib/dates";
import type { ChatMessage } from "@/lib/types";
import {
  activateOneYearSubscription,
  decrementRemainingMessages,
  getNickname,
  getOrCreateVisitorId,
  getRemainingMessages,
  isSubscriptionActive,
  setNickname as saveNickname,
  syncAllowanceWithLatestAdminMessage,
} from "@/lib/visitor";

const DEFAULT_SITE_NAME = "asw\u7684Bubble";
const SUBSCRIBED_LABEL = "\u8ba2\u9605\u6709\u6548\u81f32027-06-30";
const UNSUBSCRIBED_LABEL = "\u672a\u8ba2\u9605";
const REFRESH_LABEL = "\u5237\u65b0\u6d88\u606f";
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

export function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [visitorId, setVisitorId] = useState("");
  const [nickname, setNickname] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [remainingMessages, setRemainingMessages] = useState(3);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const needsNickname = useMemo(() => Boolean(visitorId) && !nickname, [visitorId, nickname]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    const response = await fetch(`/api/messages?visitorId=${encodeURIComponent(id)}`, {
      cache: "no-store",
    });
    if (!response.ok) return;
    const data = (await response.json()) as { messages: ChatMessage[] };
    setMessages(data.messages);
    setRemainingMessages(syncAllowanceWithLatestAdminMessage(getLatestAdminMessageId(data.messages)));
  }, []);

  useEffect(() => {
    const id = getOrCreateVisitorId();
    setVisitorId(id);
    setNickname(getNickname());
    setSubscribed(isSubscriptionActive());
    setRemainingMessages(getRemainingMessages());
    setInitialized(true);

    loadMessages(id).finally(() => setLoading(false));
  }, [loadMessages]);

  useEffect(() => {
    scrollToBottom("smooth");
  }, [messages, subscribed, scrollToBottom]);

  useEffect(() => {
    if (!visitorId) return;

    const timer = window.setInterval(() => {
      void loadMessages(visitorId);
    }, 15_000);

    return () => window.clearInterval(timer);
  }, [loadMessages, visitorId]);

  async function sendPrivateMessage(text: string) {
    if (!visitorId || !nickname || !subscribed) return;

    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitorId, nickname, contentText: text }),
    });

    if (!response.ok) {
      throw new Error("Failed to send message.");
    }

    setRemainingMessages(decrementRemainingMessages());
    await loadMessages(visitorId);
  }

  function handleNickname(value: string) {
    saveNickname(value);
    setNickname(value);
  }

  function handleSubscribe() {
    activateOneYearSubscription();
    setSubscribed(true);
  }

  let lastDivider = "";

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-black/5 bg-white/85 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold">
              {process.env.NEXT_PUBLIC_SITE_NAME || DEFAULT_SITE_NAME}
            </h1>
            <p className="text-xs text-slate-500">
              {!initialized ? " " : subscribed ? SUBSCRIBED_LABEL : UNSUBSCRIBED_LABEL}
            </p>
          </div>
          <button
            type="button"
            onClick={() => visitorId && loadMessages(visitorId)}
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
                <ChatBubble message={message} viewerName={nickname} onMediaReady={() => scrollToBottom("auto")} />
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
