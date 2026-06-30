"use client";

import { useState } from "react";
import { isNicknameLengthValid, NICKNAME_MAX_LENGTH } from "@/lib/limits";

const REQUIRED_ERROR = "\u8bf7\u8f93\u5165\u6635\u79f0";
const LENGTH_ERROR = "\u6635\u79f0\u9700\u8981 3~12 \u4e2a\u5b57\u7b26";
const TITLE = "\u8bbe\u7f6e\u6635\u79f0";
const DESCRIPTION = "\u7b2c\u4e00\u6b21\u8fdb\u5165\u9700\u8981\u4e00\u4e2a\u6635\u79f0\uff0c\u7528\u6765\u663e\u793a\u4f60\u7684\u79c1\u4fe1\u3002";
const PLACEHOLDER = "\u4f8b\u5982\uff1a\u5c0f\u6ce1\u6ce1";
const SUBMIT_LABEL = "\u8fdb\u5165\u804a\u5929";

type NicknameModalProps = {
  onSave: (nickname: string) => void;
};

export function NicknameModal({ onSave }: NicknameModalProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextValue = value.trim();
    if (!nextValue) {
      setError(REQUIRED_ERROR);
      return;
    }
    if (!isNicknameLengthValid(nextValue)) {
      setError(LENGTH_ERROR);
      return;
    }
    onSave(nextValue);
  }

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/30 px-6">
      <form onSubmit={submit} className="w-full rounded-2xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-semibold">{TITLE}</h2>
        <p className="mt-1 text-sm text-slate-600">{DESCRIPTION}</p>
        <input
          autoFocus
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError("");
          }}
          maxLength={NICKNAME_MAX_LENGTH}
          className="mt-4 h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 outline-none focus:border-slate-500"
          placeholder={PLACEHOLDER}
        />
        {error ? <p className="mt-2 text-sm text-rose-600">{error}</p> : null}
        <button
          type="submit"
          className="mt-4 h-11 w-full rounded-full bg-ink text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          {SUBMIT_LABEL}
        </button>
      </form>
    </div>
  );
}
