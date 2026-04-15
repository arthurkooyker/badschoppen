import { useEffect, useEffectEvent, useState } from "react"

import RecipeList from "./components/RecipeList"
import IngredientEditor from "./components/IngredientEditor"
import ShoppingList from "./components/ShoppingList"
import CustomGroceries from "./components/CustomGroceries"
import SupermarketEditor from "./components/SupermarketEditor"
import ThemePreferences from "./components/ThemePreferences"
import ImportExportPanel from "./components/ImportExportPanel"
import StartupSplash from "./components/StartupSplash"

import { SHELVES } from "./constants/shelves"

import { usePersistentState } from "./hooks/usePersistentState"
import { createInitialAppData, normalizeAppData } from "./utils/appData"
import { normalizeComparisonText } from "./utils/textNormalization"
import { normalizeUnit } from "./utils/unitConversion"
import { fetchGroceriesFromHousehold } from "./utils/supabaseGroceries"
import { fetchRecipesFromHousehold, updateRecipeInHousehold } from "./utils/supabaseRecipes"
import {
  clearShoppingList,
  fetchActiveShoppingListData,
  removeGroceriesFromShoppingList,
  removeRecipeFromShoppingList,
  syncActiveShoppingList
} from "./utils/supabaseShoppingLists"
import { getSupabaseErrorMessage } from "./utils/supabaseErrors"
import { supabase } from "./utils/supabase"
import "./style.css"
import type { Recipe, Ingredient, Grocery, ThemeSettings, AppData, SharedShoppingList, SharedShoppingListData, SyncStatus } from "./types" 

const WEEKLY_PLANNER_DAYS = [
  { key: "monday", label: "Ma" },
  { key: "tuesday", label: "Di" },
  { key: "wednesday", label: "Woe" },
  { key: "thursday", label: "Do" },
  { key: "friday", label: "Vrij" },
  { key: "saturday", label: "Za" },
  { key: "sunday", label: "Zon" }
] as const

const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  appBackground: "#f4efe7",
  appBackgroundAccent: "#dcefe8",
  panelBackground: "#fffcf8",
  textPrimary: "#18383b",
  inputBackground: "#f9fffd",
  inputText: "#173b3b",
  accent: "#2f8f83",
  accentStrong: "#1f6c74"
}

const NIGHT_THEME_SETTINGS: ThemeSettings = {
  appBackground: "#0f1b38",
  appBackgroundAccent: "#203a66",
  panelBackground: "#1a2744",
  textPrimary: "#b51a00",
  inputBackground: "#b7bec9",
  inputText: "#14203b",
  accent: "#006d8f",
  accentStrong: "#94e3fe"
}

const ENERGY_THEME_SETTINGS: ThemeSettings = {
  appBackground: "#e32400",
  appBackgroundAccent: "#669c35",
  panelBackground: "#ffa57d",
  textPrimary: "#38571a",
  inputBackground: "#008cb4",
  inputText: "#3b1c0f",
  accent: "#fec700",
  accentStrong: "#ff6a00"
}

const THEME_PRESETS = [
  {
    name: "Origineel",
    description: "De rustige lichte vormgeving die nu standaard actief is.",
    settings: DEFAULT_THEME_SETTINGS
  },
  {
    name: "Nacht",
    description: "Donkerblauw avondthema met zilvergrijze velden en een zachte gele sterrenaccentkleur.",
    settings: NIGHT_THEME_SETTINGS
  },
  {
    name: "Energie",
    description: "Fel, warm en levendig met rood, geel en groen, plus zandkleurige invulvelden.",
    settings: ENERGY_THEME_SETTINGS
  }
] as const

function App() {

  function getTimestamp() {
    return new Date().toISOString()
  }

  const [data, setData] = usePersistentState<AppData>(
    "badschoppen_data",
    createInitialAppData(DEFAULT_THEME_SETTINGS),
    (value) => normalizeAppData(value, DEFAULT_THEME_SETTINGS)
)

const recipes = data.recipes
const groceries = data.groceries
const supermarkets = data.supermarkets
const selectedRecipes = data.selectedRecipes
const servingsOverride = data.servingsOverride
const themeSettings = {
  ...DEFAULT_THEME_SETTINGS,
  ...data.themeSettings
}
const isNightThemeActive =
  themeSettings.appBackground === NIGHT_THEME_SETTINGS.appBackground &&
  themeSettings.appBackgroundAccent === NIGHT_THEME_SETTINGS.appBackgroundAccent &&
  themeSettings.panelBackground === NIGHT_THEME_SETTINGS.panelBackground &&
  themeSettings.accent === NIGHT_THEME_SETTINGS.accent &&
  themeSettings.accentStrong === NIGHT_THEME_SETTINGS.accentStrong
const syncSettings = data.syncSettings ?? {
  recipeSource: "local" as const,
  grocerySource: "local" as const
}
const syncStatus = data.syncStatus ?? {}
const weeklyPlanner = data.weeklyPlanner ?? {
  monday: "",
  tuesday: "",
  wednesday: "",
  thursday: "",
  friday: "",
  saturday: "",
  sunday: ""
}

const [newRecipe, setNewRecipe] = useState("")
const [recipeSearch, setRecipeSearch] = useState("")
const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null)
const [activeLabels, setActiveLabels] = useState<string[]>([])
const [activeSupermarketId, setActiveSupermarketId] = useState<string | null>(null)
const [newSupermarketName, setNewSupermarketName] = useState("")
const [activeTab, setActiveTab] = useState("recipes")
const [showStartupSplash, setShowStartupSplash] = useState(true)
const [sharedShoppingListPreview, setSharedShoppingListPreview] = useState<SharedShoppingList | null>(null)
const [sharedShoppingListData, setSharedShoppingListData] = useState<SharedShoppingListData | null>(null)
const [sharedShoppingListMessage, setSharedShoppingListMessage] = useState("")
const [sharedShoppingListError, setSharedShoppingListError] = useState("")
const [isSharedShoppingListSyncing, setIsSharedShoppingListSyncing] = useState(false)
const [isConfirmingClearAllLists, setIsConfirmingClearAllLists] = useState(false)
const [leftWidth, setLeftWidth] = useState(() => {
  if (typeof window === "undefined") return 360

  const oneThird = Math.round(window.innerWidth / 3)

  return Math.max(280, oneThird)
})

const selectedRecipeIndex =
  selectedRecipeId === null
    ? -1
    : recipes.findIndex((recipe) => recipe.id === selectedRecipeId)

const selectedRecipe =
  selectedRecipeIndex >= 0
    ? recipes[selectedRecipeIndex]
    : null

const favoriteSupermarket = supermarkets.find((supermarket) => supermarket.isFavorite)

const resolvedActiveSupermarketId =
  activeSupermarketId ?? favoriteSupermarket?.id ?? supermarkets[0]?.id ?? null

const resolvedActiveSupermarketIndex =
  resolvedActiveSupermarketId === null
    ? -1
    : supermarkets.findIndex((supermarket) => supermarket.id === resolvedActiveSupermarketId)

const activeSupermarket =
  resolvedActiveSupermarketIndex >= 0
    ? supermarkets[resolvedActiveSupermarketIndex]
    : null

