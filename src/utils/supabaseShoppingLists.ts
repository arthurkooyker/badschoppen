import { supabase } from "./supabase"

import type { Grocery, Recipe, SharedShoppingList, SharedShoppingListData } from "../types"

async function getOrCreateActiveShoppingList(householdId: string, userId: string) {
  if (!supabase) {
    throw new Error("Supabase is nog niet geconfigureerd.")
  }

  const { data: existingList, error: existingListError } = await supabase
    .from("shopping_lists")
    .select("id, household_id, name, is_active, updated_at")
    .eq("household_id", householdId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingListError) {
    throw existingListError
  }

  if (existingList) {
    return existingList
  }

  const { data: createdList, error: createError } = await supabase
    .from("shopping_lists")
    .insert({
      household_id: householdId,
      name: "Actieve boodschappenlijst",
      is_active: true,
      created_by: userId
    })
    .select("id, household_id, name, is_active, updated_at")
    .single()

  if (createError) {
    throw createError
  }

  return createdList
}

export async function syncActiveShoppingList(params: {
  householdId: string
  userId: string
  recipes: Recipe[]
  selectedRecipeIds: string[]
  servingsOverride: Record<string, number>
  groceries: Grocery[]
}) {
  if (!supabase) {
    throw new Error("Supabase is nog niet geconfigureerd.")
  }

  const activeList = await getOrCreateActiveShoppingList(params.householdId, params.userId)

  const { data: existingGroceryEntries, error: existingGroceryEntriesError } = await supabase
    .from("shopping_list_groceries")
    .select("grocery_id, checked")
    .eq("shopping_list_id", activeList.id)

  if (existingGroceryEntriesError) {
    throw existingGroceryEntriesError
  }

  const checkedByGroceryId = new Map(
    (existingGroceryEntries ?? []).map((entry) => [entry.grocery_id, entry.checked])
  )

  const selectedRecipeRows = params.recipes
    .filter((recipe) => params.selectedRecipeIds.includes(recipe.id))
    .map((recipe) => ({
      shopping_list_id: activeList.id,
      recipe_id: recipe.id,
      servings: params.servingsOverride[recipe.id] ?? recipe.servings,
      included: true
    }))

  const groceryRows = params.groceries.map((grocery) => ({
    shopping_list_id: activeList.id,
    grocery_id: grocery.id,
    included: grocery.enabled === false ? false : true,
    checked: checkedByGroceryId.get(grocery.id) ?? false
  }))

  const { error: deleteRecipeEntriesError } = await supabase
    .from("shopping_list_recipes")
    .delete()
    .eq("shopping_list_id", activeList.id)

  if (deleteRecipeEntriesError) {
    throw deleteRecipeEntriesError
  }

  if (selectedRecipeRows.length > 0) {
    const { error: insertRecipeEntriesError } = await supabase
      .from("shopping_list_recipes")
      .insert(selectedRecipeRows)

    if (insertRecipeEntriesError) {
      throw insertRecipeEntriesError
    }
  }

  const { error: deleteGroceryEntriesError } = await supabase
    .from("shopping_list_groceries")
    .delete()
    .eq("shopping_list_id", activeList.id)

  if (deleteGroceryEntriesError) {
    throw deleteGroceryEntriesError
  }

  if (groceryRows.length > 0) {
    const { error: insertGroceryEntriesError } = await supabase
      .from("shopping_list_groceries")
      .insert(groceryRows)

    if (insertGroceryEntriesError) {
      throw insertGroceryEntriesError
    }
  }

  return {
    shoppingListId: activeList.id,
    recipeCount: selectedRecipeRows.length,
    groceryCount: groceryRows.length
  }
}

export async function fetchActiveShoppingList(householdId: string): Promise<SharedShoppingList | null> {
  if (!supabase) {
    throw new Error("Supabase is nog niet geconfigureerd.")
  }

  const { data: activeList, error: activeListError } = await supabase
    .from("shopping_lists")
    .select("id, household_id, name, is_active, updated_at")
    .eq("household_id", householdId)
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (activeListError) {
    throw activeListError
  }

  if (!activeList) {
    return null
  }

  const { data: recipeEntries, error: recipeEntriesError } = await supabase
    .from("shopping_list_recipes")
    .select("id, recipe_id, servings, included, recipes!inner(name)")
    .eq("shopping_list_id", activeList.id)

  if (recipeEntriesError) {
    throw recipeEntriesError
  }

  const { data: groceryEntries, error: groceryEntriesError } = await supabase
    .from("shopping_list_groceries")
    .select("id, grocery_id, included, checked, groceries!inner(name)")
    .eq("shopping_list_id", activeList.id)

  if (groceryEntriesError) {
    throw groceryEntriesError
  }

  return {
    id: activeList.id,
    householdId: activeList.household_id,
    name: activeList.name,
    isActive: activeList.is_active,
    updatedAt: activeList.updated_at,
    recipes: (recipeEntries ?? []).map((entry) => ({
      id: entry.id,
      recipeId: entry.recipe_id,
      recipeName: Array.isArray(entry.recipes) ? entry.recipes[0]?.name ?? "" : entry.recipes?.name ?? "",
      servings: entry.servings,
      included: entry.included
    })),
    groceries: (groceryEntries ?? []).map((entry) => ({
      id: entry.id,
      groceryId: entry.grocery_id,
      groceryName: Array.isArray(entry.groceries) ? entry.groceries[0]?.name ?? "" : entry.groceries?.name ?? "",
      included: entry.included,
      checked: entry.checked
    }))
  }
}

