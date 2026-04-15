import type { AppData, Grocery, Ingredient, Recipe, Supermarket, ThemeSettings, WeeklyPlanner } from "../types"

export const APP_DATA_VERSION = 3

function createEmptyWeeklyPlanner(): WeeklyPlanner {
  return {
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
    saturday: "",
    sunday: ""
  }
}

function getTimestamp() {
  return new Date().toISOString()
}

export function createInitialAppData(defaultThemeSettings: ThemeSettings): AppData {
  return {
    dataVersion: APP_DATA_VERSION,
    recipes: [],
    groceries: [],
    supermarkets: [],
    selectedRecipes: [],
    servingsOverride: {},
    themeSettings: defaultThemeSettings,
    syncSettings: {
      recipeSource: "local",
      grocerySource: "local"
    },
    syncStatus: {},
    weeklyPlanner: createEmptyWeeklyPlanner()
  }
}

function normalizeIngredient(rawIngredient: Partial<Ingredient> | undefined): Ingredient {
  return {
    id: rawIngredient?.id ?? crypto.randomUUID(),
    name: rawIngredient?.name ?? "",
    amount: rawIngredient?.amount ?? 1,
    unit: rawIngredient?.unit ?? "stuk",
    shelf: rawIngredient?.shelf ?? "overig",
    enabled: rawIngredient?.enabled === false ? false : true
  }
}

function normalizeRecipe(rawRecipe: Partial<Recipe> | undefined): Recipe {
  return {
    id: rawRecipe?.id ?? crypto.randomUUID(),
    name: rawRecipe?.name ?? "",
    ingredients: (rawRecipe?.ingredients ?? []).map(normalizeIngredient),
    labels: rawRecipe?.labels ?? [],
    notes: rawRecipe?.notes ?? "",
    servings: rawRecipe?.servings ?? 4,
    updatedAt: rawRecipe?.updatedAt ?? getTimestamp()
  }
}

function normalizeGrocery(rawGrocery: Partial<Grocery> | undefined): Grocery {
  return {
    id: rawGrocery?.id ?? crypto.randomUUID(),
    name: rawGrocery?.name ?? "",
    amount: rawGrocery?.amount ?? 1,
    unit: rawGrocery?.unit ?? "stuk",
    shelf: rawGrocery?.shelf ?? "overig",
    enabled: rawGrocery?.enabled === false ? false : true,
    category: rawGrocery?.category?.trim() || undefined,
    updatedAt: rawGrocery?.updatedAt ?? getTimestamp()
  }
}

function normalizeSupermarket(rawSupermarket: Partial<Supermarket> | undefined): Supermarket {
  return {
    id: rawSupermarket?.id ?? crypto.randomUUID(),
    name: rawSupermarket?.name ?? "",
    route: rawSupermarket?.route ?? [],
    isFavorite: rawSupermarket?.isFavorite ?? false,
    updatedAt: rawSupermarket?.updatedAt ?? getTimestamp()
  }
}

export function normalizeAppData(
  rawData: Partial<AppData> | null | undefined,
  defaultThemeSettings: ThemeSettings
): AppData {
  return {
    dataVersion: APP_DATA_VERSION,
    recipes: (rawData?.recipes ?? []).map(normalizeRecipe),
    groceries: (rawData?.groceries ?? []).map(normalizeGrocery),
    supermarkets: (rawData?.supermarkets ?? []).map(normalizeSupermarket),
    selectedRecipes: rawData?.selectedRecipes ?? [],
    servingsOverride: rawData?.servingsOverride ?? {},
    themeSettings: {
      ...defaultThemeSettings,
      ...rawData?.themeSettings
    },
    syncSettings: {
      recipeSource: rawData?.syncSettings?.recipeSource === "supabase" ? "supabase" : "local",
      recipeHouseholdId: rawData?.syncSettings?.recipeHouseholdId,
      grocerySource: rawData?.syncSettings?.grocerySource === "supabase" ? "supabase" : "local",
      groceryHouseholdId: rawData?.syncSettings?.groceryHouseholdId
    },
    syncStatus: {
      recipesLastPulledAt: rawData?.syncStatus?.recipesLastPulledAt,
      recipesLastPushedAt: rawData?.syncStatus?.recipesLastPushedAt,
      groceriesLastPulledAt: rawData?.syncStatus?.groceriesLastPulledAt,
      groceriesLastPushedAt: rawData?.syncStatus?.groceriesLastPushedAt,
      sharedShoppingListLastFetchedAt: rawData?.syncStatus?.sharedShoppingListLastFetchedAt,
      sharedShoppingListLastUpdatedAt: rawData?.syncStatus?.sharedShoppingListLastUpdatedAt
    },
    weeklyPlanner: {
      ...createEmptyWeeklyPlanner(),
      ...rawData?.weeklyPlanner
    }
  }
}
