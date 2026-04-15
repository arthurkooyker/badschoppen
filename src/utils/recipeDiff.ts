import type { Ingredient, Recipe } from "../types"

function normalizeIngredientForComparison(ingredient: Ingredient) {
  return {
    name: ingredient.name.trim(),
    amount: ingredient.amount,
    unit: ingredient.unit,
    shelf: ingredient.shelf,
    enabled: ingredient.enabled === false ? false : true
  }
}

function sortIngredientsForComparison(ingredients: Ingredient[]) {
  return ingredients
    .map(normalizeIngredientForComparison)
    .sort((a, b) =>
      `${a.name}|${a.unit}|${a.shelf}|${a.amount}|${a.enabled}`.localeCompare(
        `${b.name}|${b.unit}|${b.shelf}|${b.amount}|${b.enabled}`
      )
    )
}

function normalizeRecipeForComparison(recipe: Recipe) {
  return {
    name: recipe.name.trim(),
    servings: recipe.servings,
    notes: recipe.notes ?? "",
    labels: [...(recipe.labels ?? [])].sort((a, b) => a.localeCompare(b)),
    ingredients: sortIngredientsForComparison(recipe.ingredients)
  }
}

export function areRecipesEquivalent(localRecipe: Recipe, importedRecipe: Recipe) {
  return JSON.stringify(normalizeRecipeForComparison(localRecipe)) ===
    JSON.stringify(normalizeRecipeForComparison(importedRecipe))
}

export function areIngredientListsEquivalent(localIngredients: Ingredient[], importedIngredients: Ingredient[]) {
  return JSON.stringify(sortIngredientsForComparison(localIngredients)) ===
    JSON.stringify(sortIngredientsForComparison(importedIngredients))
}

export function getRecipeDifferenceFlags(localRecipe: Recipe, importedRecipe: Recipe) {
  const localLabels = [...(localRecipe.labels ?? [])].sort((a, b) => a.localeCompare(b))
  const importedLabels = [...(importedRecipe.labels ?? [])].sort((a, b) => a.localeCompare(b))

  return {
    name: localRecipe.name.trim() !== importedRecipe.name.trim(),
    servings: localRecipe.servings !== importedRecipe.servings,
    notes: (localRecipe.notes ?? "") !== (importedRecipe.notes ?? ""),
    labels: JSON.stringify(localLabels) !== JSON.stringify(importedLabels),
    ingredients: !areIngredientListsEquivalent(localRecipe.ingredients, importedRecipe.ingredients)
  }
}