useEffect(() => {
  const root = document.documentElement

  root.style.setProperty("--app-bg", themeSettings.appBackground)
  root.style.setProperty("--app-bg-accent", themeSettings.appBackgroundAccent)
  root.style.setProperty("--panel-bg", themeSettings.panelBackground)
  root.style.setProperty("--text-primary", themeSettings.textPrimary)
  root.style.setProperty("--text-secondary", isNightThemeActive ? "#ffffff" : "#5e7374")
  root.style.setProperty("--placeholder-text", isNightThemeActive ? "#ffffff" : "rgba(24, 56, 59, 0.42)")
  root.style.setProperty("--input-bg", themeSettings.inputBackground)
  root.style.setProperty("--input-text", themeSettings.inputText)
  root.style.setProperty("--button-bg", themeSettings.accent)
  root.style.setProperty("--accent", themeSettings.accent)
  root.style.setProperty("--accent-strong", themeSettings.accentStrong)
  root.style.setProperty("--button-bg-hover", themeSettings.accentStrong)
}, [
  themeSettings.accent,
  themeSettings.accentStrong,
  themeSettings.appBackground,
  themeSettings.appBackgroundAccent,
  themeSettings.inputBackground,
  themeSettings.inputText,
  themeSettings.panelBackground,
  themeSettings.textPrimary,
  isNightThemeActive
])

  function applyRecipesToData(nextRecipes: Recipe[]) {
    setData((currentData) => {
      const nextRecipeIds = new Set(nextRecipes.map((recipe) => recipe.id))
      const nextSelectedRecipes = currentData.selectedRecipes.filter((recipeId) => nextRecipeIds.has(recipeId))
      const nextServingsOverride = Object.fromEntries(
        Object.entries(currentData.servingsOverride).filter(([recipeId]) => nextRecipeIds.has(recipeId))
      )

      return {
        ...currentData,
        recipes: nextRecipes,
        selectedRecipes: nextSelectedRecipes,
        servingsOverride: nextServingsOverride
      }
    })

    if (selectedRecipeId !== null && !nextRecipes.some((recipe) => recipe.id === selectedRecipeId)) {
      setSelectedRecipeId(null)
    }
  }

  function applyGroceriesToData(nextGroceries: Grocery[]) {
    setData((currentData) => ({
      ...currentData,
      groceries: nextGroceries
    }))
  }

  function updateSyncStatus(patch: Partial<SyncStatus>) {
    setData((currentData) => ({
      ...currentData,
      syncStatus: {
        ...currentData.syncStatus,
        ...patch
      }
    }))
  }

  function updateWeeklyPlanner(day: keyof typeof weeklyPlanner, value: string) {
    setData((currentData) => ({
      ...currentData,
      weeklyPlanner: {
        ...(currentData.weeklyPlanner ?? weeklyPlanner),
        [day]: value
      }
    }))
  }

  function clearWeeklyPlanner() {
    setData((currentData) => ({
      ...currentData,
      weeklyPlanner: {
        monday: "",
        tuesday: "",
        wednesday: "",
        thursday: "",
        friday: "",
        saturday: "",
        sunday: ""
      }
    }))
  }

  function formatSyncTimestamp(value?: string) {
    if (!value) return "nog niet"

    return new Date(value).toLocaleString("nl-NL")
  }

  async function refreshRecipesFromSupabase() {
    const householdId = syncSettings.recipeHouseholdId

    if (syncSettings.recipeSource !== "supabase" || !householdId) {
      setSupabaseRecipeSyncError("Er is nog geen Supabase huishouden gekoppeld als receptenbron.")
      return
    }

    if (!supabase) {
      setSupabaseRecipeSyncError("Supabase is nog niet geconfigureerd in dit project.")
      return
    }

    setIsSupabaseRecipeSyncing(true)
    setSupabaseRecipeSyncError("")

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()

      if (authError) throw authError
      if (!authData.user) {
        throw new Error("Log eerst in bij Supabase om recepten rechtstreeks op te halen.")
      }

      const exportFile = await fetchRecipesFromHousehold(householdId)

      applyRecipesToData(exportFile.recipes)
      updateSyncStatus({ recipesLastPulledAt: getTimestamp() })
      setSupabaseRecipeSyncMessage(
        `${exportFile.recipes.length} recepten rechtstreeks uit Supabase geladen op ${new Date().toLocaleString("nl-NL")}.`
      )
    } catch (error) {
      setSupabaseRecipeSyncError(getSupabaseErrorMessage(error))
    } finally {
      setIsSupabaseRecipeSyncing(false)
    }
  }

  const refreshRecipesFromSupabaseOnSourceChange = useEffectEvent(async () => {
    await refreshRecipesFromSupabase()
  })

  useEffect(() => {
    if (syncSettings.recipeSource !== "supabase" || !syncSettings.recipeHouseholdId) {
      return
    }

    void refreshRecipesFromSupabaseOnSourceChange()
  }, [syncSettings.recipeHouseholdId, syncSettings.recipeSource])

  async function refreshGroceriesFromSupabase() {
    const householdId = syncSettings.groceryHouseholdId

    if (syncSettings.grocerySource !== "supabase" || !householdId) {
      setSupabaseGrocerySyncError("Er is nog geen Supabase huishouden gekoppeld als bron voor overige boodschappen.")
      return
    }

    if (!supabase) {
      setSupabaseGrocerySyncError("Supabase is nog niet geconfigureerd in dit project.")
      return
    }

    setIsSupabaseGrocerySyncing(true)
    setSupabaseGrocerySyncError("")

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()

      if (authError) throw authError
      if (!authData.user) {
        throw new Error("Log eerst in bij Supabase om overige boodschappen rechtstreeks op te halen.")
      }

      const nextGroceries = await fetchGroceriesFromHousehold(householdId)

      applyGroceriesToData(nextGroceries)
      updateSyncStatus({ groceriesLastPulledAt: getTimestamp() })
      setSupabaseGrocerySyncMessage(
        `${nextGroceries.length} overige boodschappen rechtstreeks uit Supabase geladen op ${new Date().toLocaleString("nl-NL")}.`
      )
    } catch (error) {
      setSupabaseGrocerySyncError(getSupabaseErrorMessage(error))
    } finally {
      setIsSupabaseGrocerySyncing(false)
    }
  }

  const refreshGroceriesFromSupabaseOnSourceChange = useEffectEvent(async () => {
    await refreshGroceriesFromSupabase()
  })

  useEffect(() => {
    if (syncSettings.grocerySource !== "supabase" || !syncSettings.groceryHouseholdId) {
      return
    }

    void refreshGroceriesFromSupabaseOnSourceChange()
  }, [syncSettings.groceryHouseholdId, syncSettings.grocerySource])

  function addRecipe() {

    const trimmed = newRecipe.trim()
  if (trimmed === "") return

  const recipe: Recipe = {
    id: crypto.randomUUID(),
    name: trimmed,
    servings: 4,
    ingredients: [],
    labels: [],
    notes: "",
    updatedAt: getTimestamp()
  }

  setData({
    ...data,
    recipes: [...data.recipes, recipe]
  })

  setNewRecipe("")

}

  function renameRecipe(id: string, newName: string) {
  const updated = recipes.map((recipe) =>
    recipe.id === id
      ? { ...recipe, name: newName, updatedAt: getTimestamp() }
      : recipe
  )

  setData({
    ...data,
    recipes: updated
  })
}


  function addIngredient(recipeId: string, ingredient: Ingredient) {

    const updated = recipes.map((recipe) =>
      recipe.id === recipeId
        ? {
            ...recipe,
            ingredients: [
              ...recipe.ingredients,
              {
                ...ingredient,
                id: crypto.randomUUID()
              }
            ],
            updatedAt: getTimestamp()
          }
        : recipe
    )

    setData({
  ...data,
  recipes: updated
})
  }

  function toggleIngredient(recipeId: string, ingredientId: string) {

  const updatedRecipes = data.recipes.map((r) => {

    if (r.id !== recipeId) return r

    return {
      ...r,
      ingredients: r.ingredients.map((ing) => {

        if (ing.id !== ingredientId) return ing

        return {
          ...ing,
          enabled: ing.enabled === false ? true : false
        }

      })
      ,
      updatedAt: getTimestamp()
    }

  })

  setData({
    ...data,
    recipes: updatedRecipes
  })

}

  function toggleRecipe(id: string) {

  const selected = data.selectedRecipes

  const updated = selected.includes(id)
    ? selected.filter(r => r !== id)
    : [...selected, id]

  setData({
    ...data,
    selectedRecipes: updated
  })

}

function clearSelectedRecipes() {

  setData({
    ...data,
    selectedRecipes: []
  })

  }

  function addLabel(recipeId: string, label: string) {

  const updated = [...recipes]

  const recipeIndex = updated.findIndex((recipe) => recipe.id === recipeId)

  if (recipeIndex < 0) return

  const currentLabels = updated[recipeIndex].labels ?? []

  if (!currentLabels.includes(label)) {
    updated[recipeIndex] = {
      ...updated[recipeIndex],
      labels: [...currentLabels, label],
      updatedAt: getTimestamp()
    }
  }

  setData({
    ...data,
    recipes: updated
  })

}

