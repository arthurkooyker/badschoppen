import type {
  Recipe,
  RecipeConflictResolution,
  RecipeImportApplySummary,
  RecipeImportMode
} from "../types"

type ApplyRecipeImportParams = {
  localRecipes: Recipe[]
  importedRecipes: Recipe[]
  mode: RecipeImportMode
  conflictResolutions: Record<string, RecipeConflictResolution>
}

type ApplyRecipeImportResult = {
  recipes: Recipe[]
  summary: RecipeImportApplySummary
}

function resolveConflictRecipe(
  localRecipe: Recipe,
  importedRecipe: Recipe,
  resolution: RecipeConflictResolution
) {
  switch (resolution) {
    case "keep-local":
      return localRecipe
    case "keep-import":
      return importedRecipe
    case "keep-local-import-ingredients":
      return {
        ...localRecipe,
        ingredients: importedRecipe.ingredients,
        updatedAt: importedRecipe.updatedAt
      }
    case "keep-import-local-ingredients":
      return {
        ...importedRecipe,
        ingredients: localRecipe.ingredients
      }
  }
}

export function applyRecipeImport({
  localRecipes,
  importedRecipes,
  mode,
  conflictResolutions
}: ApplyRecipeImportParams): ApplyRecipeImportResult {
  if (mode === "overwrite") {
    return {
      recipes: importedRecipes,
      summary: {
        importedRecipeCount: importedRecipes.length,
        addedCount: importedRecipes.length,
        replacedCount: localRecipes.length,
        skippedCount: 0
      }
    }
  }

  const localRecipesById = new Map(localRecipes.map((recipe) => [recipe.id, recipe]))
  const nextRecipes = [...localRecipes]
  let addedCount = 0
  let replacedCount = 0
  let skippedCount = 0

  importedRecipes.forEach((importedRecipe) => {
    const existingIndex = nextRecipes.findIndex((recipe) => recipe.id === importedRecipe.id)

    if (existingIndex === -1) {
      nextRecipes.push(importedRecipe)
      addedCount += 1
      return
    }

    if (mode === "add-new-only") {
      skippedCount += 1
      return
    }

    const localRecipe = localRecipesById.get(importedRecipe.id)

    if (!localRecipe) {
      skippedCount += 1
      return
    }

    const resolution = conflictResolutions[importedRecipe.id]

    if (!resolution) {
      skippedCount += 1
      return
    }

    nextRecipes[existingIndex] = resolveConflictRecipe(localRecipe, importedRecipe, resolution)
    replacedCount += 1
  })

  return {
    recipes: nextRecipes,
    summary: {
      importedRecipeCount: importedRecipes.length,
      addedCount,
      replacedCount,
      skippedCount
    }
  }
}
