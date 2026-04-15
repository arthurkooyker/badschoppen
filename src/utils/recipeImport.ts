import type { Ingredient, Recipe, RecipeExportFile } from "../types"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function normalizeIngredient(rawIngredient: unknown): Ingredient {
  if (!isRecord(rawIngredient)) {
    throw new Error("Een ingredient in het importbestand heeft geen geldige structuur.")
  }

  const name = typeof rawIngredient.name === "string" ? rawIngredient.name.trim() : ""
  const unit = typeof rawIngredient.unit === "string" ? rawIngredient.unit : ""
  const shelf = typeof rawIngredient.shelf === "string" ? rawIngredient.shelf : ""
  const amount = typeof rawIngredient.amount === "number" ? rawIngredient.amount : Number(rawIngredient.amount)

  if (name === "" || unit === "" || shelf === "" || Number.isNaN(amount)) {
    throw new Error("Een ingredient in het importbestand mist naam, hoeveelheid, eenheid of schap.")
  }

  return {
    id: typeof rawIngredient.id === "string" && rawIngredient.id !== ""
      ? rawIngredient.id
      : crypto.randomUUID(),
    name,
    amount,
    unit,
    shelf,
    enabled: rawIngredient.enabled === false ? false : true
  }
}

function normalizeRecipe(rawRecipe: unknown): Recipe {
  if (!isRecord(rawRecipe)) {
    throw new Error("Een recept in het importbestand heeft geen geldige structuur.")
  }

  const id = typeof rawRecipe.id === "string" ? rawRecipe.id : ""
  const name = typeof rawRecipe.name === "string" ? rawRecipe.name.trim() : ""
  const servings =
    typeof rawRecipe.servings === "number"
      ? rawRecipe.servings
      : Number(rawRecipe.servings)

  if (id === "" || name === "" || Number.isNaN(servings)) {
    throw new Error("Een recept in het importbestand mist id, naam of aantal personen.")
  }

  if (!Array.isArray(rawRecipe.ingredients)) {
    throw new Error(`Recept "${name}" heeft geen geldige ingredientenlijst.`)
  }

  const labels = Array.isArray(rawRecipe.labels)
    ? rawRecipe.labels.filter((label): label is string => typeof label === "string" && label.trim() !== "")
    : undefined

  return {
    id,
    name,
    servings,
    ingredients: rawRecipe.ingredients.map(normalizeIngredient),
    labels,
    notes: typeof rawRecipe.notes === "string" ? rawRecipe.notes : undefined,
    updatedAt:
      typeof rawRecipe.updatedAt === "string" && rawRecipe.updatedAt !== ""
        ? rawRecipe.updatedAt
        : new Date().toISOString()
  }
}

export function parseRecipeImportFile(text: string): RecipeExportFile {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error("Het gekozen bestand is geen geldige JSON.")
  }

  if (Array.isArray(parsed)) {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      recipes: parsed.map(normalizeRecipe)
    }
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.recipes)) {
    throw new Error("Het bestand bevat geen herkenbare receptenexport.")
  }

  return {
    version: 1,
    exportedAt:
      typeof parsed.exportedAt === "string" && parsed.exportedAt !== ""
        ? parsed.exportedAt
        : new Date().toISOString(),
    recipes: parsed.recipes.map(normalizeRecipe)
  }
}
