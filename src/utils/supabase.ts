import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export function getSupabaseConfigError() {
  if (!supabaseUrl && !supabaseAnonKey) {
    return "Supabase URL en anon key ontbreken nog in het .env bestand."
  }

  if (!supabaseUrl) {
    return "Supabase URL ontbreekt nog in het .env bestand."
  }

  if (!supabaseAnonKey) {
    return "Supabase anon key ontbreekt nog in het .env bestand."
  }

  return ""
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null
