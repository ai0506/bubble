"use client";

import { isNicknameLengthValid } from "@/lib/limits";

// visitor_id / 昵称是全局访客身份（跨爱豆共用）
const VISITOR_ID_KEY = "bubble_visitor_id";
const NICKNAME_KEY = "bubble_nickname";
// 订阅 / 剩余条数 / 最近一条爱豆消息 id 按爱豆维度拆分：key 加 :<idolId> 后缀
const SUBSCRIPTION_EXPIRES_KEY = "bubble_subscription_expires_at";
const REMAINING_MESSAGES_KEY = "bubble_remaining_messages";
const LAST_ADMIN_MESSAGE_ID_KEY = "bubble_last_admin_message_id";

export const INITIAL_MESSAGE_ALLOWANCE = 3;

function scopedKey(base: string, idolId: string) {
  return `${base}:${idolId}`;
}

export function getOrCreateVisitorId() {
  const existing = window.localStorage.getItem(VISITOR_ID_KEY);
  if (existing) return existing;

  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  window.localStorage.setItem(VISITOR_ID_KEY, id);
  return id;
}

export function getNickname() {
  const value = window.localStorage.getItem(NICKNAME_KEY) || "";
  return isNicknameLengthValid(value) ? value : "";
}

export function setNickname(value: string) {
  window.localStorage.setItem(NICKNAME_KEY, value.trim());
}

export function getSubscriptionExpiresAt(idolId: string) {
  return window.localStorage.getItem(scopedKey(SUBSCRIPTION_EXPIRES_KEY, idolId));
}

export function isSubscriptionActive(idolId: string) {
  const value = getSubscriptionExpiresAt(idolId);
  if (!value) return false;
  const expiresAt = new Date(value).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export function activateOneYearSubscription(idolId: string) {
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  window.localStorage.setItem(scopedKey(SUBSCRIPTION_EXPIRES_KEY, idolId), expiresAt.toISOString());
  return expiresAt.toISOString();
}

export function getRemainingMessages(idolId: string) {
  const key = scopedKey(REMAINING_MESSAGES_KEY, idolId);
  const storedValue = window.localStorage.getItem(key);
  if (storedValue === null) {
    window.localStorage.setItem(key, String(INITIAL_MESSAGE_ALLOWANCE));
    return INITIAL_MESSAGE_ALLOWANCE;
  }

  const value = Number(storedValue);
  if (!Number.isFinite(value)) {
    window.localStorage.setItem(key, String(INITIAL_MESSAGE_ALLOWANCE));
    return INITIAL_MESSAGE_ALLOWANCE;
  }
  return Math.max(0, Math.floor(value));
}

export function decrementRemainingMessages(idolId: string) {
  const nextValue = Math.max(0, getRemainingMessages(idolId) - 1);
  window.localStorage.setItem(scopedKey(REMAINING_MESSAGES_KEY, idolId), String(nextValue));
  return nextValue;
}

export function resetRemainingMessages(idolId: string) {
  window.localStorage.setItem(scopedKey(REMAINING_MESSAGES_KEY, idolId), String(INITIAL_MESSAGE_ALLOWANCE));
  return INITIAL_MESSAGE_ALLOWANCE;
}

export function syncAllowanceWithLatestAdminMessage(idolId: string, latestAdminMessageId: string | null) {
  if (!latestAdminMessageId) return getRemainingMessages(idolId);

  const key = scopedKey(LAST_ADMIN_MESSAGE_ID_KEY, idolId);
  const previousId = window.localStorage.getItem(key);
  if (!previousId) {
    window.localStorage.setItem(key, latestAdminMessageId);
    return getRemainingMessages(idolId);
  }

  if (previousId !== latestAdminMessageId) {
    window.localStorage.setItem(key, latestAdminMessageId);
    return resetRemainingMessages(idolId);
  }

  return getRemainingMessages(idolId);
}