function deselectAllGroceries() {
  const updated = data.groceries.map((grocery) => ({
    ...grocery,
    enabled: false,
    updatedAt: getTimestamp()
  }))

  setData({
    ...data,
    groceries: updated
  })
}

  function addGrocery(grocery: Grocery) {

  setData({
    ...data,
    groceries: [
      ...data.groceries,
      {
        ...grocery,
        id: crypto.randomUUID(),
        updatedAt: getTimestamp()
      }
    ]
  })

}

  function toggleGrocery(index: number) {

  const updated = [...data.groceries]

  updated[index] = {
    ...updated[index],
    enabled: !updated[index].enabled,
    updatedAt: getTimestamp()
  }

  setData({
    ...data,
    groceries: updated
  })

}

  function toggleLabelFilter(label: string) {

  setActiveLabels((current) =>
    current.includes(label)
      ? current.filter((activeLabel) => activeLabel !== label)
      : [...current, label]
  )

  }

  function updateRecipeServings(id: string, servings: number) {

  setData({
    ...data,
    servingsOverride: {
      ...data.servingsOverride,
      [id]: servings
    }
  })

}

function removeLabel(recipeId: string, label: string) {
  const updated = [...recipes]

  const recipeIndex = updated.findIndex((recipe) => recipe.id === recipeId)

  if (recipeIndex < 0) return

  const currentLabels = updated[recipeIndex].labels ?? []

  updated[recipeIndex] = {
    ...updated[recipeIndex],
    labels: currentLabels.filter((currentLabel) => currentLabel !== label),
    updatedAt: getTimestamp()
  }

  setData({
    ...data,
    recipes: updated
  })
}



function updateRoute(newRoute: string[]) {

  const updated = [...supermarkets]

  if (resolvedActiveSupermarketIndex < 0) return

  updated[resolvedActiveSupermarketIndex] = {
    ...updated[resolvedActiveSupermarketIndex],
    route: newRoute,
    updatedAt: getTimestamp()
  }

  setData({
  ...data,
  supermarkets: updated
})

}

function setCategoryEnabled(category: string | undefined, enabled: boolean) {

  const updated = data.groceries.map((grocery) => {
    const groceryCategory = grocery.category?.trim() || undefined

    if (groceryCategory !== category) return grocery

    return {
      ...grocery,
      enabled,
      updatedAt: getTimestamp()
    }
  })

  setData({
    ...data,
    groceries: updated
  })

}

function renameCategory(currentCategory: string, nextCategory: string | undefined) {

  const updated = data.groceries.map((grocery) => {
    const groceryCategory = grocery.category?.trim()

    if (groceryCategory !== currentCategory) return grocery

    return {
      ...grocery,
      category: nextCategory,
      updatedAt: getTimestamp()
    }
  })

  setData({
    ...data,
    groceries: updated
  })

}

function removeCategoryItems(category: string | undefined) {

  const updated = data.groceries.filter((grocery) => {
    const groceryCategory = grocery.category?.trim() || undefined
    return groceryCategory !== category
  })

  setData({
    ...data,
    groceries: updated
  })

}

  const selectedRecipeObjects = recipes.filter(r =>
  selectedRecipes.includes(r.id)
)
  const allLabels: string[] = Array.from(
  new Set(
    recipes.flatMap(r => r.labels ?? [])
  )
)

const normalizedRecipeSearch = normalizeComparisonText(recipeSearch)
const filteredRecipes =
  activeLabels.length > 0
    ? recipes.filter((recipe) =>
        activeLabels.every((label) => recipe.labels?.includes(label) ?? false)
      )
    : recipes

const searchedRecipes = filteredRecipes.filter((recipe) => {
  if (normalizedRecipeSearch === "") return true

  const matchesName = normalizeComparisonText(recipe.name).includes(normalizedRecipeSearch)
  const matchesIngredients = recipe.ingredients.some((ingredient) =>
    normalizeComparisonText(ingredient.name).includes(normalizedRecipeSearch)
  )
  const matchesNotes = normalizeComparisonText(recipe.notes ?? "").includes(normalizedRecipeSearch)

  return matchesName || matchesIngredients || matchesNotes
}).sort((a, b) => a.name.localeCompare(b.name, "nl-NL"))

const selectedGroceries = groceries.filter((grocery) => grocery.enabled !== false)

const selectedGroceriesByCategory = Object.entries(
  selectedGroceries.reduce<Record<string, Grocery[]>>((groups, grocery) => {
    const key = grocery.category?.trim() || "Zonder categorie"

    if (!groups[key]) {
      groups[key] = []
    }

    groups[key].push(grocery)
    return groups
  }, {})
).sort(([a], [b]) => {
  if (a === "Zonder categorie") return 1
  if (b === "Zonder categorie") return -1
  return a.localeCompare(b)
}).map(([category, items]) => [
  category,
  [...items].sort((a, b) => a.name.localeCompare(b.name, "nl-NL"))
] as const)

function areGroceriesEquivalentForShoppingList(localGrocery: Grocery, sharedGrocery: Grocery) {
  return (
    normalizeComparisonText(localGrocery.name) === normalizeComparisonText(sharedGrocery.name) &&
    (localGrocery.amount ?? 1) === (sharedGrocery.amount ?? 1) &&
    (localGrocery.unit ?? "") === (sharedGrocery.unit ?? "") &&
    (localGrocery.shelf ?? "overig") === (sharedGrocery.shelf ?? "overig") &&
    (localGrocery.category?.trim() ?? "") === (sharedGrocery.category?.trim() ?? "") &&
    (localGrocery.enabled !== false) === (sharedGrocery.enabled !== false)
  )
}

function getScaledIngredientAmount(
  ingredient: Ingredient,
  recipeServings: number,
  targetServings: number
) {
  const safeBaseServings = recipeServings || 1
  const factor = targetServings / safeBaseServings
  const normalized = normalizeUnit(ingredient.amount * factor, ingredient.unit)

  return {
    amount: normalized.amount,
    unit: normalized.unit
  }
}

const sharedShoppingRecipes = sharedShoppingListData?.recipes ?? []
const sharedShoppingRecipeIds =
  sharedShoppingListData?.selectedRecipeIds ?? sharedShoppingRecipes.map((recipe) => recipe.id)
const shoppingListRecipesMap = new Map(sharedShoppingRecipes.map((recipe) => [recipe.id, recipe]))
const localSelectedRecipesById = new Map(selectedRecipeObjects.map((recipe) => [recipe.id, recipe]))
const sharedSelectedRecipesById = new Map((sharedShoppingListData?.recipes ?? []).map((recipe) => [recipe.id, recipe]))

for (const recipe of selectedRecipeObjects) {
  shoppingListRecipesMap.set(recipe.id, recipe)
}

const shoppingListRecipes = Array.from(shoppingListRecipesMap.values())
const shoppingListSelectedRecipeIds = Array.from(
  new Set([...sharedShoppingRecipeIds, ...selectedRecipes])
)
const shoppingListServingsOverride = {
  ...(sharedShoppingListData?.servingsOverride ?? {})
}

for (const recipeId of selectedRecipes) {
  const localRecipe = localSelectedRecipesById.get(recipeId)

  if (localRecipe) {
    shoppingListServingsOverride[recipeId] = servingsOverride[recipeId] ?? localRecipe.servings
  }
}

const shoppingListGroceriesMap = new Map(
  (sharedShoppingListData?.groceries ?? []).map((grocery) => [grocery.id, grocery])
)

for (const grocery of selectedGroceries) {
  shoppingListGroceriesMap.set(grocery.id, grocery)
}

