import { useEffect, useRef, useState } from "react"
import type { User } from "@supabase/supabase-js"

import { exportRecipes } from "../utils/recipeExport"
import { areRecipesEquivalent, getRecipeDifferenceFlags } from "../utils/recipeDiff"
import { applyRecipeImport } from "../utils/recipeImportApply"
import { parseRecipeImportFile } from "../utils/recipeImport"
import {
  createHouseholdInvite,
  createHouseholdWithOwner,
  getMyHouseholds,
  joinHouseholdByInvite
} from "../utils/supabaseHouseholds"
import {
  deleteGroceryFromSupabase,
  fetchGroceriesFromHousehold,
  uploadGroceriesToHousehold
} from "../utils/supabaseGroceries"
import { getSupabaseErrorMessage } from "../utils/supabaseErrors"
import {
  deleteRecipeFromHousehold,
  fetchRecipesFromHousehold,
  uploadRecipesToHousehold
} from "../utils/supabaseRecipes"
import { isSupabaseConfigured, supabase } from "../utils/supabase"

import type {
  Grocery,
  Recipe,
  RecipeImportApplySummary,
  RecipeConflictResolution,
  RecipeExportFile,
  RecipeImportMode,
  SyncStatus
} from "../types"

type Props = {
  recipes: Recipe[]
  groceries: Grocery[]
  onApplyImport: (recipes: Recipe[]) => void
  onApplyGroceries: (groceries: Grocery[]) => void
  syncStatus: SyncStatus
  onRecipePreviewPullSuccess: (householdId: string) => void
  onGroceryPreviewPullSuccess: (householdId: string) => void
}

