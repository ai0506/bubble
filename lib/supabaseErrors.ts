export function isMissingMessagesTable(error: { message?: string } | null) {
  return Boolean(error?.message?.includes("Could not find the table 'public.messages'"));
}
