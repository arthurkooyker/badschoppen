export type Ingredient = {
  id: string
  name: string
  amount: number
  unit: string
  shelf: string
  enabled?: boolean
}

export type Recipe = {
  id: string
  name: string
  ingredients: Ingredient[]
  labels?: string[]
  notes?: string
  servings: number
  updatedAt: string
}

export type RecipeExportFile = {
  version: 1
  exportedAt: string
  recipes: Recipe[]
}

export type RecipeImportMode =
  | "overwrite"
  | "merge"
  | "add-new-only"
  | "add-new-and-update-changed"

export type RecipeConflictResolution =
  | "keep-local"
  | "keep-import"
  | "keep-local-import-ingredients"
  | "keep-import-local-ingredients"

export type RecipeImportApplySummary = {
  importedRecipeCount: number
  addedCount: number
  replacedCount: number
  skippedCount: number
}

export type SharedShoppingListRecipeEntry = {
  id: string
  recipeId: string
  recipeName: string
  servings: number
  included: boolean
}

export type SharedShoppingListGroceryEntry = {
  id: string
  groceryId: string
  groceryName: string
  included: boolean
  checked: boolean
}

export type SharedShoppingList = {
  id: string
  householdId: string
  name: string
  isActive: boolean
  updatedAt: string
  recipes: SharedShoppingListRecipeEntry[]
  groceries: SharedShoppingListGroceryEntry[]
}

export type SharedShoppingListData = {
  shoppingList: SharedShoppingList
  recipes: Recipe[]
  selectedRecipeIds: string[]
  servingsOverride: Record<string, number>
  groceries: Grocery[]
}

export type Grocery = {
  id: string
  name: string
  amount?: number
  unit?: string
  shelf?: string
  enabled?: boolean
  category?: string
  updatedAt: string
}

export type Supermarket = {
  id: string
  name: string
  route: string[]
  isFavorite?: boolean
  updatedAt: string
}

export type ThemeSettings = {
  appBackground: string
  appBackgroundAccent: string
  panelBackground: string
  textPrimary: string
  inputBackground: string
  inputText: string
  accent: string
  accentStrong: string
}

export type SyncSettings = {
  recipeSource: "local" | "supabase"
  recipeHouseholdId?: string
  grocerySource: "local" | "supabase"
  groceryHouseholdId?: string
}

export type SyncStatus = {
  recipesLastPulledAt?: string
  recipesLastPushedAt?: string
  groceriesLastPulledAt?: string
  groceriesLastPushedAt?: string
  sharedShoppingListLastFetchedAt?: string
  sharedShoppingListLastUpdatedAt?: string
}

export type WeeklyPlanner = {
  monday: string
  tuesday: string
  wednesday: string
  thursday: string
  friday: string
  saturday: string
  sunday: string
}

export type AppData = {
  dataVersion: number
  recipes: Recipe[]
  groceries: Grocery[]
  supermarkets: Supermarket[]
  selectedRecipes: string[]
  servingsOverride: Record<string, number>
  themeSettings?: ThemeSettings
  syncSettings?: SyncSettings
  syncStatus?: SyncStatus
  weeklyPlanner?: WeeklyPlanner
}