export async function fetchActiveShoppingListData(householdId: string): Promise<SharedShoppingListData | null> {
  if (!supabase) {
    throw new Error("Supabase is nog niet geconfigureerd.")
  }

  const shoppingList = await fetchActiveShoppingList(householdId)

  if (!shoppingList) {
    return null
  }

  const includedRecipeEntries = shoppingList.recipes.filter((entry) => entry.included)
  const includedGroceryEntries = shoppingList.groceries.filter((entry) => entry.included)
  const recipeIds = includedRecipeEntries.map((entry) => entry.recipeId)
  const groceryIds = includedGroceryEntries.map((entry) => entry.groceryId)

  let recipes: Recipe[] = []
  let groceries: Grocery[] = []

  if (recipeIds.length > 0) {
    const { data: recipeRows, error: recipeError } = await supabase
      .from("recipes")
      .select("id, name, notes, servings, updated_at")
      .in("id", recipeIds)
      .is("deleted_at", null)

    if (recipeError) {
      throw recipeError
    }

    const { data: ingredientRows, error: ingredientError } = await supabase
      .from("recipe_ingredients")
      .select("id, recipe_id, name, amount, unit, shelf, enabled")
      .in("recipe_id", recipeIds)

    if (ingredientError) {
      throw ingredientError
    }

    const { data: labelRows, error: labelError } = await supabase
      .from("recipe_labels")
      .select("recipe_id, label")
      .in("recipe_id", recipeIds)

    if (labelError) {
      throw labelError
    }

    const ingredientsByRecipeId = new Map<string, Recipe["ingredients"]>()

    for (const ingredient of ingredientRows ?? []) {
      const current = ingredientsByRecipeId.get(ingredient.recipe_id) ?? []
      current.push({
        id: ingredient.id,
        name: ingredient.name,
        amount: Number(ingredient.amount),
        unit: ingredient.unit,
        shelf: ingredient.shelf,
        enabled: ingredient.enabled
      })
      ingredientsByRecipeId.set(ingredient.recipe_id, current)
    }

    const labelsByRecipeId = new Map<string, string[]>()

    for (const labelRow of labelRows ?? []) {
      const current = labelsByRecipeId.get(labelRow.recipe_id) ?? []
      current.push(labelRow.label)
      labelsByRecipeId.set(labelRow.recipe_id, current)
    }

    recipes = (recipeRows ?? []).map((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      notes: recipe.notes ?? "",
      servings: recipe.servings,
      updatedAt: recipe.updated_at,
      ingredients: ingredientsByRecipeId.get(recipe.id) ?? [],
      labels: labelsByRecipeId.get(recipe.id) ?? []
    }))
  }

  if (groceryIds.length > 0) {
    const { data: groceryRows, error: groceryError } = await supabase
      .from("groceries")
      .select("id, name, amount, unit, shelf, enabled, category, updated_at")
      .in("id", groceryIds)
      .is("deleted_at", null)

    if (groceryError) {
      throw groceryError
    }

    const includedByGroceryId = new Map(
      includedGroceryEntries.map((entry) => [entry.groceryId, entry.included])
    )

    groceries = (groceryRows ?? []).map((grocery) => ({
      id: grocery.id,
      name: grocery.name,
      amount: Number(grocery.amount),
      unit: grocery.unit,
      shelf: grocery.shelf,
      enabled: includedByGroceryId.get(grocery.id) ?? grocery.enabled,
      category: grocery.category ?? undefined,
      updatedAt: grocery.updated_at
    }))
  }

  return {
    shoppingList,
    recipes,
    selectedRecipeIds: includedRecipeEntries.map((entry) => entry.recipeId),
    servingsOverride: Object.fromEntries(
      includedRecipeEntries.map((entry) => [entry.recipeId, entry.servings])
    ),
    groceries
  }
}

export async function clearShoppingList(listId: string) {
  if (!supabase) {
    throw new Error("Supabase is nog niet geconfigureerd.")
  }

  const { error: recipeError } = await supabase
    .from("shopping_list_recipes")
    .delete()
    .eq("shopping_list_id", listId)

  if (recipeError) {
    throw recipeError
  }

  const { error: groceryError } = await supabase
    .from("shopping_list_groceries")
    .delete()
    .eq("shopping_list_id", listId)

  if (groceryError) {
    throw groceryError
  }
}

export async function removeRecipeFromShoppingList(listId: string, recipeId: string) {
  if (!supabase) {
    throw new Error("Supabase is nog niet geconfigureerd.")
  }

  const { error } = await supabase
    .from("shopping_list_recipes")
    .delete()
    .eq("shopping_list_id", listId)
    .eq("recipe_id", recipeId)

  if (error) {
    throw error
  }
}

export async function removeGroceriesFromShoppingList(listId: string, groceryIds: string[]) {
  if (!supabase) {
    throw new Error("Supabase is nog niet geconfigureerd.")
  }

  if (groceryIds.length === 0) {
    return
  }

  const { error } = await supabase
    .from("shopping_list_groceries")
    .delete()
    .eq("shopping_list_id", listId)
    .in("grocery_id", groceryIds)

  if (error) {
    throw error
  }
}
