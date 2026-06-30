"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { isUserMessageLengthValid } from "@/lib/limits";

const DISABLED_PLACEHOLDER = "\u8ba2\u9605\u540e\u5373\u53ef\u7559\u8a00";
const READY_PLACEHOLDER = "\u53d1\u9001\u6d88\u606f...";
const LIMIT_PLACEHOLDER = "\u7b49\u5f85 asw \u56de\u590d\u540e\u6062\u590d\u7559\u8a00\u6b21\u6570";
const SEND_LABEL = "\u53d1\u9001";
const REMAINING_PREFIX = "\u5269\u4f59";
const REMAINING_SUFFIX = "\u6b21";
const LIMIT_LABEL = "\u76ee\u524d\u7684\u7559\u8a00\u6b21\u6570\u7528\u5b8c\u4e86";
const TOO_LONG_ERROR = "\u6d88\u606f\u6700\u591a 300 \u4e2a\u5b57\u7b26\uff0c\u8bf7\u7b80\u77ed\u4e00\u70b9\u518d\u53d1\u9001";

type ChatComposerProps = {
  disabled: boolean;
  remainingMessages: number;
  onSend: (text: string) => Promise<void>;
};

export function ChatComposer({ disabled, remainingMessages, onSend }: ChatComposerProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const limitReached = remainingMessages <= 0;
  const blocked = disabled || limitReached;

  async function sendCurrentText() {
    const value = text.trim();
    if (!value || blocked || sending) return;
    if (!isUserMessageLengthValid(value)) {
      setError(TOO_LONG_ERROR);
      return;
    }

    setError("");
    setSending(true);
    try {
      await onSend(value);
      setText("");
    } finally {
      setSending(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await sendCurrentText();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") return;

    if (event.ctrlKey || event.metaKey) {
      return;
    }

    event.preventDefault();
    void sendCurrentText();
  }

  return (
    <form onSubmit={submit} className="shrink-0 border-t border-black/5 bg-white/80 p-3">
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setError("");
          }}
          onKeyDown={handleKeyDown}
          disabled={blocked || sending}
          rows={1}
          className="max-h-24 min-h-10 flex-1 resize-none rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-500 disabled:bg-slate-100 disabled:text-slate-400"
          placeholder={disabled ? DISABLED_PLACEHOLDER : limitReached ? LIMIT_PLACEHOLDER : READY_PLACEHOLDER}
        />
        <button
          type="submit"
          disabled={blocked || sending || !text.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-white transition hover:bg-slate-700 disabled:bg-slate-300"
          aria-label={SEND_LABEL}
        >
          <Send size={18} />
        </button>
      </div>
      <p className="mt-2 px-2 text-xs text-slate-500">
        {error || (limitReached ? LIMIT_LABEL : `${REMAINING_PREFIX} ${remainingMessages} ${REMAINING_SUFFIX}`)}
      </p>
    </form>
  );
}
