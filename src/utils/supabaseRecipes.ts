import { supabase } from "./supabase"

import type { Recipe, RecipeExportFile } from "../types"

export async function deleteRecipeFromHousehold(recipeId: string) {
  if (!supabase) {
    throw new Error("Supabase is nog niet geconfigureerd.")
  }

  const { error: ingredientDeleteError } = await supabase
    .from("recipe_ingredients")
    .delete()
    .eq("recipe_id", recipeId)

  if (ingredientDeleteError) {
    throw ingredientDeleteError
  }

  const { error: labelDeleteError } = await supabase
    .from("recipe_labels")
    .delete()
    .eq("recipe_id", recipeId)

  if (labelDeleteError) {
    throw labelDeleteError
  }

  const { error: recipeDeleteError } = await supabase
    .from("recipes")
    .delete()
    .eq("id", recipeId)

  if (recipeDeleteError) {
    throw recipeDeleteError
  }
}

export async function updateRecipeInHousehold(recipe: Recipe, householdId: string) {
  const result = await uploadRecipesToHousehold([recipe], householdId)

  return {
    uploadedCount: result.uploadedCount
  }
}

export async function uploadRecipesToHousehold(recipes: Recipe[], householdId: string) {
  if (!supabase) {
    throw new Error("Supabase is nog niet geconfigureerd.")
  }

  const recipeRows = recipes.map((recipe) => ({
    id: recipe.id,
    household_id: householdId,
    name: recipe.name,
    notes: recipe.notes ?? "",
    servings: recipe.servings,
    updated_at: recipe.updatedAt
  }))

  const { error: recipeError } = await supabase
    .from("recipes")
    .upsert(recipeRows, { onConflict: "id" })

  if (recipeError) {
    throw recipeError
  }

  for (const recipe of recipes) {
    const { error: ingredientDeleteError } = await supabase
      .from("recipe_ingredients")
      .delete()
      .eq("recipe_id", recipe.id)

    if (ingredientDeleteError) {
      throw ingredientDeleteError
    }

    if (recipe.ingredients.length > 0) {
      const ingredientRows = recipe.ingredients.map((ingredient) => ({
        id: ingredient.id,
        recipe_id: recipe.id,
        name: ingredient.name,
        amount: ingredient.amount,
        unit: ingredient.unit,
        shelf: ingredient.shelf,
        enabled: ingredient.enabled === false ? false : true,
        updated_at: recipe.updatedAt
      }))

      const { error: ingredientInsertError } = await supabase
        .from("recipe_ingredients")
        .insert(ingredientRows)

      if (ingredientInsertError) {
        throw ingredientInsertError
      }
    }

    const { error: labelDeleteError } = await supabase
      .from("recipe_labels")
      .delete()
      .eq("recipe_id", recipe.id)

    if (labelDeleteError) {
      throw labelDeleteError
    }

    const labels = recipe.labels ?? []

    if (labels.length > 0) {
      const labelRows = labels.map((label) => ({
        recipe_id: recipe.id,
        label
      }))

      const { error: labelInsertError } = await supabase
        .from("recipe_labels")
        .insert(labelRows)

      if (labelInsertError) {
        throw labelInsertError
      }
    }
  }

  return {
    uploadedCount: recipes.length
  }
}

export async function fetchRecipesFromHousehold(householdId: string): Promise<RecipeExportFile> {
  if (!supabase) {
    throw new Error("Supabase is nog niet geconfigureerd.")
  }

  const { data: recipeRows, error: recipeError } = await supabase
    .from("recipes")
    .select("id, name, notes, servings, updated_at")
    .eq("household_id", householdId)
    .is("deleted_at", null)
    .order("name", { ascending: true })

  if (recipeError) {
    throw recipeError
  }

  const recipes = recipeRows ?? []
  const recipeIds = recipes.map((recipe) => recipe.id)

  if (recipeIds.length === 0) {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      recipes: []
    }
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

  const ingredientsByRecipeId = new Map<string, Array<{
    id: string
    name: string
    amount: number
    unit: string
    shelf: string
    enabled: boolean
  }>>()

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

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recipes: recipes.map((recipe) => ({
      id: recipe.id,
      name: recipe.name,
      notes: recipe.notes ?? "",
      servings: recipe.servings,
      updatedAt: recipe.updated_at,
      ingredients: ingredientsByRecipeId.get(recipe.id) ?? [],
      labels: labelsByRecipeId.get(recipe.id) ?? []
    }))
  }
}