const shoppingListGroceries = Array.from(shoppingListGroceriesMap.values())
const shoppingOverviewRecipes = Array.from(
  new Set([
    ...selectedRecipeObjects.map((recipe) => recipe.id),
    ...(sharedShoppingListData?.recipes ?? []).map((recipe) => recipe.id)
  ])
).map((recipeId) => {
  const localRecipe = localSelectedRecipesById.get(recipeId)
  const sharedRecipe = sharedSelectedRecipesById.get(recipeId)
  const recipe = localRecipe ?? sharedRecipe

  if (!recipe) return null

  const localServings = localRecipe ? servingsOverride[recipeId] ?? localRecipe.servings : null
  const sharedServings = sharedRecipe ? sharedShoppingListData?.servingsOverride[recipeId] ?? sharedRecipe.servings : null

  const localIngredientKeys = new Set(
    (localRecipe?.ingredients ?? [])
      .filter((ingredient) => ingredient.enabled !== false)
      .map((ingredient) => ingredient.id)
  )

  const sharedIngredientKeys = new Set(
    (sharedRecipe?.ingredients ?? [])
      .filter((ingredient) => ingredient.enabled !== false)
      .map((ingredient) => ingredient.id)
  )

  const sameIngredients =
    localIngredientKeys.size === sharedIngredientKeys.size &&
    [...localIngredientKeys].every((key) => sharedIngredientKeys.has(key))

  const status =
    localRecipe && sharedRecipe
      ? localServings === sharedServings && sameIngredients
        ? "gedeeld"
        : "lokaal anders dan gedeeld"
      : localRecipe
        ? "alleen lokaal"
        : "alleen gedeeld"

  const ingredientMap = new Map<string, {
    ingredient: Ingredient
    localIngredient?: Ingredient
    sharedIngredient?: Ingredient
  }>()

  for (const ingredient of localRecipe?.ingredients.filter((item) => item.enabled !== false) ?? []) {
    ingredientMap.set(ingredient.id, {
      ingredient,
      localIngredient: ingredient,
      sharedIngredient: ingredientMap.get(ingredient.id)?.sharedIngredient
    })
  }

  for (const ingredient of sharedRecipe?.ingredients.filter((item) => item.enabled !== false) ?? []) {
    const current = ingredientMap.get(ingredient.id)
    ingredientMap.set(ingredient.id, {
      ingredient: current?.ingredient ?? ingredient,
      localIngredient: current?.localIngredient,
      sharedIngredient: ingredient
    })
  }

  const ingredients = Array.from(ingredientMap.values()).map((entry) => ({
    ingredient: entry.ingredient,
    status:
      entry.localIngredient && entry.sharedIngredient
        ? "gedeeld"
        : entry.localIngredient
          ? "alleen lokaal"
          : "alleen gedeeld",
    localScaled:
      entry.localIngredient && localRecipe
        ? getScaledIngredientAmount(
            entry.localIngredient,
            localRecipe.servings,
            localServings ?? localRecipe.servings
          )
        : null,
    sharedScaled:
      entry.sharedIngredient && sharedRecipe
        ? getScaledIngredientAmount(
            entry.sharedIngredient,
            sharedRecipe.servings,
            sharedServings ?? sharedRecipe.servings
          )
        : null
  }))

  return {
    recipe,
    status,
    localRecipe,
    sharedRecipe,
    localServings,
    sharedServings,
    ingredients
  }
}).filter((item): item is NonNullable<typeof item> => item !== null)

const localSelectedGroceriesById = new Map(selectedGroceries.map((grocery) => [grocery.id, grocery]))
const sharedSelectedGroceriesById = new Map((sharedShoppingListData?.groceries ?? []).map((grocery) => [grocery.id, grocery]))
const shoppingOverviewGroceriesByCategory = Object.entries(
  Array.from(
    new Set([
      ...selectedGroceries.map((grocery) => grocery.id),
      ...(sharedShoppingListData?.groceries ?? []).map((grocery) => grocery.id)
    ])
  ).map((groceryId) => {
    const localGrocery = localSelectedGroceriesById.get(groceryId)
    const sharedGrocery = sharedSelectedGroceriesById.get(groceryId)
    const grocery = localGrocery ?? sharedGrocery

    if (!grocery) return null

    const category = grocery.category?.trim() || "Zonder categorie"

    return {
      category,
      grocery,
      localGrocery,
      sharedGrocery,
      status:
        localGrocery && sharedGrocery
          ? areGroceriesEquivalentForShoppingList(localGrocery, sharedGrocery)
            ? "gedeeld"
            : "lokaal anders dan gedeeld"
          : localGrocery
            ? "alleen lokaal"
            : "alleen gedeeld"
    }
  }).filter((item): item is NonNullable<typeof item> => item !== null)
    .reduce<Record<string, Array<{
      category: string
      grocery: Grocery
      localGrocery?: Grocery
      sharedGrocery?: Grocery
      status: string
    }>>>((groups, item) => {
      if (!groups[item.category]) {
        groups[item.category] = []
      }

      groups[item.category].push(item)
      return groups
    }, {})
).sort(([a], [b]) => {
  if (a === "Zonder categorie") return 1
  if (b === "Zonder categorie") return -1
  return a.localeCompare(b)
})

const pendingRecipeChanges = shoppingOverviewRecipes.filter(
  ({ status }) => status === "alleen lokaal" || status === "lokaal anders dan gedeeld"
)
const pendingGroceryChanges = shoppingOverviewGroceriesByCategory.flatMap(([, items]) =>
  items.filter(
    (item) => item.status === "alleen lokaal" || item.status === "lokaal anders dan gedeeld"
  )
)

function updateRecipeNotes(recipeId: string, notes: string) {

  const updated = [...recipes]

  const recipeIndex = updated.findIndex((recipe) => recipe.id === recipeId)

  if (recipeIndex < 0) return

  updated[recipeIndex] = {
    ...updated[recipeIndex],
    notes,
    updatedAt: getTimestamp()
  }

  setData({
  ...data,
  recipes: updated
})

}

function addSupermarket() {

  const newSupermarket = {
    id: crypto.randomUUID(),
    name: newSupermarketName,
    route: [...SHELVES],
    isFavorite: data.supermarkets.length === 0,
    updatedAt: getTimestamp()
  }

  const updated = [
    ...data.supermarkets,
    newSupermarket
  ]

  setData({
    ...data,
    supermarkets: updated
  })

  setActiveSupermarketId(newSupermarket.id)

}

function deleteRecipe(id: string) {
  const updatedRecipes = data.recipes.filter((recipe) => recipe.id !== id)

  const updatedServingsOverride = Object.fromEntries(
    Object.entries(data.servingsOverride).filter(([recipeId]) => recipeId !== id)
  )

  setData({
    ...data,
    recipes: updatedRecipes,
    selectedRecipes: data.selectedRecipes.filter((recipeId) => recipeId !== id),
    servingsOverride: updatedServingsOverride
  })

  if (selectedRecipeId === id) {
    setSelectedRecipeId(null)
  }
}


function removeIngredient(recipeId: string, ingredientId: string) {

  const updatedRecipes = data.recipes.map((r) => {

    if (r.id !== recipeId) return r

    return {
      ...r,
      ingredients: r.ingredients.filter((ingredient) => ingredient.id !== ingredientId),
      updatedAt: getTimestamp()
    }

  })



  setData({
    ...data,
    recipes: updatedRecipes
  })

}

function selectRecipeAndEnableIngredients(id: string) {

  setSelectedRecipeId(id)

  const updatedRecipes = data.recipes.map((r) => {

    if (r.id !== id) return r

    return {
      ...r,
      ingredients: r.ingredients.map(ing => ({
        ...ing,
        enabled: true
      }))
    }

  })

  setData({
    ...data,
    recipes: updatedRecipes
  })

}

function updateGrocery(index: number, updatedItem: Grocery) {

  const updated = [...data.groceries]

  updated[index] = {
    ...updatedItem,
    updatedAt: getTimestamp()
  }

  setData({
    ...data,
    groceries: updated
  })

}

function removeGrocery(index: number) {

  const updated = [...data.groceries]

  updated.splice(index, 1)

  setData({
    ...data,
    groceries: updated
  })

}

function removeSupermarket(index: number) {

  const updated = [...data.supermarkets]

  const removedSupermarket = updated[index]

  updated.splice(index, 1)

  setData({
    ...data,
    supermarkets: updated
  })

  if (removedSupermarket?.id === activeSupermarketId) {
    setActiveSupermarketId(updated[0]?.id ?? null)
  }

}

function renameSupermarket(index: number, name: string) {

  const updated = [...data.supermarkets]

  updated[index] = {
    ...updated[index],
    name,
    updatedAt: getTimestamp()
  }

  setData({
    ...data,
    supermarkets: updated
  })

}

