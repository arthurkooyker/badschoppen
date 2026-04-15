import { supabase } from "./supabase"

import type { Grocery } from "../types"

export async function uploadGroceriesToHousehold(groceries: Grocery[], householdId: string) {
  if (!supabase) {
    throw new Error("Supabase is nog niet geconfigureerd.")
  }

  const groceryRows = groceries.map((grocery) => ({
    id: grocery.id,
    household_id: householdId,
    name: grocery.name,
    amount: grocery.amount ?? 1,
    unit: grocery.unit ?? "stuk",
    shelf: grocery.shelf ?? "overig",
    enabled: grocery.enabled === false ? false : true,
    category: grocery.category ?? null,
    updated_at: grocery.updatedAt
  }))

  const { error } = await supabase
    .from("groceries")
    .upsert(groceryRows, { onConflict: "id" })

  if (error) {
    throw error
  }

  return {
    uploadedCount: groceries.length
  }
}

export async function fetchGroceriesFromHousehold(householdId: string): Promise<Grocery[]> {
  if (!supabase) {
    throw new Error("Supabase is nog niet geconfigureerd.")
  }

  const { data, error } = await supabase
    .from("groceries")
    .select("id, name, amount, unit, shelf, enabled, category, updated_at")
    .eq("household_id", householdId)
    .is("deleted_at", null)
    .order("name", { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []).map((grocery) => ({
    id: grocery.id,
    name: grocery.name,
    amount: Number(grocery.amount),
    unit: grocery.unit,
    shelf: grocery.shelf,
    enabled: grocery.enabled,
    category: grocery.category ?? undefined,
    updatedAt: grocery.updated_at
  }))
}

export async function deleteGroceryFromSupabase(groceryId: string) {
  if (!supabase) {
    throw new Error("Supabase is nog niet geconfigureerd.")
  }

  const { error } = await supabase
    .from("groceries")
    .delete()
    .eq("id", groceryId)

  if (error) {
    throw error
  }
}
