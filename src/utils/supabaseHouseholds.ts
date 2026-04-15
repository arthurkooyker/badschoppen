import { supabase } from "./supabase"

export type HouseholdSummary = {
  id: string
  name: string
  role: string
}

export type HouseholdInvite = {
  inviteCode: string
  expiresAt: string
}

export async function getMyHouseholds() {
  if (!supabase) {
    throw new Error("Supabase is nog niet geconfigureerd.")
  }

  const { data, error } = await supabase.rpc("get_my_households")

  if (error) {
    throw error
  }

  return (data ?? []) as HouseholdSummary[]
}

export async function createHouseholdWithOwner(householdName: string) {
  if (!supabase) {
    throw new Error("Supabase is nog niet geconfigureerd.")
  }

  const { data, error } = await supabase.rpc("create_household_with_owner", {
    household_name: householdName
  })

  if (error) {
    throw error
  }

  return data as string
}

export async function createHouseholdInvite(householdId: string) {
  if (!supabase) {
    throw new Error("Supabase is nog niet geconfigureerd.")
  }

  const { data, error } = await supabase.rpc("create_household_invite", {
    target_household_id: householdId
  })

  if (error) {
    throw error
  }

  const invite = Array.isArray(data) ? data[0] : data

  return {
    inviteCode: invite.invite_code as string,
    expiresAt: invite.expires_at as string
  } satisfies HouseholdInvite
}

export async function joinHouseholdByInvite(inviteCode: string) {
  if (!supabase) {
    throw new Error("Supabase is nog niet geconfigureerd.")
  }

  const { data, error } = await supabase.rpc("join_household_by_invite", {
    invite_code_input: inviteCode.trim()
  })

  if (error) {
    throw error
  }

  return data as string
}