function toggleFavoriteSupermarket(index: number) {

  const updated = data.supermarkets.map((supermarket, supermarketIndex) => ({
    ...supermarket,
    isFavorite: supermarketIndex === index,
    updatedAt: getTimestamp()
  }))

  setData({
    ...data,
    supermarkets: updated
  })

}

function startResize(startX: number) {

  const startWidth = leftWidth

  function onMouseMove(e: MouseEvent) {

    const newWidth = startWidth + (e.clientX - startX)
    setLeftWidth(Math.max(200, newWidth))

  }

  function onMouseUp() {
    window.removeEventListener("mousemove", onMouseMove)
    window.removeEventListener("mouseup", onMouseUp)
  }

  window.addEventListener("mousemove", onMouseMove)
  window.addEventListener("mouseup", onMouseUp)

}

function updateRecipeBaseServings(id: string, servings: number) {

  const updated = data.recipes.map(r => {

    if (r.id !== id) return r

    return {
      ...r,
      servings,
      updatedAt: getTimestamp()
    }

  })

  setData({
    ...data,
    recipes: updated
  })

}

function updateThemeSetting(key: keyof ThemeSettings, value: string) {

  setData({
    ...data,
    themeSettings: {
      ...themeSettings,
      [key]: value
    }
  })

}

function resetThemeSettings() {

  setData({
    ...data,
    themeSettings: DEFAULT_THEME_SETTINGS
  })

}

function applyThemePreset(settings: ThemeSettings) {

  setData({
    ...data,
    themeSettings: settings
  })

}

function applyImportedRecipes(nextRecipes: Recipe[]) {
  applyRecipesToData(nextRecipes)
}

async function syncSharedShoppingListFromApp() {
  const householdId = syncSettings.recipeHouseholdId ?? syncSettings.groceryHouseholdId

  if (!householdId) {
    setSharedShoppingListError("Koppel eerst een Supabase huishouden via recepten of overige boodschappen.")
    return
  }

  if (!supabase) {
    setSharedShoppingListError("Supabase is nog niet geconfigureerd in dit project.")
    return
  }

  setIsSharedShoppingListSyncing(true)
  setSharedShoppingListError("")

  try {
    const { data: authData, error: authError } = await supabase.auth.getUser()

    if (authError) throw authError
    if (!authData.user) {
      throw new Error("Log eerst in bij Supabase om de gedeelde boodschappenlijst bij te werken.")
    }

    const result = await syncActiveShoppingList({
      householdId,
      userId: authData.user.id,
      recipes,
      selectedRecipeIds: selectedRecipes,
      servingsOverride,
      groceries
    })

    const nextShoppingListData = await fetchActiveShoppingListData(householdId)

    setSharedShoppingListData(nextShoppingListData)
    setSharedShoppingListPreview(nextShoppingListData?.shoppingList ?? null)
    updateSyncStatus({ sharedShoppingListLastUpdatedAt: getTimestamp() })
    setSharedShoppingListMessage(
      `Gedeelde boodschappenlijst bijgewerkt: ${result.recipeCount} recepten en ${result.groceryCount} overige boodschappen.`
    )
  } catch (error) {
    setSharedShoppingListError(getSupabaseErrorMessage(error))
  } finally {
    setIsSharedShoppingListSyncing(false)
  }
}

async function fetchSharedShoppingListPreview() {
  const householdId = syncSettings.recipeHouseholdId ?? syncSettings.groceryHouseholdId

  if (!householdId) {
    setSharedShoppingListError("Koppel eerst een Supabase huishouden via recepten of overige boodschappen.")
    return
  }

  setIsSharedShoppingListSyncing(true)
  setSharedShoppingListError("")

  try {
    const nextShoppingListData = await fetchActiveShoppingListData(householdId)

    setSharedShoppingListData(nextShoppingListData)
    setSharedShoppingListPreview(nextShoppingListData?.shoppingList ?? null)
    updateSyncStatus({ sharedShoppingListLastFetchedAt: getTimestamp() })
    setSharedShoppingListMessage(
      nextShoppingListData
        ? "De actieve gedeelde boodschappenlijst is opgehaald."
        : "Er is nog geen actieve gedeelde boodschappenlijst gevonden."
    )
  } catch (error) {
    setSharedShoppingListError(getSupabaseErrorMessage(error))
  } finally {
    setIsSharedShoppingListSyncing(false)
  }
}

function clearLocalShoppingSelections() {
  setData((currentData) => ({
    ...currentData,
    selectedRecipes: [],
    servingsOverride: {},
    groceries: currentData.groceries.map((grocery) => ({
      ...grocery,
      enabled: false,
      updatedAt: getTimestamp()
    }))
  }))
}

async function clearSharedAndLocalShoppingList() {
  const listId = sharedShoppingListPreview?.id

  setIsSharedShoppingListSyncing(true)
  setSharedShoppingListError("")

  try {
    clearLocalShoppingSelections()

    if (listId) {
      await clearShoppingList(listId)
      await fetchSharedShoppingListPreview()
    } else {
      setSharedShoppingListData(null)
      setSharedShoppingListPreview(null)
    }

    setSharedShoppingListMessage("De lokale en gedeelde boodschappenlijst zijn leeggemaakt.")
  } catch (error) {
    setSharedShoppingListError(getSupabaseErrorMessage(error))
  } finally {
    setIsSharedShoppingListSyncing(false)
    setIsConfirmingClearAllLists(false)
  }
}

function removeRecipeLocallyFromShoppingList(recipeId: string) {
  setData((currentData) => ({
    ...currentData,
    selectedRecipes: currentData.selectedRecipes.filter((id) => id !== recipeId),
    servingsOverride: Object.fromEntries(
      Object.entries(currentData.servingsOverride).filter(([id]) => id !== recipeId)
    )
  }))
}

async function removeRecipeEverywhere(recipeId: string) {
  removeRecipeLocallyFromShoppingList(recipeId)

  setIsSharedShoppingListSyncing(true)
  setSharedShoppingListError("")

  try {
    if (sharedShoppingListPreview) {
      await removeRecipeFromShoppingList(sharedShoppingListPreview.id, recipeId)
      await fetchSharedShoppingListPreview()
    }

    setSharedShoppingListMessage("Het recept is verwijderd.")
  } catch (error) {
    setSharedShoppingListError(getSupabaseErrorMessage(error))
  } finally {
    setIsSharedShoppingListSyncing(false)
  }
}

function disableIngredientLocally(recipeId: string, ingredientId: string) {
  setData((currentData) => ({
    ...currentData,
    recipes: currentData.recipes.map((recipe) => {
      if (recipe.id !== recipeId) return recipe

      return {
        ...recipe,
        ingredients: recipe.ingredients.map((ingredient) =>
          ingredient.id !== ingredientId
            ? ingredient
            : { ...ingredient, enabled: false }
        ),
        updatedAt: getTimestamp()
      }
    })
  }))
}

async function removeIngredientEverywhere(recipeId: string, ingredientId: string) {
  disableIngredientLocally(recipeId, ingredientId)

  const recipeHouseholdId = syncSettings.recipeHouseholdId
  const recipeForSupabase =
    localSelectedRecipesById.get(recipeId) ??
    recipes.find((recipe) => recipe.id === recipeId) ??
    sharedSelectedRecipesById.get(recipeId)

  if (!recipeHouseholdId || !recipeForSupabase) {
    setSharedShoppingListMessage("Het ingrediënt is verwijderd.")
    return
  }

  const updatedRecipe: Recipe = {
    ...recipeForSupabase,
    ingredients: recipeForSupabase.ingredients.map((ingredient) =>
      ingredient.id !== ingredientId
        ? ingredient
        : { ...ingredient, enabled: false }
    ),
    updatedAt: getTimestamp()
  }

  setIsSharedShoppingListSyncing(true)
  setSharedShoppingListError("")

  try {
    await updateRecipeInHousehold(updatedRecipe, recipeHouseholdId)

    setSharedShoppingListData((current) =>
      current
        ? {
            ...current,
            recipes: current.recipes.map((recipe) =>
              recipe.id !== recipeId
                ? recipe
                : updatedRecipe
            )
          }
        : current
    )

    setSharedShoppingListMessage("Het ingrediënt is verwijderd.")
  } catch (error) {
    setSharedShoppingListError(getSupabaseErrorMessage(error))
  } finally {
    setIsSharedShoppingListSyncing(false)
  }
}