function ImportExportPanel({
  recipes,
  groceries,
  onApplyImport,
  onApplyGroceries,
  syncStatus,
  onRecipePreviewPullSuccess,
  onGroceryPreviewPullSuccess
}: Props) {
  type RecipeSupabaseChoice = "take-local" | "take-supabase" | "ignore" | "delete" | "take-over"
  type GrocerySupabaseChoice = "take-local" | "take-supabase" | "ignore" | "delete" | "take-over"
  type RecipeComparisonSource = "file" | "supabase" | null

  const [activeComparison, setActiveComparison] = useState<"none" | "recipes" | "groceries">("none")
  const [recipeComparisonSource, setRecipeComparisonSource] = useState<RecipeComparisonSource>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [lastExportMessage, setLastExportMessage] = useState("")
  const [importError, setImportError] = useState("")
  const [lastImportMessage, setLastImportMessage] = useState("")
  const [lastApplyMessage, setLastApplyMessage] = useState("")
  const [authEmail, setAuthEmail] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [authMessage, setAuthMessage] = useState("")
  const [authError, setAuthError] = useState("")
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false)
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [households, setHouseholds] = useState<Array<{ id: string; name: string; role: string }>>([])
  const [selectedHouseholdId, setSelectedHouseholdId] = useState("")
  const [newHouseholdName, setNewHouseholdName] = useState("")
  const [inviteCode, setInviteCode] = useState("")
  const [generatedInviteCode, setGeneratedInviteCode] = useState("")
  const [generatedInviteExpiresAt, setGeneratedInviteExpiresAt] = useState("")
  const [syncMessage, setSyncMessage] = useState("")
  const [syncError, setSyncError] = useState("")
  const [importFileName, setImportFileName] = useState("")
  const [importPreview, setImportPreview] = useState<RecipeExportFile | null>(null)
  const [supabaseGroceryPreview, setSupabaseGroceryPreview] = useState<Grocery[]>([])
  const [supabaseRecipeChoices, setSupabaseRecipeChoices] = useState<Record<string, RecipeSupabaseChoice>>({})
  const [supabaseGroceryChoices, setSupabaseGroceryChoices] = useState<Record<string, GrocerySupabaseChoice>>({})
  const [selectedImportMode, setSelectedImportMode] = useState<RecipeImportMode>("add-new-and-update-changed")
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, RecipeConflictResolution>>({})
  const [isImportConfirmed, setIsImportConfirmed] = useState(false)

  useEffect(() => {
    if (!supabase) return

    let ignore = false

    supabase.auth.getUser().then(({ data, error }) => {
      if (ignore || error) return
      setCurrentUser(data.user ?? null)
    })

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (ignore) return
      setCurrentUser(session?.user ?? null)
    })

    return () => {
      ignore = true
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!currentUser || !supabase) {
      setHouseholds([])
      setSelectedHouseholdId("")
      return
    }

    let ignore = false

    getMyHouseholds()
      .then((items) => {
        if (ignore) return
        setHouseholds(items)
        setSelectedHouseholdId((current) => current || items[0]?.id || "")
      })
      .catch((error) => {
        if (ignore) return
        setSyncError(
          error instanceof Error
            ? error.message
            : "Huishoudens konden niet worden opgehaald."
        )
      })

    return () => {
      ignore = true
    }
  }, [currentUser])

  function formatLabels(labels?: string[]) {
    return labels && labels.length > 0 ? labels.join(", ") : "geen labels"
  }

  function formatNotes(notes?: string) {
    return notes?.trim() ? notes : "geen notities"
  }

  function formatIngredientLine(recipe: Recipe) {
    return recipe.ingredients.map((ingredient) => (
      `${ingredient.name} - ${ingredient.amount} ${ingredient.unit} - ${ingredient.shelf}`
    ))
  }

  function formatGroceryLine(grocery: Grocery) {
    const amount = grocery.amount ?? 1
    const unit = grocery.unit ?? ""
    const shelf = grocery.shelf ?? "overig"
    const category = grocery.category?.trim() ? ` | ${grocery.category}` : ""

    return `${grocery.name} - ${amount} ${unit} - ${shelf}${category}`
  }

  function getResolutionLabel(resolution: RecipeConflictResolution) {
    switch (resolution) {
      case "keep-local":
        return "Lokaal recept bewaren"
      case "keep-import":
        return "Importrecept overnemen"
      case "keep-local-import-ingredients":
        return "Lokaal recept + geïmporteerde ingrediënten"
      case "keep-import-local-ingredients":
        return "Importrecept + lokale ingrediënten"
    }
  }

  function getSupabaseRecipeChoiceLabel(choice: RecipeSupabaseChoice) {
    switch (choice) {
      case "take-local":
        return "Kies lokaal"
      case "take-supabase":
        return "Kies Supabase"
      case "ignore":
        return "Negeer"
      case "delete":
        return "Verwijder"
      case "take-over":
        return "Neem over"
    }
  }

  function getSupabaseGroceryChoiceLabel(choice: GrocerySupabaseChoice) {
    switch (choice) {
      case "take-local":
        return "Kies lokaal"
      case "take-supabase":
        return "Kies Supabase"
      case "ignore":
        return "Negeer"
      case "delete":
        return "Verwijder"
      case "take-over":
        return "Neem over"
    }
  }

  function updateConflictResolution(recipeId: string, resolution: RecipeConflictResolution) {
    setConflictResolutions((current) => ({
      ...current,
      [recipeId]: resolution
    }))
  }

  function buildApplyMessage(summary: RecipeImportApplySummary) {
    return `Import afgerond: ${summary.addedCount} toegevoegd, ${summary.replacedCount} bijgewerkt of vervangen, ${summary.skippedCount} overgeslagen.`
  }

  async function reloadHouseholds() {
    const nextHouseholds = await getMyHouseholds()

    setHouseholds(nextHouseholds)
    setSelectedHouseholdId((current) => current || nextHouseholds[0]?.id || "")
    return nextHouseholds
  }

  function formatSyncTimestamp(value?: string) {
    if (!value) return "nog niet"

    return new Date(value).toLocaleString("nl-NL")
  }

  async function handleSignUp() {
    if (!supabase) return

    try {
      setAuthError("")
      setAuthMessage("")
      setIsAuthSubmitting(true)

      const { error } = await supabase.auth.signUp({
        email: authEmail,
        password: authPassword
      })

      if (error) throw error

      setAuthMessage("Account aangemaakt. Mogelijk moet je je e-mail nog bevestigen in Supabase.")
    } catch (error) {
      setAuthError(getSupabaseErrorMessage(error))
    } finally {
      setIsAuthSubmitting(false)
    }
  }

  async function handleSignIn() {
    if (!supabase) return

    try {
      setAuthError("")
      setAuthMessage("")
      setIsAuthSubmitting(true)

      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword
      })

      if (error) throw error

      setAuthMessage("Je bent ingelogd bij Supabase.")
    } catch (error) {
      setAuthError(getSupabaseErrorMessage(error))
    } finally {
      setIsAuthSubmitting(false)
    }
  }

  async function handleSignOut() {
    if (!supabase) return

    await supabase.auth.signOut()
    setAuthMessage("Je bent uitgelogd.")
    setAuthError("")
  }

  async function handleCreateHousehold() {
    try {
      setSyncError("")
      setSyncMessage("")

      const householdId = await createHouseholdWithOwner(newHouseholdName.trim())
      const nextHouseholds = await reloadHouseholds()

      setHouseholds(nextHouseholds)
      setSelectedHouseholdId(householdId)
      setNewHouseholdName("")
      setSyncMessage("Huishouden aangemaakt.")
    } catch (error) {
      setSyncError(`${getSupabaseErrorMessage(error)} Voer zo nodig ook household-bootstrap.sql uit in Supabase.`)
    }
  }

  async function handleCreateInvite() {
    if (!selectedHouseholdId) return

    try {
      setSyncError("")
      setSyncMessage("")

      const invite = await createHouseholdInvite(selectedHouseholdId)

      setGeneratedInviteCode(invite.inviteCode)
      setGeneratedInviteExpiresAt(invite.expiresAt)
      setSyncMessage("Uitnodigingscode aangemaakt.")
    } catch (error) {
      setSyncError(getSupabaseErrorMessage(error))
    }
  }

  async function handleJoinHousehold() {
    if (inviteCode.trim() === "") return

    try {
      setSyncError("")
      setSyncMessage("")

      const joinedHouseholdId = await joinHouseholdByInvite(inviteCode)
      const nextHouseholds = await reloadHouseholds()

      setHouseholds(nextHouseholds)
      setSelectedHouseholdId(joinedHouseholdId)
      setInviteCode("")
      setSyncMessage("Je bent toegevoegd aan het huishouden.")
    } catch (error) {
      setSyncError(getSupabaseErrorMessage(error))
    }
  }

  async function handleCopyInviteCode() {
    if (!generatedInviteCode) return

    await navigator.clipboard.writeText(generatedInviteCode)
    setSyncMessage("Uitnodigingscode gekopieerd.")
  }

  async function handleFetchRecipes() {
    if (!selectedHouseholdId) return

    try {
      setSyncError("")
      setSyncMessage("")

      await refreshRecipeComparisonPreview(selectedHouseholdId)
      setActiveComparison("recipes")
      setRecipeComparisonSource("supabase")
    } catch (error) {
      setSyncError(getSupabaseErrorMessage(error))
    }
  }

  async function handleFetchGroceries() {
    if (!selectedHouseholdId) return

    try {
      setSyncError("")
      setSyncMessage("")

      await refreshGroceryComparisonPreview(selectedHouseholdId)
      setActiveComparison("groceries")
    } catch (error) {
      setSyncError(getSupabaseErrorMessage(error))
    }
  }

  async function refreshRecipeComparisonPreview(householdId: string) {
    const exportFile = await fetchRecipesFromHousehold(householdId)

    onRecipePreviewPullSuccess(householdId)
    setImportPreview(exportFile)
    setImportFileName("Supabase huishouden")
    setConflictResolutions({})
    setSupabaseRecipeChoices({})
    setIsImportConfirmed(false)
    setImportError("")
    setLastApplyMessage("")
    setLastImportMessage(
      `${exportFile.recipes.length} recepten uit Supabase geladen voor vergelijking. Je lokale recepten zijn nog niet aangepast.`
    )
  }

  async function refreshGroceryComparisonPreview(householdId: string) {
    const items = await fetchGroceriesFromHousehold(householdId)

    onGroceryPreviewPullSuccess(householdId)
    setSupabaseGroceryPreview(items)
    setSupabaseGroceryChoices({})
    setSyncMessage(`${items.length} overige boodschappen uit Supabase geladen voor vergelijking.`)
  }

  function handleExportRecipes() {
    if (recipes.length === 0) {
      setLastExportMessage("Er zijn nog geen recepten om te exporteren.")
      return
    }

    const exportFile = exportRecipes(recipes)

    setLastExportMessage(
      `${recipes.length} recepten geëxporteerd op ${new Date(exportFile.exportedAt).toLocaleString("nl-NL")}.`
    )
  }

  function openImportPicker() {
    fileInputRef.current?.click()
  }

  async function handleImportFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) return

    try {
      const text = await file.text()
      const parsedFile = parseRecipeImportFile(text)

      setImportPreview(parsedFile)
      setRecipeComparisonSource("file")
      setImportFileName(file.name)
      setConflictResolutions({})
      setSupabaseRecipeChoices({})
      setIsImportConfirmed(false)
      setImportError("")
      setLastApplyMessage("")
      setLastImportMessage(
        `${parsedFile.recipes.length} recepten ingelezen uit ${file.name}. De lokale recepten zijn nog niet aangepast.`
      )
      setActiveComparison("recipes")
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Het importbestand kon niet worden gelezen."

      setImportPreview(null)
      setRecipeComparisonSource(null)
      setImportFileName(file.name)
      setLastImportMessage("")
      setLastApplyMessage("")
      setIsImportConfirmed(false)
      setImportError(message)
    } finally {
      event.target.value = ""
    }
  }

  const localRecipesById = new Map(recipes.map((recipe) => [recipe.id, recipe]))
  const localGroceriesById = new Map(groceries.map((grocery) => [grocery.id, grocery]))
  const importedRecipes = [...(importPreview?.recipes ?? [])].sort((a, b) => a.name.localeCompare(b.name))
  const importedRecipeIds = new Set(importedRecipes.map((recipe) => recipe.id))
  const comparedRecipes = importedRecipes.map((importedRecipe) => {
    const localRecipe = localRecipesById.get(importedRecipe.id)

    return {
      importedRecipe,
      localRecipe,
      status: localRecipe
        ? areRecipesEquivalent(localRecipe, importedRecipe)
          ? "gelijk"
          : "afwijkend"
        : "nieuw"
    }
  })
  const comparedRecipesByStatus = [
    {
      status: "afwijkend" as const,
      title: "Afwijkend van lokaal",
      items: comparedRecipes.filter((item) => item.status === "afwijkend"),
      defaultOpen: false
    },
    {
      status: "nieuw" as const,
      title: recipeComparisonSource === "supabase" ? "Nieuw" : "Nieuw in importbestand",
      items: comparedRecipes.filter((item) => item.status === "nieuw"),
      defaultOpen: false
    },
    {
      status: "gelijk" as const,
      title: "Gelijk",
      items: comparedRecipes.filter((item) => item.status === "gelijk"),
      defaultOpen: false
    }
  ].filter((group) => group.items.length > 0)

  const recipeComparisonEntries = Array.from(
    new Set([...recipes.map((recipe) => recipe.id), ...importedRecipes.map((recipe) => recipe.id)])
  )
    .map((recipeId) => {
      const localRecipe = localRecipesById.get(recipeId)
      const supabaseRecipe = importedRecipes.find((recipe) => recipe.id === recipeId)

      if (!localRecipe && !supabaseRecipe) {
        return null
      }

      const status =
        localRecipe && supabaseRecipe
          ? areRecipesEquivalent(localRecipe, supabaseRecipe)
            ? "gelijk"
            : "afwijkend"
          : "nieuw"

      return {
        key: recipeId,
        localRecipe,
        supabaseRecipe,
        status,
        sortName: (localRecipe?.name ?? supabaseRecipe?.name ?? "").toLocaleLowerCase("nl-NL")
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => a.sortName.localeCompare(b.sortName, "nl-NL"))

  const supabaseRecipeGroups = [
    {
      status: "afwijkend" as const,
      title: "Afwijkend",
      items: recipeComparisonEntries.filter((entry) => entry.status === "afwijkend")
    },
    {
      status: "gelijk" as const,
      title: "Gelijk",
      items: recipeComparisonEntries.filter((entry) => entry.status === "gelijk")
    },
    {
      status: "nieuw" as const,
      title: "Nieuw",
      items: recipeComparisonEntries.filter((entry) => entry.status === "nieuw")
    }
  ].filter((group) => group.items.length > 0)

  const groceryComparisonEntries = Array.from(
    new Set([...groceries.map((grocery) => grocery.id), ...supabaseGroceryPreview.map((grocery) => grocery.id)])
  )
    .map((groceryId) => {
      const localGrocery = localGroceriesById.get(groceryId)
      const supabaseGrocery = supabaseGroceryPreview.find((grocery) => grocery.id === groceryId)

      if (!localGrocery && !supabaseGrocery) {
        return null
      }

      const isIdentical =
        localGrocery !== undefined &&
        supabaseGrocery !== undefined &&
        localGrocery.name === supabaseGrocery.name &&
        (localGrocery.amount ?? 1) === (supabaseGrocery.amount ?? 1) &&
        (localGrocery.unit ?? "") === (supabaseGrocery.unit ?? "") &&
        (localGrocery.shelf ?? "overig") === (supabaseGrocery.shelf ?? "overig") &&
        (localGrocery.category ?? "") === (supabaseGrocery.category ?? "")

      return {
        key: groceryId,
        localGrocery,
        supabaseGrocery,
        status:
          localGrocery && supabaseGrocery
            ? isIdentical
              ? "gelijk"
              : "afwijkend"
            : "nieuw",
        sortName: (localGrocery?.name ?? supabaseGrocery?.name ?? "").toLocaleLowerCase("nl-NL")
      }
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    .sort((a, b) => a.sortName.localeCompare(b.sortName, "nl-NL"))

  const supabaseGroceryGroups = [
    {
      status: "afwijkend" as const,
      title: "Afwijkend",
      items: groceryComparisonEntries.filter((entry) => entry.status === "afwijkend")
    },
    {
      status: "gelijk" as const,
      title: "Gelijk",
      items: groceryComparisonEntries.filter((entry) => entry.status === "gelijk")
    },
    {
      status: "nieuw" as const,
      title: "Nieuw",
      items: groceryComparisonEntries.filter((entry) => entry.status === "nieuw")
    }
  ].filter((group) => group.items.length > 0)

  const actionableRecipeEntries = recipeComparisonEntries.filter((entry) => entry.status !== "gelijk")
  const actionableGroceryEntries = groceryComparisonEntries.filter((entry) => entry.status !== "gelijk")
  const resolvedSupabaseRecipeCount = actionableRecipeEntries.filter(
    (entry) => supabaseRecipeChoices[entry.key]
  ).length
  const resolvedSupabaseGroceryCount = actionableGroceryEntries.filter(
    (entry) => supabaseGroceryChoices[entry.key]
  ).length
  const identicalImportCount = importedRecipes.filter((recipe) => {
    const localRecipe = localRecipesById.get(recipe.id)

    if (!localRecipe) return false

    return areRecipesEquivalent(localRecipe, recipe)
  }).length
  const matchingImportCount = importedRecipes.filter((recipe) => localRecipesById.has(recipe.id)).length
  const changedImportCount = matchingImportCount - identicalImportCount
  const newImportCount = importedRecipes.length - matchingImportCount
  const changedRecipes = importedRecipes
    .map((importedRecipe) => {
      const localRecipe = localRecipesById.get(importedRecipe.id)

      if (!localRecipe || areRecipesEquivalent(localRecipe, importedRecipe)) {
        return null
      }

      return {
        localRecipe,
        importedRecipe,
        differenceFlags: getRecipeDifferenceFlags(localRecipe, importedRecipe)
      }
    })
    .filter((recipe): recipe is NonNullable<typeof recipe> => recipe !== null)
  const shouldShowConflictResolver =
    importPreview !== null &&
    changedRecipes.length > 0 &&
    (selectedImportMode === "merge" || selectedImportMode === "add-new-and-update-changed")
  const resolvedConflictCount = changedRecipes.filter(
    ({ importedRecipe }) => conflictResolutions[importedRecipe.id]
  ).length
  const isApplyDisabled =
    importPreview === null ||
    !isImportConfirmed ||
    (shouldShowConflictResolver && resolvedConflictCount !== changedRecipes.length)

  function handleApplyImport() {
    if (!importPreview) return
    if (isApplyDisabled) return

    const result = applyRecipeImport({
      localRecipes: recipes,
      importedRecipes,
      mode: selectedImportMode,
      conflictResolutions
    })

    onApplyImport(result.recipes)
    setLastApplyMessage(buildApplyMessage(result.summary))
    setImportPreview(null)
    setRecipeComparisonSource(null)
    setImportFileName("")
    setConflictResolutions({})
    setIsImportConfirmed(false)
    setImportError("")
    setLastImportMessage("De gekozen import is toegepast op je receptenlijst.")
    setActiveComparison("none")
  }

  async function handleApplySupabaseRecipeChoices() {
    if (!selectedHouseholdId || actionableRecipeEntries.length === 0) return
    if (resolvedSupabaseRecipeCount !== actionableRecipeEntries.length) {
      setSyncError("Kies eerst per afwijkend of nieuw recept wat je wilt doen.")
      return
    }

    try {
      setSyncError("")
      setSyncMessage("")

      const nextLocalRecipes = new Map(recipes.map((recipe) => [recipe.id, recipe]))

      for (const entry of actionableRecipeEntries) {
        const choice = supabaseRecipeChoices[entry.key]

        if (!choice) continue

        if (entry.status === "afwijkend") {
          if (choice === "take-local" && entry.localRecipe) {
            await uploadRecipesToHousehold([entry.localRecipe], selectedHouseholdId)
          } else if (choice === "take-supabase" && entry.supabaseRecipe) {
            nextLocalRecipes.set(entry.supabaseRecipe.id, entry.supabaseRecipe)
          } else if (choice === "delete") {
            nextLocalRecipes.delete(entry.key)
            if (entry.supabaseRecipe) {
              await deleteRecipeFromHousehold(entry.supabaseRecipe.id)
            }
          }
        }

        if (entry.status === "nieuw") {
          if (choice === "take-over") {
            if (entry.localRecipe && !entry.supabaseRecipe) {
              await uploadRecipesToHousehold([entry.localRecipe], selectedHouseholdId)
            }

            if (entry.supabaseRecipe && !entry.localRecipe) {
              nextLocalRecipes.set(entry.supabaseRecipe.id, entry.supabaseRecipe)
            }
          } else if (choice === "delete") {
            if (entry.localRecipe && !entry.supabaseRecipe) {
              nextLocalRecipes.delete(entry.localRecipe.id)
            }

            if (entry.supabaseRecipe && !entry.localRecipe) {
              await deleteRecipeFromHousehold(entry.supabaseRecipe.id)
            }
          }
        }
      }

      onApplyImport(
        Array.from(nextLocalRecipes.values()).sort((a, b) => a.name.localeCompare(b.name, "nl-NL"))
      )
      await refreshRecipeComparisonPreview(selectedHouseholdId)
      setSyncMessage("De gekozen receptwijzigingen zijn verwerkt.")
    } catch (error) {
      setSyncError(getSupabaseErrorMessage(error))
    }
  }

  async function handleApplySupabaseGroceryChoices() {
    if (!selectedHouseholdId || actionableGroceryEntries.length === 0) return
    if (resolvedSupabaseGroceryCount !== actionableGroceryEntries.length) {
      setSyncError("Kies eerst per afwijkende of nieuwe overige boodschap wat je wilt doen.")
      return
    }

    try {
      setSyncError("")
      setSyncMessage("")

      const nextLocalGroceries = new Map(groceries.map((grocery) => [grocery.id, grocery]))

      for (const entry of actionableGroceryEntries) {
        const choice = supabaseGroceryChoices[entry.key]

        if (!choice) continue

        if (entry.status === "afwijkend") {
          if (choice === "take-local" && entry.localGrocery) {
            await uploadGroceriesToHousehold([entry.localGrocery], selectedHouseholdId)
          } else if (choice === "take-supabase" && entry.supabaseGrocery) {
            nextLocalGroceries.set(entry.supabaseGrocery.id, {
              ...entry.supabaseGrocery,
              enabled: false
            })
          } else if (choice === "delete") {
            nextLocalGroceries.delete(entry.key)
            if (entry.supabaseGrocery) {
              await deleteGroceryFromSupabase(entry.supabaseGrocery.id)
            }
          }
        }

        if (entry.status === "nieuw") {
          if (choice === "take-over") {
            if (entry.localGrocery && !entry.supabaseGrocery) {
              await uploadGroceriesToHousehold([entry.localGrocery], selectedHouseholdId)
            }

            if (entry.supabaseGrocery && !entry.localGrocery) {
              nextLocalGroceries.set(entry.supabaseGrocery.id, {
                ...entry.supabaseGrocery,
                enabled: false
              })
            }
          } else if (choice === "delete") {
            if (entry.localGrocery && !entry.supabaseGrocery) {
              nextLocalGroceries.delete(entry.localGrocery.id)
            }

            if (entry.supabaseGrocery && !entry.localGrocery) {
              await deleteGroceryFromSupabase(entry.supabaseGrocery.id)
            }
          }
        }
      }

      onApplyGroceries(
        Array.from(nextLocalGroceries.values()).sort((a, b) => a.name.localeCompare(b.name, "nl-NL"))
      )
      await refreshGroceryComparisonPreview(selectedHouseholdId)
      setSyncMessage("De gekozen wijzigingen voor overige boodschappen zijn verwerkt.")
    } catch (error) {
      setSyncError(getSupabaseErrorMessage(error))
    }
  }

  const importModeOptions: Array<{
    value: RecipeImportMode
    title: string
    description: string
    summary: string
  }> = [
    {
      value: "overwrite",
      title: "Overschrijven",
      description: "Vervangt de volledige lokale receptenlijst door het importbestand.",
      summary: `${importedRecipes.length} recepten worden dan de nieuwe basis.`
    },
    {
      value: "merge",
      title: "Samenvoegen",
      description: "Voegt nieuwe recepten toe en laat recepten met hetzelfde id straks apart controleren.",
      summary: `${newImportCount} nieuw, ${changedImportCount} te controleren, ${identicalImportCount} al gelijk.`
    },
    {
      value: "add-new-only",
      title: "Alleen nieuwe recepten toevoegen",
      description: "Negeert alles wat al een bestaand recept-id heeft.",
      summary: `${newImportCount} nieuwe recepten komen in aanmerking.`
    },
    {
      value: "add-new-and-update-changed",
      title: "Nieuwe toevoegen en veranderde bijwerken",
      description: "Nieuwe recepten worden toegevoegd en veranderde recepten gaan straks naar het conflictscherm.",
      summary: `${newImportCount} nieuw, ${changedImportCount} veranderd, ${identicalImportCount} al gelijk.`
    }
  ]

  const selectedModeSummary =
    importModeOptions.find((option) => option.value === selectedImportMode)?.summary ?? ""
  const confirmationSummary = (() => {
    switch (selectedImportMode) {
      case "overwrite":
        return `Je gaat ${importedRecipes.length} geïmporteerde recepten als volledige nieuwe receptenlijst opslaan.`
      case "merge":
        return `Je gaat ${newImportCount} nieuwe recepten toevoegen en ${resolvedConflictCount} gekozen conflicten verwerken.`
      case "add-new-only":
        return `Je gaat alleen ${newImportCount} nieuwe recepten toevoegen en bestaande ids overslaan.`
      case "add-new-and-update-changed":
        return `Je gaat ${newImportCount} nieuwe recepten toevoegen en ${resolvedConflictCount} veranderde recepten volgens jouw keuzes bijwerken.`
    }
  })()

  return (
    <div className="app-grid">
      <div className="panel panel-recipes import-export-primary-panel" style={{ width: 420 }}>
        <h3>Import / export</h3>

        <div className="panel-content">
          {isSupabaseConfigured && (
            <div className="import-mode-section">
              <h4>Supabase account</h4>

              {currentUser ? (
                <div className="import-feedback import-feedback-success import-account-card">
                  <strong>Ingelogd als</strong>
                  <p className="muted-text">{currentUser.email}</p>
                  <button type="button" onClick={handleSignOut}>
                    Uitloggen
                  </button>
                </div>
              ) : (
                <div className="preferences-grid">
                  <div className="preference-card">
                    <label className="theme-field">
                      <span>E-mailadres</span>
                      <input
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        type="email"
                        placeholder="naam@voorbeeld.nl"
                      />
                    </label>

                    <label className="theme-field">
                      <span>Wachtwoord</span>
                      <input
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        type="password"
                        placeholder="Minimaal 6 tekens"
                      />
                    </label>

                    <div className="import-export-actions">
                      <button
                        type="button"
                        onClick={handleSignIn}
                        disabled={isAuthSubmitting}
                      >
                        {isAuthSubmitting ? "Bezig met verbinden..." : "Inloggen"}
                      </button>

                      <button
                        type="button"
                        onClick={handleSignUp}
                        disabled={isAuthSubmitting}
                      >
                        {isAuthSubmitting ? "Account wordt aangemaakt..." : "Account maken"}
                      </button>
                    </div>

                    {isAuthSubmitting && (
                      <div className="import-auth-loading" aria-live="polite">
                        <span className="loading-dot" aria-hidden="true" />
                        <span>Verbinding met Supabase wordt gemaakt...</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {authMessage && (
                <div className="import-feedback import-feedback-success">
                  <p className="muted-text">{authMessage}</p>
                </div>
              )}

              {authError && (
                <div className="import-feedback import-feedback-error">
                  {authError}
                </div>
              )}
            </div>
          )}

          {isSupabaseConfigured && currentUser && (
            <div className="import-mode-section">
              <h4>Actief huishouden</h4>

              {households.length === 0 ? (
                <div className="preference-card">
                  <p className="muted-text">
                    Er is nog geen huishouden gevonden voor dit account. Maak eerst een huishouden aan.
                  </p>

                  <label className="theme-field">
                    <span>Naam huishouden</span>
                    <input
                      value={newHouseholdName}
                      onChange={(e) => setNewHouseholdName(e.target.value)}
                      placeholder="Bijv. Thuis"
                    />
                  </label>

                  <div className="import-export-actions">
                    <button
                      type="button"
                      onClick={handleCreateHousehold}
                      disabled={newHouseholdName.trim() === ""}
                    >
                      Huishouden aanmaken
                    </button>
                  </div>
                </div>
              ) : (
                <>
                <div className="preference-card import-household-card">
                  <label className="theme-field">
                    <span>Actief huishouden</span>
                    <select
                      value={selectedHouseholdId}
                      onChange={(e) => setSelectedHouseholdId(e.target.value)}
                    >
                      {households.map((household) => (
                        <option key={household.id} value={household.id}>
                          {household.name} ({household.role})
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="import-export-actions import-stack-gap">
                    <button
                      type="button"
                      onClick={handleFetchRecipes}
                      disabled={selectedHouseholdId === ""}
                    >
                      Controleer recepten in Supabase
                    </button>
                  </div>

                  <div className="import-export-actions import-stack-gap">
                    <button
                      type="button"
                      onClick={handleFetchGroceries}
                      disabled={selectedHouseholdId === ""}
                    >
                      Controleer overige boodschappen in Supabase
                    </button>
                  </div>

                  <div className="import-feedback">
                    <strong>Sync-status</strong>
                    <p className="muted-text">
                      Recepten laatst opgehaald: {formatSyncTimestamp(syncStatus.recipesLastPulledAt)}
                    </p>
                    <p className="muted-text">
                      Recepten laatst geupload: {formatSyncTimestamp(syncStatus.recipesLastPushedAt)}
                    </p>
                    <p className="muted-text">
                      Overige boodschappen laatst opgehaald: {formatSyncTimestamp(syncStatus.groceriesLastPulledAt)}
                    </p>
                    <p className="muted-text">
                      Overige boodschappen laatst geupload: {formatSyncTimestamp(syncStatus.groceriesLastPushedAt)}
                    </p>
                    <p className="muted-text">
                      Gedeelde lijst laatst opgehaald: {formatSyncTimestamp(syncStatus.sharedShoppingListLastFetchedAt)}
                    </p>
                    <p className="muted-text">
                      Gedeelde lijst laatst bijgewerkt: {formatSyncTimestamp(syncStatus.sharedShoppingListLastUpdatedAt)}
                    </p>
                  </div>

                </div>

                <div className="preference-card import-partner-card">
                  <strong>Partner uitnodigen</strong>
                  <p className="muted-text">
                    Maak een tijdelijke invite-code aan voor het gekozen huishouden. Je partner kan die code invoeren om aan hetzelfde huishouden te worden toegevoegd.
                  </p>

                  <div className="import-export-actions import-stack-gap">
                    <button
                      type="button"
                      onClick={handleCreateInvite}
                      disabled={selectedHouseholdId === ""}
                    >
                      Maak uitnodigingscode
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void handleCopyInviteCode()
                      }}
                      disabled={generatedInviteCode === ""}
                    >
                      Kopieer code
                    </button>
                  </div>

                  {generatedInviteCode && (
                    <div className="import-feedback import-feedback-success">
                      <strong>{generatedInviteCode}</strong>
                      <p className="muted-text">
                        Geldig tot {new Date(generatedInviteExpiresAt).toLocaleString("nl-NL")}
                      </p>
                    </div>
                  )}

                  <label className="theme-field import-invite-field">
                    <span>Ontvangen invite-code</span>
                    <input
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                      placeholder="Bijv. A1B2C3D4"
                    />
                  </label>

                  <div className="import-export-actions import-stack-gap">
                    <button
                      type="button"
                      onClick={() => {
                        void handleJoinHousehold()
                      }}
                      disabled={inviteCode.trim() === ""}
                    >
                      Word lid van huishouden
                    </button>
                  </div>
                </div>
                </>
              )}

              {syncMessage && (
                <div className="import-feedback import-feedback-success">
                  <p className="muted-text">{syncMessage}</p>
                </div>
              )}

              {syncError && (
                <div className="import-feedback import-feedback-error">
                  {syncError}
                </div>
              )}

            </div>
          )}

          <div className="import-mode-section">
            <h4>Importeren en exporteren</h4>

            <div className="preferences-grid">
              <div className="preference-card">
                <strong>Exporteren</strong>
                <p className="muted-text">
                  Recepten opslaan naar een bestand dat op een andere Mac kan worden
                  ingelezen.
                </p>
              </div>

              <div className="preference-card">
                <strong>Importeren</strong>
                <p className="muted-text">
                  Een import wordt eerst vergeleken, waarna verschillen per
                  recept overzichtelijk in twee kolommen zichtbaar worden.
                </p>
              </div>
            </div>

            <div className="import-export-actions">
              <button type="button" onClick={handleExportRecipes}>
                Exporteer recepten
              </button>

              <button type="button" onClick={openImportPicker}>
                Importeer recepten
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="visually-hidden"
              onChange={handleImportFileChange}
            />

            {lastExportMessage && (
              <p className="muted-text import-export-status">{lastExportMessage}</p>
            )}

            {lastImportMessage && (
              <p className="muted-text import-export-status">{lastImportMessage}</p>
            )}

            {lastApplyMessage && (
              <p className="muted-text import-export-status">{lastApplyMessage}</p>
            )}

            {importError && (
              <div className="import-feedback import-feedback-error">
                {importError}
              </div>
            )}

            {importPreview && (
              <div className="import-feedback import-feedback-success">
                <strong>Importbestand klaar voor vergelijking</strong>
                <p className="muted-text">
                  Bestand: {importFileName}
                </p>
                <p className="muted-text">
                  Exportdatum: {new Date(importPreview.exportedAt).toLocaleString("nl-NL")}
                </p>
                <p className="muted-text">
                  Nieuwe recepten: {newImportCount} | Recepten met bestaand id: {matchingImportCount}
                </p>
              </div>
            )}
          </div>

          {recipeComparisonSource === "file" && (
          <div className="import-mode-section">
            <h4>Importmodus</h4>

            <div className="import-mode-list">
              {importModeOptions.map((option) => (
                <label
                  key={option.value}
                  className={`import-mode-card ${selectedImportMode === option.value ? "selected" : ""} ${importPreview ? "" : "disabled"}`}
                >
                  <input
                    type="radio"
                    name="import-mode"
                    value={option.value}
                    checked={selectedImportMode === option.value}
                    onChange={() => setSelectedImportMode(option.value)}
                    disabled={!importPreview}
                  />

                  <div className="import-mode-copy">
                    <strong>{option.title}</strong>
                    <p className="muted-text">{option.description}</p>
                    <p className="import-mode-summary">{option.summary}</p>
                  </div>
                </label>
              ))}
            </div>

            <p className="muted-text import-export-status">
              {importPreview
                ? `Gekozen modus: ${selectedModeSummary}`
                : "Kies eerst een importbestand om een importmodus te activeren."}
            </p>

            {importPreview && (
              <div className="import-confirmation-card">
                <strong>Definitieve bevestiging</strong>
                <p className="muted-text">
                  {confirmationSummary}
                </p>
                <label className="import-confirmation-check">
                  <input
                    type="checkbox"
                    checked={isImportConfirmed}
                    onChange={(event) => setIsImportConfirmed(event.target.checked)}
                  />
                  <span>Ik heb gecontroleerd dat deze importinstellingen kloppen.</span>
                </label>
              </div>
            )}

            <div className="import-apply-actions">
              <button
                type="button"
                onClick={handleApplyImport}
                disabled={isApplyDisabled}
              >
                Pas import toe
              </button>

              {shouldShowConflictResolver && resolvedConflictCount !== changedRecipes.length && (
                <span className="import-apply-hint">
                  Kies eerst voor elk conflictrecept wat bewaard moet blijven.
                </span>
              )}

              {importPreview && !isImportConfirmed && (
                <span className="import-apply-hint">
                  Bevestig eerst de samenvatting hierboven.
                </span>
              )}
            </div>
          </div>
          )}
        </div>
      </div>

      <div className="panel panel-route" style={{ flex: 1 }}>
        <h3>Vergelijkingsscherm</h3>

        <div className="panel-content">
          {activeComparison === "none" && (
            <div className="import-feedback">
              <p className="muted-text">
                Kies `Controleer recepten in Supabase`, `Controleer overige boodschappen in Supabase` of `Importeer recepten` om hier een vergelijking te tonen.
              </p>
            </div>
          )}

          {activeComparison === "recipes" && (
          <div className="import-conflicts">
            <div className="import-conflicts-header">
              <div>
                <h4>Vergelijking recepten</h4>
                <p className="muted-text">
                  {recipeComparisonSource === "supabase"
                    ? "Vergelijk per recept wat lokaal staat en wat er in Supabase staat. Kies daarna per verschil wat er moet gebeuren."
                    : "Dit overzicht laat je eerst zien wat lokaal staat en wat er in Supabase of het importbestand staat, zonder al iets over te nemen."}
                </p>
              </div>

              <span className="import-conflicts-count">
                lokaal {recipes.length} | {recipeComparisonSource === "supabase" ? "Supabase" : "import"} {importedRecipes.length}
              </span>
            </div>

            {recipeComparisonSource === "supabase" ? (
              <>
                {recipeComparisonEntries.length === 0 ? (
                  <div className="import-feedback">
                    <p className="muted-text">
                      Er zijn nog geen recepten gevonden om te vergelijken.
                    </p>
                  </div>
                ) : (
                  <>
                    {supabaseRecipeGroups.map((group) => (
                      <details
                        key={group.status}
                        className="import-grocery-group"
                        open={false}
                      >
                        <summary className="import-grocery-group-summary">
                          <span>{group.title} ({group.items.length})</span>
                          <span className="import-conflicts-count">{group.items.length}</span>
                        </summary>

                        <div className="import-grocery-group-content">
                          {group.items.map((entry) => (
                            <div key={entry.key} className="import-conflict-card">
                              <div className="import-conflict-heading">
                                <div>
                                  <h5>{entry.localRecipe?.name ?? entry.supabaseRecipe?.name ?? "Onbekend recept"}</h5>
                                  <p className="muted-text">Recept-id: {entry.key}</p>
                                </div>

                                <span className="import-selected-resolution">
                                  {entry.status === "gelijk"
                                    ? "Gelijk"
                                    : supabaseRecipeChoices[entry.key]
                                      ? getSupabaseRecipeChoiceLabel(supabaseRecipeChoices[entry.key])
                                      : "Nog geen keuze gemaakt"}
                                </span>
                              </div>

                              <div className="import-compare-preview import-compare-preview-conflict">
                                <div className="import-compare-column">
                                  <h4>Lokaal</h4>
                                  {entry.localRecipe ? (
                                    <>
                                      <div className={`import-detail-block ${entry.status === "gelijk" ? "" : "changed"}`}>
                                        <strong>Naam</strong>
                                        <p>{entry.localRecipe.name}</p>
                                      </div>
                                      <div className={`import-detail-block ${entry.status === "gelijk" ? "" : "changed"}`}>
                                        <strong>Recept aantal personen</strong>
                                        <p>{entry.localRecipe.servings}</p>
                                      </div>
                                      <div className={`import-detail-block ${entry.status === "gelijk" ? "" : "changed"}`}>
                                        <strong>Ingrediënten ({entry.localRecipe.ingredients.length})</strong>
                                        <ul className="import-ingredient-list">
                                          {formatIngredientLine(entry.localRecipe).map((line, index) => (
                                            <li key={`${entry.key}-local-${index}`}>{line}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="import-detail-block changed">
                                      <strong>Gegevens</strong>
                                      <p>Dit recept bestaat lokaal nog niet.</p>
                                    </div>
                                  )}
                                </div>

                                <div className="import-compare-column">
                                  <h4>Supabase</h4>
                                  {entry.supabaseRecipe ? (
                                    <>
                                      <div className={`import-detail-block ${entry.status === "gelijk" ? "" : "changed"}`}>
                                        <strong>Naam</strong>
                                        <p>{entry.supabaseRecipe.name}</p>
                                      </div>
                                      <div className={`import-detail-block ${entry.status === "gelijk" ? "" : "changed"}`}>
                                        <strong>Recept aantal personen</strong>
                                        <p>{entry.supabaseRecipe.servings}</p>
                                      </div>
                                      <div className={`import-detail-block ${entry.status === "gelijk" ? "" : "changed"}`}>
                                        <strong>Ingrediënten ({entry.supabaseRecipe.ingredients.length})</strong>
                                        <ul className="import-ingredient-list">
                                          {formatIngredientLine(entry.supabaseRecipe).map((line, index) => (
                                            <li key={`${entry.key}-supabase-${index}`}>{line}</li>
                                          ))}
                                        </ul>
                                      </div>
                                    </>
                                  ) : (
                                    <div className="import-detail-block changed">
                                      <strong>Gegevens</strong>
                                      <p>Dit recept staat nog niet in Supabase.</p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {entry.status === "afwijkend" && (
                                <div className="import-resolution-grid">
                                  <button
                                    type="button"
                                    className={supabaseRecipeChoices[entry.key] === "take-local" ? "active-choice" : ""}
                                    onClick={() => setSupabaseRecipeChoices((current) => ({ ...current, [entry.key]: "take-local" }))}
                                  >
                                    Kies lokaal
                                  </button>
                                  <button
                                    type="button"
                                    className={supabaseRecipeChoices[entry.key] === "take-supabase" ? "active-choice" : ""}
                                    onClick={() => setSupabaseRecipeChoices((current) => ({ ...current, [entry.key]: "take-supabase" }))}
                                  >
                                    Kies Supabase
                                  </button>
                                  <button
                                    type="button"
                                    className={supabaseRecipeChoices[entry.key] === "ignore" ? "active-choice" : ""}
                                    onClick={() => setSupabaseRecipeChoices((current) => ({ ...current, [entry.key]: "ignore" }))}
                                  >
                                    Negeer
                                  </button>
                                  <button
                                    type="button"
                                    className={supabaseRecipeChoices[entry.key] === "delete" ? "active-choice" : ""}
                                    onClick={() => setSupabaseRecipeChoices((current) => ({ ...current, [entry.key]: "delete" }))}
                                  >
                                    Verwijder
                                  </button>
                                </div>
                              )}

                              {entry.status === "nieuw" && (
                                <div className="import-resolution-grid">
                                  <button
                                    type="button"
                                    className={supabaseRecipeChoices[entry.key] === "take-over" ? "active-choice" : ""}
                                    onClick={() => setSupabaseRecipeChoices((current) => ({ ...current, [entry.key]: "take-over" }))}
                                  >
                                    Neem over
                                  </button>
                                  <button
                                    type="button"
                                    className={supabaseRecipeChoices[entry.key] === "ignore" ? "active-choice" : ""}
                                    onClick={() => setSupabaseRecipeChoices((current) => ({ ...current, [entry.key]: "ignore" }))}
                                  >
                                    Negeer
                                  </button>
                                  <button
                                    type="button"
                                    className={supabaseRecipeChoices[entry.key] === "delete" ? "active-choice" : ""}
                                    onClick={() => setSupabaseRecipeChoices((current) => ({ ...current, [entry.key]: "delete" }))}
                                  >
                                    Verwijder
                                  </button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </details>
                    ))}

                    <div className="import-apply-actions">
                      <span className="import-apply-hint">
                        Keuzes gemaakt: {resolvedSupabaseRecipeCount} / {actionableRecipeEntries.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          void handleApplySupabaseRecipeChoices()
                        }}
                        disabled={actionableRecipeEntries.length > 0 && resolvedSupabaseRecipeCount !== actionableRecipeEntries.length}
                      >
                        Bevestigen
                      </button>
                    </div>
                  </>
                )}
              </>
            ) : importedRecipes.length === 0 && recipes.filter((recipe) => !importedRecipeIds.has(recipe.id)).length === 0 ? (
              <div className="import-feedback">
                <p className="muted-text">
                  Kies een importbestand of gebruik `Controleer recepten in Supabase` om recepten hier te vergelijken.
                </p>
              </div>
            ) : (
              <>
                {recipes.filter((recipe) => !importedRecipeIds.has(recipe.id)).length > 0 && (
                  <details className="import-grocery-group">
                    <summary className="import-grocery-group-summary">
                      <span>Alleen lokaal ({recipes.filter((recipe) => !importedRecipeIds.has(recipe.id)).length})</span>
                      <span className="import-conflicts-count">{recipes.filter((recipe) => !importedRecipeIds.has(recipe.id)).length}</span>
                    </summary>

                    <div className="import-grocery-group-content">
                      {recipes
                        .filter((recipe) => !importedRecipeIds.has(recipe.id))
                        .sort((a, b) => a.name.localeCompare(b.name, "nl-NL"))
                        .map((recipe) => (
                        <div key={recipe.id} className="import-conflict-card">
                          <div className="import-conflict-heading">
                            <div>
                              <h5>{recipe.name}</h5>
                              <p className="muted-text">Recept-id: {recipe.id}</p>
                            </div>

                            <span className="import-selected-resolution">
                              Alleen lokaal
                            </span>
                          </div>

                          <div className="import-compare-preview import-compare-preview-conflict">
                            <div className="import-compare-column">
                              <h4>Lokaal</h4>
                              <div className="import-detail-block changed">
                                <strong>Naam</strong>
                                <p>{recipe.name}</p>
                              </div>
                              <div className="import-detail-block changed">
                                <strong>Recept aantal personen</strong>
                                <p>{recipe.servings}</p>
                              </div>
                              <div className="import-detail-block changed">
                                <strong>Ingrediënten ({recipe.ingredients.length})</strong>
                                <ul className="import-ingredient-list">
                                  {formatIngredientLine(recipe).map((line, index) => (
                                    <li key={`${recipe.id}-local-only-${index}`}>{line}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            <div className="import-compare-column">
                              <h4>Supabase</h4>
                              <div className="import-detail-block changed">
                                <strong>Gegevens</strong>
                                <p>Dit recept staat nog niet in Supabase.</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                {comparedRecipesByStatus.map((group) => (
                  <details
                    key={group.status}
                    className="import-grocery-group"
                    open={group.defaultOpen}
                  >
                    <summary className="import-grocery-group-summary">
                      <span>{group.title} ({group.items.length})</span>
                      <span className="import-conflicts-count">{group.items.length}</span>
                    </summary>

                    <div className="import-grocery-group-content">
                      {group.items.map(({ importedRecipe, localRecipe, status }) => (
                        <div key={importedRecipe.id} className="import-conflict-card">
                          <div className="import-conflict-heading">
                            <div>
                              <h5>{importedRecipe.name}</h5>
                              <p className="muted-text">Recept-id: {importedRecipe.id}</p>
                            </div>

                            <span className="import-selected-resolution">
                              {status === "gelijk"
                                ? "Gelijk aan lokaal"
                                : status === "nieuw"
                                  ? "Nieuw in Supabase"
                                  : conflictResolutions[importedRecipe.id]
                                    ? getResolutionLabel(conflictResolutions[importedRecipe.id])
                                    : "Afwijkend van lokaal"}
                            </span>
                          </div>

                          <div className="import-compare-preview import-compare-preview-conflict">
                            <div className="import-compare-column">
                              <h4>Lokaal</h4>
                              {localRecipe ? (
                                <>
                                  <div className={`import-detail-block ${status === "afwijkend" ? "changed" : ""}`}>
                                    <strong>Naam</strong>
                                    <p>{localRecipe.name}</p>
                                  </div>
                                  <div className={`import-detail-block ${status === "afwijkend" ? "changed" : ""}`}>
                                    <strong>Recept aantal personen</strong>
                                    <p>{localRecipe.servings}</p>
                                  </div>
                                  <div className={`import-detail-block ${status === "afwijkend" ? "changed" : ""}`}>
                                    <strong>Ingrediënten ({localRecipe.ingredients.length})</strong>
                                    <ul className="import-ingredient-list">
                                      {formatIngredientLine(localRecipe).map((line, index) => (
                                        <li key={`${localRecipe.id}-compare-local-${index}`}>{line}</li>
                                      ))}
                                    </ul>
                                  </div>
                                </>
                              ) : (
                                <div className="import-detail-block changed">
                                  <strong>Gegevens</strong>
                                  <p>Dit recept bestaat lokaal nog niet.</p>
                                </div>
                              )}
                            </div>

                            <div className="import-compare-column">
                              <h4>Supabase / import</h4>
                              <div className={`import-detail-block ${status === "gelijk" ? "" : "changed"}`}>
                                <strong>Naam</strong>
                                <p>{importedRecipe.name}</p>
                              </div>
                              <div className={`import-detail-block ${status === "gelijk" ? "" : "changed"}`}>
                                <strong>Recept aantal personen</strong>
                                <p>{importedRecipe.servings}</p>
                              </div>
                              <div className={`import-detail-block ${status === "gelijk" ? "" : "changed"}`}>
                                <strong>Ingrediënten ({importedRecipe.ingredients.length})</strong>
                                <ul className="import-ingredient-list">
                                  {formatIngredientLine(importedRecipe).map((line, index) => (
                                    <li key={`${importedRecipe.id}-compare-import-${index}`}>{line}</li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </>
            )}
          </div>
          )}

          {activeComparison === "recipes" && recipeComparisonSource === "file" && shouldShowConflictResolver && (
            <div className="import-conflicts">
              <div className="import-conflicts-header">
                <div>
                  <h4>Conflicten per recept</h4>
                  <p className="muted-text">
                    Deze recepten hebben hetzelfde id, maar andere inhoud. Kies per recept wat straks bewaard moet blijven.
                  </p>
                </div>

                <span className="import-conflicts-count">
                  {resolvedConflictCount} / {changedRecipes.length} gekozen
                </span>
              </div>

              {changedRecipes.map(({ localRecipe, importedRecipe, differenceFlags }) => (
                <div key={importedRecipe.id} className="import-conflict-card">
                  <div className="import-conflict-heading">
                    <div>
                      <h5>{localRecipe.name}</h5>
                      <p className="muted-text">Recept-id: {localRecipe.id}</p>
                    </div>

                    <span className="import-selected-resolution">
                      {conflictResolutions[importedRecipe.id]
                        ? getResolutionLabel(conflictResolutions[importedRecipe.id])
                        : "Nog geen keuze gemaakt"}
                    </span>
                  </div>

                  <div className="import-compare-preview import-compare-preview-conflict">
                    <div className="import-compare-column">
                      <h4>Lokaal recept</h4>

                      <div className={`import-detail-block ${differenceFlags.name ? "changed" : ""}`}>
                        <strong>Naam</strong>
                        <p>{localRecipe.name}</p>
                      </div>

                      <div className={`import-detail-block ${differenceFlags.servings ? "changed" : ""}`}>
                        <strong>Recept aantal personen</strong>
                        <p>{localRecipe.servings}</p>
                      </div>

                      <div className={`import-detail-block ${differenceFlags.labels ? "changed" : ""}`}>
                        <strong>Labels</strong>
                        <p>{formatLabels(localRecipe.labels)}</p>
                      </div>

                      <div className={`import-detail-block ${differenceFlags.notes ? "changed" : ""}`}>
                        <strong>Notities</strong>
                        <p>{formatNotes(localRecipe.notes)}</p>
                      </div>

                      <div className={`import-detail-block ${differenceFlags.ingredients ? "changed" : ""}`}>
                        <strong>Ingrediënten ({localRecipe.ingredients.length})</strong>
                        <ul className="import-ingredient-list">
                          {formatIngredientLine(localRecipe).map((line, index) => (
                            <li key={`${localRecipe.id}-local-${index}`}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="import-compare-column">
                      <h4>Geïmporteerd recept</h4>

                      <div className={`import-detail-block ${differenceFlags.name ? "changed" : ""}`}>
                        <strong>Naam</strong>
                        <p>{importedRecipe.name}</p>
                      </div>

                      <div className={`import-detail-block ${differenceFlags.servings ? "changed" : ""}`}>
                        <strong>Recept aantal personen</strong>
                        <p>{importedRecipe.servings}</p>
                      </div>

                      <div className={`import-detail-block ${differenceFlags.labels ? "changed" : ""}`}>
                        <strong>Labels</strong>
                        <p>{formatLabels(importedRecipe.labels)}</p>
                      </div>

                      <div className={`import-detail-block ${differenceFlags.notes ? "changed" : ""}`}>
                        <strong>Notities</strong>
                        <p>{formatNotes(importedRecipe.notes)}</p>
                      </div>

                      <div className={`import-detail-block ${differenceFlags.ingredients ? "changed" : ""}`}>
                        <strong>Ingrediënten ({importedRecipe.ingredients.length})</strong>
                        <ul className="import-ingredient-list">
                          {formatIngredientLine(importedRecipe).map((line, index) => (
                            <li key={`${importedRecipe.id}-import-${index}`}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="import-resolution-grid">
                    <button
                      type="button"
                      className={conflictResolutions[importedRecipe.id] === "keep-local" ? "active-choice" : ""}
                      onClick={() => updateConflictResolution(importedRecipe.id, "keep-local")}
                    >
                      Bewaar lokaal recept
                    </button>

                    <button
                      type="button"
                      className={conflictResolutions[importedRecipe.id] === "keep-import" ? "active-choice" : ""}
                      onClick={() => updateConflictResolution(importedRecipe.id, "keep-import")}
                    >
                      Neem importrecept over
                    </button>

                    <button
                      type="button"
                      className={conflictResolutions[importedRecipe.id] === "keep-local-import-ingredients" ? "active-choice" : ""}
                      onClick={() => updateConflictResolution(importedRecipe.id, "keep-local-import-ingredients")}
                    >
                      Lokaal recept + import ingrediënten
                    </button>

                    <button
                      type="button"
                      className={conflictResolutions[importedRecipe.id] === "keep-import-local-ingredients" ? "active-choice" : ""}
                      onClick={() => updateConflictResolution(importedRecipe.id, "keep-import-local-ingredients")}
                    >
                      Importrecept + lokale ingrediënten
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeComparison === "recipes" && recipeComparisonSource === "file" && importPreview && changedRecipes.length > 0 && !shouldShowConflictResolver && (
            <div className="import-feedback import-feedback-success import-mode-note">
              {selectedImportMode === "overwrite" && (
                <p className="muted-text">
                  In de modus <strong>Overschrijven</strong> is geen conflictkeuze nodig: het importbestand vervangt straks de lokale receptenlijst.
                </p>
              )}

              {selectedImportMode === "add-new-only" && (
                <p className="muted-text">
                  In de modus <strong>Alleen nieuwe recepten toevoegen</strong> worden recepten met een bestaand id straks overgeslagen.
                </p>
              )}
            </div>
          )}

          {activeComparison === "groceries" && (
          <div className="import-conflicts">
            <div className="import-conflicts-header">
              <div>
                <h4>Vergelijking overige boodschappen</h4>
                <p className="muted-text">
                  Vergelijk per overige boodschap wat lokaal staat en wat er in Supabase staat. De stand aan of uit wordt hier bewust niet meegenomen.
                </p>
              </div>

              <span className="import-conflicts-count">
                lokaal {groceries.length} | Supabase {supabaseGroceryPreview.length}
              </span>
            </div>

            {groceryComparisonEntries.length > 0 && (
              <div className="import-conflicts">
                {supabaseGroceryGroups.map((group) => (
                  <details
                    key={group.status}
                    className="import-grocery-group"
                    open={false}
                  >
                    <summary className="import-grocery-group-summary">
                      <span>{group.title} ({group.items.length})</span>
                      <span className="import-conflicts-count">{group.items.length}</span>
                    </summary>

                    <div className="import-grocery-group-content">
                      {group.items.map((entry) => (
                        <div key={entry.key} className="import-conflict-card">
                          <div className="import-conflict-heading">
                            <div>
                              <h5>{entry.localGrocery?.name ?? entry.supabaseGrocery?.name ?? "Onbekende boodschap"}</h5>
                              <p className="muted-text">Boodschap-id: {entry.key}</p>
                            </div>

                            <span className="import-selected-resolution">
                              {entry.status === "gelijk"
                                ? "Gelijk"
                                : supabaseGroceryChoices[entry.key]
                                  ? getSupabaseGroceryChoiceLabel(supabaseGroceryChoices[entry.key])
                                  : "Nog geen keuze gemaakt"}
                            </span>
                          </div>

                          <div className="import-compare-preview import-compare-preview-conflict">
                            <div className="import-compare-column">
                              <h4>Lokaal</h4>
                              {entry.localGrocery ? (
                                <div className="import-detail-block">
                                  <strong>Gegevens</strong>
                                  <p>{formatGroceryLine(entry.localGrocery)}</p>
                                </div>
                              ) : (
                                <div className="import-detail-block changed">
                                  <strong>Gegevens</strong>
                                  <p>Deze boodschap bestaat lokaal nog niet.</p>
                                </div>
                              )}
                            </div>

                            <div className="import-compare-column">
                              <h4>Supabase</h4>
                              {entry.supabaseGrocery ? (
                                <div className={`import-detail-block ${entry.status === "gelijk" ? "" : "changed"}`}>
                                  <strong>Gegevens</strong>
                                  <p>{formatGroceryLine(entry.supabaseGrocery)}</p>
                                </div>
                              ) : (
                                <div className="import-detail-block changed">
                                  <strong>Gegevens</strong>
                                  <p>Deze overige boodschap staat nog niet in Supabase.</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {entry.status === "afwijkend" && (
                            <div className="import-resolution-grid">
                              <button
                                type="button"
                                className={supabaseGroceryChoices[entry.key] === "take-local" ? "active-choice" : ""}
                                onClick={() => setSupabaseGroceryChoices((current) => ({ ...current, [entry.key]: "take-local" }))}
                              >
                                Kies lokaal
                              </button>

                              <button
                                type="button"
                                className={supabaseGroceryChoices[entry.key] === "take-supabase" ? "active-choice" : ""}
                                onClick={() => setSupabaseGroceryChoices((current) => ({ ...current, [entry.key]: "take-supabase" }))}
                              >
                                Kies Supabase
                              </button>

                              <button
                                type="button"
                                className={supabaseGroceryChoices[entry.key] === "ignore" ? "active-choice" : ""}
                                onClick={() => setSupabaseGroceryChoices((current) => ({ ...current, [entry.key]: "ignore" }))}
                              >
                                Negeer
                              </button>

                              <button
                                type="button"
                                className={supabaseGroceryChoices[entry.key] === "delete" ? "active-choice" : ""}
                                onClick={() => setSupabaseGroceryChoices((current) => ({ ...current, [entry.key]: "delete" }))}
                              >
                                Verwijder
                              </button>
                            </div>
                          )}

                          {entry.status === "nieuw" && (
                            <div className="import-resolution-grid">
                              <button
                                type="button"
                                className={supabaseGroceryChoices[entry.key] === "take-over" ? "active-choice" : ""}
                                onClick={() => setSupabaseGroceryChoices((current) => ({ ...current, [entry.key]: "take-over" }))}
                              >
                                Neem over
                              </button>

                              <button
                                type="button"
                                className={supabaseGroceryChoices[entry.key] === "ignore" ? "active-choice" : ""}
                                onClick={() => setSupabaseGroceryChoices((current) => ({ ...current, [entry.key]: "ignore" }))}
                              >
                                Negeer
                              </button>
                              <button
                                type="button"
                                className={supabaseGroceryChoices[entry.key] === "delete" ? "active-choice" : ""}
                                onClick={() => setSupabaseGroceryChoices((current) => ({ ...current, [entry.key]: "delete" }))}
                              >
                                Verwijder
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                ))}

                <div className="import-apply-actions">
                  <span className="import-apply-hint">
                    Keuzes gemaakt: {resolvedSupabaseGroceryCount} / {actionableGroceryEntries.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      void handleApplySupabaseGroceryChoices()
                    }}
                    disabled={actionableGroceryEntries.length > 0 && resolvedSupabaseGroceryCount !== actionableGroceryEntries.length}
                  >
                    Bevestigen
                  </button>

                  {actionableGroceryEntries.length > 0 && resolvedSupabaseGroceryCount !== actionableGroceryEntries.length && (
                    <span className="import-apply-hint">
                      Kies eerst voor elke nieuwe of afwijkende overige boodschap wat je wilt doen.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImportExportPanel
