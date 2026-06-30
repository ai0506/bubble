"use client";

import { isNicknameLengthValid } from "@/lib/limits";

const VISITOR_ID_KEY = "bubble_visitor_id";
const NICKNAME_KEY = "bubble_nickname";
const SUBSCRIPTION_EXPIRES_KEY = "bubble_subscription_expires_at";
const REMAINING_MESSAGES_KEY = "bubble_remaining_messages";
const LAST_ADMIN_MESSAGE_ID_KEY = "bubble_last_admin_message_id";

export const INITIAL_MESSAGE_ALLOWANCE = 3;

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

export function getSubscriptionExpiresAt() {
  return window.localStorage.getItem(SUBSCRIPTION_EXPIRES_KEY);
}

export function isSubscriptionActive() {
  const value = getSubscriptionExpiresAt();
  if (!value) return false;
  const expiresAt = new Date(value).getTime();
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export function activateOneYearSubscription() {
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  window.localStorage.setItem(SUBSCRIPTION_EXPIRES_KEY, expiresAt.toISOString());
  return expiresAt.toISOString();
}

export function getRemainingMessages() {
  const storedValue = window.localStorage.getItem(REMAINING_MESSAGES_KEY);
  if (storedValue === null) {
    window.localStorage.setItem(REMAINING_MESSAGES_KEY, String(INITIAL_MESSAGE_ALLOWANCE));
    return INITIAL_MESSAGE_ALLOWANCE;
  }

  const value = Number(storedValue);
  if (!Number.isFinite(value)) {
    window.localStorage.setItem(REMAINING_MESSAGES_KEY, String(INITIAL_MESSAGE_ALLOWANCE));
    return INITIAL_MESSAGE_ALLOWANCE;
  }
  return Math.max(0, Math.floor(value));
}

export function decrementRemainingMessages() {
  const nextValue = Math.max(0, getRemainingMessages() - 1);
  window.localStorage.setItem(REMAINING_MESSAGES_KEY, String(nextValue));
  return nextValue;
}

export function resetRemainingMessages() {
  window.localStorage.setItem(REMAINING_MESSAGES_KEY, String(INITIAL_MESSAGE_ALLOWANCE));
  return INITIAL_MESSAGE_ALLOWANCE;
}

export function syncAllowanceWithLatestAdminMessage(latestAdminMessageId: string | null) {
  if (!latestAdminMessageId) return getRemainingMessages();

  const previousId = window.localStorage.getItem(LAST_ADMIN_MESSAGE_ID_KEY);
  if (!previousId) {
    window.localStorage.setItem(LAST_ADMIN_MESSAGE_ID_KEY, latestAdminMessageId);
    return getRemainingMessages();
  }

  if (previousId !== latestAdminMessageId) {
    window.localStorage.setItem(LAST_ADMIN_MESSAGE_ID_KEY, latestAdminMessageId);
    return resetRemainingMessages();
  }

  return getRemainingMessages();
}
