export function getSupabaseErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === "object" && error !== null) {
    const message = "message" in error ? error.message : null
    const details = "details" in error ? error.details : null
    const hint = "hint" in error ? error.hint : null

    const parts = [message, details, hint].filter(
      (part): part is string => typeof part === "string" && part.trim() !== ""
    )

    if (parts.length > 0) {
      return parts.join(" | ")
    }
  }

  return "Er kwam een onbekende fout terug van Supabase."
}
