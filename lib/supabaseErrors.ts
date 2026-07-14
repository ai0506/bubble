type SupabaseErrorLike = { code?: string; message?: string } | null;

export function isMissingMessagesTable(error: SupabaseErrorLike) {
  return Boolean(
    error?.message?.includes("public.messages") &&
      (error.code === "PGRST205" || error.message.includes("Could not find the table")),
  );
}

export function isMissingMessageReadsTable(error: SupabaseErrorLike) {
  return Boolean(
    error?.message?.includes("public.message_reads") &&
      (error.code === "PGRST205" || error.message.includes("Could not find the table")),
  );
}