function removeGroceryLocallyFromShoppingList(groceryId: string) {
  setData((currentData) => ({
    ...currentData,
    groceries: currentData.groceries.map((grocery) =>
      grocery.id !== groceryId
        ? grocery
        : { ...grocery, enabled: false, updatedAt: getTimestamp() }
    )
  }))
}

async function removeGroceriesEverywhere(groceryIds: string[]) {
  groceryIds.forEach((groceryId) => removeGroceryLocallyFromShoppingList(groceryId))

  setIsSharedShoppingListSyncing(true)
  setSharedShoppingListError("")

  try {
    if (sharedShoppingListPreview && groceryIds.length > 0) {
      await removeGroceriesFromShoppingList(sharedShoppingListPreview.id, groceryIds)
      await fetchSharedShoppingListPreview()
    }

    setSharedShoppingListMessage(
      groceryIds.length === 1
        ? "De overige boodschap is verwijderd."
        : "De overige boodschappen zijn verwijderd."
    )
  } catch (error) {
    setSharedShoppingListError(getSupabaseErrorMessage(error))
  } finally {
    setIsSharedShoppingListSyncing(false)
  }
}

  return (

  <div
    className="app"
    style={{
      ["--app-bg" as string]: themeSettings.appBackground,
      ["--app-bg-accent" as string]: themeSettings.appBackgroundAccent,
      ["--panel-bg" as string]: themeSettings.panelBackground,
      ["--text-primary" as string]: themeSettings.textPrimary,
      ["--text-secondary" as string]: isNightThemeActive ? "#ffffff" : "#5e7374",
      ["--placeholder-text" as string]: isNightThemeActive ? "#ffffff" : "rgba(24, 56, 59, 0.42)",
      ["--input-bg" as string]: themeSettings.inputBackground,
      ["--input-text" as string]: themeSettings.inputText,
      ["--button-bg" as string]: themeSettings.accent,
      ["--accent" as string]: themeSettings.accent,
      ["--accent-strong" as string]: themeSettings.accentStrong,
      ["--button-bg-hover" as string]: themeSettings.accentStrong
    }}
  >

    {showStartupSplash && (
      <StartupSplash
        themeSettings={themeSettings}
        onFinish={() => setShowStartupSplash(false)}
      />
    )}

    {/* HEADER */}

    <div className="app-header">

      <div className="mosaic-title">

        {"BADSCHOPPEN".split("").map((l, i) => (
          <div key={i} className="mosaic-tile">{l}</div>
        ))}

      </div>

      <div className="weekly-planner-card">
        <div className="weekly-planner-grid">
          <div className="weekly-planner-column">
            {WEEKLY_PLANNER_DAYS.slice(0, 4).map((day) => (
              <div key={day.key} className="weekly-planner-row">
                <span className="weekly-planner-day">{day.label}</span>
                <input
                  value={weeklyPlanner[day.key]}
                  onChange={(event) => updateWeeklyPlanner(day.key, event.target.value)}
                  placeholder="Recept of notitie"
                />
              </div>
            ))}
          </div>

          <div className="weekly-planner-column">
            {WEEKLY_PLANNER_DAYS.slice(4).map((day) => (
              <div key={day.key} className="weekly-planner-row">
                <span className="weekly-planner-day">{day.label}</span>
                <input
                  value={weeklyPlanner[day.key]}
                  onChange={(event) => updateWeeklyPlanner(day.key, event.target.value)}
                  placeholder="Recept of notitie"
                />
              </div>
            ))}

            <div className="weekly-planner-actions">
              <button
                type="button"
                className="weekly-planner-clear"
                onClick={clearWeeklyPlanner}
              >
                Wis alles
              </button>
            </div>
          </div>
        </div>
      </div>

    </div>

    {/* TABS */}

    <div className="tabs">

      <button
        className={`tab-button ${activeTab === "recipes" ? "active" : ""}`}
        onClick={() => setActiveTab("recipes")}
      >
        Recepten
      </button>

      <button
        className={`tab-button ${activeTab === "groceries" ? "active" : ""}`}
        onClick={() => setActiveTab("groceries")}
      >
        Overige boodschappen
      </button>

      <button
        className={`tab-button ${activeTab === "shopping-list" ? "active" : ""}`}
        onClick={() => setActiveTab("shopping-list")}
      >
        Boodschappenlijst
      </button>

      <button
        className={`tab-button ${activeTab === "supermarkets" ? "active" : ""}`}
        onClick={() => setActiveTab("supermarkets")}
      >
        Supermarkten
      </button>

      <button
        className={`tab-button ${activeTab === "preferences" ? "active" : ""}`}
        onClick={() => setActiveTab("preferences")}
      >
        Voorkeuren
      </button>

      <button
        className={`tab-button ${activeTab === "import-export" ? "active" : ""}`}
        onClick={() => setActiveTab("import-export")}
      >
        Import/export
      </button>

    </div>

    {/* TAB 1: RECIPES */}

    {activeTab === "recipes" && (

      <div className="app-grid">

        {/* LEFT PANEL */}

        <div style={{ width: leftWidth }} className="panel panel-recipes">

          <h3>Recepten</h3>

          <div className="panel-content">

            <div style={{ marginBottom: 10 }}>

              {allLabels
              .filter((label): label is string => Boolean(label))
              .map(label => (

                <button
                  key={label}
                  onClick={() => toggleLabelFilter(label)}
                  style={{
                    marginRight: 6,
                    marginBottom: 6,
                    background: activeLabels.includes(label) ? "#1f7a8c" : "#eee",
                    color: activeLabels.includes(label) ? "white" : "black"
                  }}
                >
                  {label}
                </button>

          ))}

              {activeLabels.length > 0 && (
                <button
                  onClick={() => setActiveLabels([])}
                  style={{
                    marginBottom: 6,
                    background: "#ddd",
                    color: "black"
                  }}
                >
                  wis filters
                </button>
              )}

            </div>

            <div style={{ marginBottom: 10 }}>

              <input
                value={recipeSearch}
                onChange={(e) => setRecipeSearch(e.target.value)}
                placeholder="Zoek op recept, ingrediënt of notitie"
                className="recipe-search-input"
              />

            </div>

            <div style={{ marginBottom: 10 }}>

              <input
                value={newRecipe}
                onChange={(e) => setNewRecipe(e.target.value)}
                placeholder="Nieuw recept"
              />

              <button onClick={addRecipe} style={{ marginLeft: 6 }}>
                +
              </button>

            </div>

            {selectedRecipes.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <button onClick={clearSelectedRecipes}>
                  deselecteer alles
                </button>
              </div>
            )}

              <RecipeList
              recipes={searchedRecipes}
              selectedRecipes={selectedRecipes}
              toggleRecipe={toggleRecipe}
              onSelect={selectRecipeAndEnableIngredients}
              renameRecipe={renameRecipe}
              deleteRecipe={deleteRecipe}
              onLabelClick={toggleLabelFilter}
            />

          </div>

        </div>

        {/* RESIZE */}

        <div
          className="resize-handle"
          onMouseDown={(e) => {
            startResize(e.clientX)
          }}
        />

        {/* MIDDLE PANEL */}

        <div className="panel panel-ingredients" style={{ flex: 1 }}>

          <h3>
            {selectedRecipe ? `Ingrediënten voor ${selectedRecipe.name}` : "Ingrediënten"}
          </h3>

          <div className="panel-content">

            {selectedRecipe !== null && (

            <IngredientEditor
              recipe={selectedRecipe}
              allLabels={allLabels}
              addIngredient={addIngredient}
                toggleIngredient={toggleIngredient}
                removeIngredient={removeIngredient}
                addLabel={addLabel}
                removeLabel={removeLabel}
                servingsOverride={servingsOverride}
                updateRecipeServings={updateRecipeServings}
                updateRecipeBaseServings={updateRecipeBaseServings}
                updateRecipeNotes={updateRecipeNotes}
              />

            )}

          </div>

        </div>

      </div>

    )}

    {/* TAB 2: OTHER GROCERIES */}

    {activeTab === "groceries" && (

      <div className="app-grid">

        <div style={{ width: leftWidth }} className="panel panel-shopping">

          <h3>Geselecteerde overige boodschappen</h3>

          <div className="panel-content">
            <div className="overview-section">
              <p className="muted-text">
                Deze lijst laat zien welke overige boodschappen nu actief op je boodschappenlijst komen.
              </p>

              {selectedGroceriesByCategory.length === 0 && (
                <p className="muted-text">Er zijn nog geen overige boodschappen geselecteerd.</p>
              )}

              {selectedGroceriesByCategory.map(([categoryName, items]) => (
                <details key={categoryName} className="overview-group" open>
                  <summary className="overview-group-summary">
                    <span>{categoryName} ({items.length})</span>
                  </summary>

                  <ul className="overview-list">
                    {items.map((item) => (
                      <li key={item.id} className="overview-list-item">
                        <span>{item.name}</span>
                        <span className="import-recipe-meta">
                          {item.amount ?? 1} {item.unit ?? ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          </div>

        </div>

        <div
          className="resize-handle"
          onMouseDown={(e) => {
            startResize(e.clientX)
          }}
        />

        <div className="panel panel-groceries" style={{ flex: 1 }}>

          <h3>Bekende overige boodschappen</h3>

          <div className="panel-content">

            <CustomGroceries
              groceries={groceries}
              addGrocery={addGrocery}
              toggleGrocery={toggleGrocery}
              updateGrocery={updateGrocery}
              removeGrocery={removeGrocery}
              deselectAllGroceries={deselectAllGroceries}
              setCategoryEnabled={setCategoryEnabled}
              renameCategory={renameCategory}
              removeCategoryItems={removeCategoryItems}
            />

          </div>

        </div>

      </div>

    )}

    {/* TAB 3: SHOPPING LIST */}

    {activeTab === "shopping-list" && (

      <div className="app-grid">

        {/* LEFT PANEL */}

        <div style={{ width: leftWidth }} className="panel panel-groceries">

          <h3>Boodschappenlijst</h3>

          <div className="panel-content">

            <div className="overview-section">
              <p className="muted-text">
                {sharedShoppingListData
                  ? `Je bekijkt nu de gedeelde boodschappenlijst uit Supabase: ${sharedShoppingListData.shoppingList.name}.`
                  : "Je bekijkt nu de lokale boodschappenlijst op basis van de huidige selectie in deze app."}
              </p>
            </div>

            <ShoppingList
              recipes={shoppingListRecipes}
              groceries={shoppingListGroceries}
              servingsOverride={shoppingListServingsOverride}
              route={activeSupermarket?.route ?? []}
              supermarketName={activeSupermarket?.name ?? ""}
              selectedRecipes={shoppingListSelectedRecipeIds}
            />

          </div>

        </div>

        {/* RESIZE */}

        <div
          className="resize-handle"
          onMouseDown={(e) => {
            startResize(e.clientX)
          }}
        />

        {/* RIGHT PANEL */}

        <div className="panel panel-shopping" style={{ flex: 1 }}>

          <h3>Overzicht</h3>

          <div className="panel-content">

            <div className="overview-section">
              <h4>Gedeelde boodschappenlijst</h4>

              <div className="import-export-actions">
                <button
                  type="button"
                  onClick={() => {
                    void syncSharedShoppingListFromApp()
                  }}
                  disabled={isSharedShoppingListSyncing}
                >
                  {isSharedShoppingListSyncing ? "Bijwerken..." : "Werk gedeelde lijst bij"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void fetchSharedShoppingListPreview()
                  }}
                  disabled={isSharedShoppingListSyncing}
                >
                  {isSharedShoppingListSyncing ? "Ophalen..." : "Haal gedeelde lijst op"}
                </button>

                {!isConfirmingClearAllLists ? (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingClearAllLists(true)}
                  >
                    Maak lijsten leeg
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        void clearSharedAndLocalShoppingList()
                      }}
                      disabled={isSharedShoppingListSyncing}
                    >
                      Bevestig leegmaken
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsConfirmingClearAllLists(false)}
                      disabled={isSharedShoppingListSyncing}
                    >
                      Annuleer
                    </button>
                  </>
                )}
              </div>

              {sharedShoppingListMessage && (
                <p className="muted-text">{sharedShoppingListMessage}</p>
              )}

              {sharedShoppingListError && (
                <div className="import-feedback import-feedback-error">
                  {sharedShoppingListError}
                </div>
              )}

              {sharedShoppingListPreview && (
                <div className="import-feedback import-feedback-success">
                  <strong>{sharedShoppingListPreview.name}</strong>
                  <p className="muted-text">
                    Recepten: {sharedShoppingListPreview.recipes.length} | Overige boodschappen: {sharedShoppingListPreview.groceries.length}
                  </p>
                  <p className="muted-text">
                    Lokale aanvullingen en lokale wijzigingen worden hieronder direct meegenomen in het overzicht en in de boodschappenlijst, totdat je de gedeelde lijst opnieuw bijwerkt.
                  </p>
                </div>
              )}

              <div className="import-feedback">
                <p className="muted-text">
                  Laatst gedeelde lijst opgehaald: {formatSyncTimestamp(syncStatus.sharedShoppingListLastFetchedAt)}
                </p>
                <p className="muted-text">
                  Laatst gedeelde lijst bijgewerkt: {formatSyncTimestamp(syncStatus.sharedShoppingListLastUpdatedAt)}
                </p>
              </div>

              <div className="overview-legend">
                <span className="overview-legend-item">
                  <span className="overview-dot overview-dot-local" />
                  alleen in lokale lijst
                </span>
                <span className="overview-legend-item">
                  <span className="overview-dot overview-dot-shared" />
                  alleen in gedeelde lijst
                </span>
              </div>
            </div>

            <div className="overview-section">
              <h4>Recepten op de lijst</h4>

              {shoppingOverviewRecipes.length === 0 && (
                <p className="muted-text">Er staan nog geen recepten in de lokale of gedeelde lijst.</p>
              )}

              {shoppingOverviewRecipes.map(({ recipe, status, localRecipe, sharedRecipe, localServings, sharedServings, ingredients }) => (
                <details key={recipe.id} className="overview-group">
                  <summary className="overview-group-summary">
                    <span className="overview-title-with-status">
                      <span>{recipe.name}</span>
                      {status === "alleen lokaal" && (
                        <span className="overview-dot overview-dot-local" />
                      )}
                      {status === "alleen gedeeld" && (
                        <span className="overview-dot overview-dot-shared" />
                      )}
                    </span>
                  </summary>

                  <div className="overview-group-content">
                    <div className="overview-list-item">
                      <span>Lokaal</span>
                      <span className="import-recipe-meta">
                        {localRecipe ? `${localServings ?? localRecipe.servings} personen` : "niet geselecteerd"}
                      </span>
                    </div>

                    <div className="overview-list-item">
                      <span>Gedeeld</span>
                      <span className="import-recipe-meta">
                        {sharedRecipe ? `${sharedServings ?? sharedRecipe.servings} personen` : "niet verwerkt"}
                      </span>
                    </div>

                    <div className="import-export-actions">
                      <button
                        type="button"
                        onClick={() => {
                          void removeRecipeEverywhere(recipe.id)
                        }}
                        disabled={isSharedShoppingListSyncing}
                      >
                        Verwijder
                      </button>
                    </div>

                    <div className="overview-section">
                      <h4>Ingrediënten</h4>
                      <ul className="overview-list">
                        {ingredients.map(({ ingredient, status: ingredientStatus, localScaled, sharedScaled }) => (
                          <li key={ingredient.id} className="overview-list-item">
                            <div>
                              <div>{ingredient.name}</div>
                              <div className="import-recipe-meta">
                                {localScaled && sharedScaled && (
                                  localScaled.amount !== sharedScaled.amount ||
                                  localScaled.unit !== sharedScaled.unit
                                ) ? (
                                  <>
                                    <span className="overview-amount-previous">
                                      {sharedScaled.amount} {sharedScaled.unit}
                                    </span>
                                    {" "}
                                    <span>
                                      {localScaled.amount} {localScaled.unit}
                                    </span>
                                  </>
                                ) : localScaled ? (
                                  <>
                                    {localScaled.amount} {localScaled.unit}
                                  </>
                                ) : sharedScaled ? (
                                  <>
                                    {sharedScaled.amount} {sharedScaled.unit}
                                  </>
                                ) : (
                                  <>
                                    {ingredient.amount} {ingredient.unit}
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="overview-inline-actions">
                              {ingredientStatus === "alleen lokaal" && (
                                <span className="overview-dot overview-dot-local" />
                              )}

                              {ingredientStatus === "alleen gedeeld" && (
                                <span className="overview-dot overview-dot-shared" />
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  void removeIngredientEverywhere(recipe.id, ingredient.id)
                                }}
                                disabled={isSharedShoppingListSyncing}
                              >
                                Verwijder
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </details>
              ))}
            </div>

            <div className="overview-section">
              <h4>Overige boodschappen per categorie</h4>

              {shoppingOverviewGroceriesByCategory.length === 0 && (
                <p className="muted-text">Er zijn nog geen overige boodschappen in de lokale of gedeelde lijst.</p>
              )}

              {shoppingOverviewGroceriesByCategory.map(([categoryName, items]) => (
                <details key={categoryName} className="overview-group">
                  <summary className="overview-group-summary">
                    <span className="overview-title-with-status">
                      <span>{categoryName} ({items.length})</span>
                      {items.every((item) => item.status === "alleen lokaal") && (
                        <span className="overview-dot overview-dot-local" />
                      )}
                      {items.every((item) => item.status === "alleen gedeeld") && (
                        <span className="overview-dot overview-dot-shared" />
                      )}
                    </span>
                  </summary>

                  <div className="overview-group-content">
                    <div className="import-export-actions">
                      <button
                        type="button"
                        onClick={() => {
                          void removeGroceriesEverywhere(items.map((item) => item.grocery.id))
                        }}
                        disabled={isSharedShoppingListSyncing}
                      >
                        Verwijder categorie
                      </button>
                    </div>

                    <ul className="overview-list">
                      {items.map((item) => (
                        <li key={item.grocery.id} className="overview-list-item">
                          <div>
                            <div>{item.grocery.name}</div>
                            <div className="import-recipe-meta">
                              {item.grocery.amount ?? 1} {item.grocery.unit ?? ""}
                            </div>
                          </div>

                          <div className="overview-inline-actions">
                            {item.status === "alleen lokaal" && (
                              <span className="overview-dot overview-dot-local" />
                            )}

                            {item.status === "alleen gedeeld" && (
                              <span className="overview-dot overview-dot-shared" />
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                void removeGroceriesEverywhere([item.grocery.id])
                              }}
                              disabled={isSharedShoppingListSyncing}
                            >
                              Verwijder
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </details>
              ))}
            </div>

            <div className="overview-section">
              <h4>Nog lokaal gewijzigd</h4>

              {pendingRecipeChanges.length === 0 && pendingGroceryChanges.length === 0 && (
                <p className="muted-text">
                  Er zijn nu geen lokale wijzigingen die nog naar de gedeelde lijst moeten worden bijgewerkt.
                </p>
              )}

              {pendingRecipeChanges.length > 0 && (
                <div className="overview-section">
                  <strong>Recepten ({pendingRecipeChanges.length})</strong>
                  <ul className="overview-list">
                    {pendingRecipeChanges.map(({ recipe, status, localServings, sharedServings }) => (
                      <li key={recipe.id} className="overview-list-item">
                        <div>
                          <div>{recipe.name}</div>
                          <div className="import-recipe-meta">
                            {status === "alleen lokaal"
                              ? `${localServings ?? recipe.servings} personen, nog niet gedeeld`
                              : `lokaal ${localServings ?? recipe.servings} personen, gedeeld ${sharedServings ?? recipe.servings} personen`}
                          </div>
                        </div>

                        <span className="import-recipe-badge changed">
                          {status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {pendingGroceryChanges.length > 0 && (
                <div className="overview-section">
                  <strong>Overige boodschappen ({pendingGroceryChanges.length})</strong>
                  <ul className="overview-list">
                    {pendingGroceryChanges.map(({ grocery, status, category }) => (
                      <li key={grocery.id} className="overview-list-item">
                        <div>
                          <div>{grocery.name}</div>
                          <div className="import-recipe-meta">
                            {category} | {grocery.amount ?? 1} {grocery.unit ?? ""}
                          </div>
                        </div>

                        <span className="import-recipe-badge changed">
                          {status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

    )}

    {/* TAB 4: SUPERMARKETS */}

    {activeTab === "supermarkets" && (

  <div className="app-grid">

    {/* LEFT: SUPERMARKETS LIST */}

    <div style={{ width: leftWidth }} className="panel panel-recipes">

      <h3>Supermarkten</h3>

      <div className="panel-content">

        {supermarkets.map((s, i) => (

          <div
            key={s.id}
            className={`supermarket-item ${resolvedActiveSupermarketId === s.id ? "active" : ""}`}
          >

            <div className="supermarket-main">
              <input
                value={s.name}
                onChange={(e) => renameSupermarket(i, e.target.value)}
              />

              <div className="supermarket-meta">
                {s.isFavorite && (
                  <span className="supermarket-badge favorite">favoriet</span>
                )}
              </div>
            </div>

            <button onClick={() => setActiveSupermarketId(s.id)}>
              {resolvedActiveSupermarketId === s.id ? "geselecteerd" : "selecteer"}
            </button>

            <button onClick={() => toggleFavoriteSupermarket(i)}>
              {s.isFavorite ? "favoriet" : "maak favoriet"}
            </button>

            <button onClick={() => removeSupermarket(i)}>
              🗑
            </button>

          </div>

        ))}

        <div style={{ marginTop: 10 }}>

          <input
            value={newSupermarketName}
            onChange={(e) => setNewSupermarketName(e.target.value)}
            placeholder="Nieuwe supermarkt"
          />

          <button onClick={addSupermarket} style={{ marginLeft: 6 }}>
            +
          </button>

        </div>

      </div>

    </div>

    {/* RESIZE */}

    <div
      className="resize-handle"
      onMouseDown={(e) => {
        startResize(e.clientX)
      }}
    />

    {/* RIGHT: ROUTE */}

    <div className="panel panel-route" style={{ flex: 1 }}>

      <h3>Route</h3>

      <div className="panel-content">

        <SupermarketEditor
          route={activeSupermarket?.route ?? []}
          updateRoute={updateRoute}
        />

      </div>

    </div>

  </div>

)}

    {activeTab === "preferences" && (

      <ThemePreferences
        themeSettings={themeSettings}
        themePresets={THEME_PRESETS.map((preset) => ({
          ...preset,
          settings: { ...preset.settings }
        }))}
        applyThemePreset={applyThemePreset}
        updateThemeSetting={updateThemeSetting}
        resetThemeSettings={resetThemeSettings}
      />

    )}

    {activeTab === "import-export" && (

      <ImportExportPanel
        recipes={recipes}
        groceries={groceries}
        onApplyImport={applyImportedRecipes}
        onApplyGroceries={applyGroceriesToData}
        syncStatus={syncStatus}
        onRecipePreviewPullSuccess={(householdId) => {
          setData((currentData) => ({
            ...currentData,
            syncSettings: {
              ...currentData.syncSettings,
              recipeSource: currentData.syncSettings?.recipeSource ?? "local",
              grocerySource: currentData.syncSettings?.grocerySource ?? "local",
              recipeHouseholdId: householdId
            }
          }))
          updateSyncStatus({ recipesLastPulledAt: getTimestamp() })
        }}
        onGroceryPreviewPullSuccess={(householdId) => {
          setData((currentData) => ({
            ...currentData,
            syncSettings: {
              ...currentData.syncSettings,
              recipeSource: currentData.syncSettings?.recipeSource ?? "local",
              grocerySource: currentData.syncSettings?.grocerySource ?? "local",
              groceryHouseholdId: householdId
            }
          }))
          updateSyncStatus({ groceriesLastPulledAt: getTimestamp() })
        }}
      />

    )}

  </div>

)

}


export default App
