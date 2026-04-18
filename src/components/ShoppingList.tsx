import { useMemo, useState } from "react"
import { normalizeUnit } from "../utils/unitConversion"
import { normalizeComparisonText } from "../utils/textNormalization"
import type { Recipe, Grocery, Ingredient } from "../types"

type Props = {
  recipes: Recipe[]
  groceries: Grocery[]
  servingsOverride: Record<string, number>
  route: string[]
  supermarketName: string
  selectedRecipes: string[]
}

function ShoppingList({
  recipes,
  groceries,
  servingsOverride,
  route,
  selectedRecipes
}: Props) {

  // ✅ Alleen geselecteerde recepten
  const selectedRecipeList = recipes.filter(r =>
    selectedRecipes.includes(r.id)
  )

  const combined = useMemo(() => {
    const nextCombined: Record<string, Ingredient> = {}

    selectedRecipeList.forEach((recipe) => {
      const baseServings = recipe.servings ?? 1
      const servings = servingsOverride[recipe.id] ?? baseServings
      const factor = servings / baseServings

      recipe.ingredients
        .filter(i => i.enabled !== false)
        .forEach((ingredient) => {
          const scaledAmount = ingredient.amount * factor
          const normalized = normalizeUnit(scaledAmount, ingredient.unit)

          const amount = normalized.amount
          const unit = normalized.unit
          const shelf = ingredient.shelf ?? "overig"

          const key = `${normalizeComparisonText(ingredient.name)}|${unit}|${shelf}`

          if (!nextCombined[key]) {
            nextCombined[key] = {
              ...ingredient,
              amount,
              unit
            }
          } else {
            nextCombined[key].amount += amount
          }
        })
    })

    groceries
      .filter(g => g.enabled !== false)
      .forEach((g) => {
        const normalized = normalizeUnit(g.amount ?? 1, g.unit ?? "")
        const amount = normalized.amount
        const unit = normalized.unit
        const shelf = g.shelf ?? "overig"
        const key = `${normalizeComparisonText(g.name)}|${unit}|${shelf}`

        if (!nextCombined[key]) {
          nextCombined[key] = {
            name: g.name,
            amount,
            unit,
            shelf: g.shelf ?? "overig",
            enabled: true
          }
        } else {
          nextCombined[key].amount += amount
        }
      })

    return nextCombined
  }, [groceries, selectedRecipeList, servingsOverride])


  // ✅ Groeperen per schap
  const grouped = useMemo(() => {
    const nextGrouped: Record<string, Ingredient[]> = {}

    Object.values(combined).forEach((ingredient) => {
      const shelf = ingredient.shelf || "overig"

      if (!nextGrouped[shelf]) {
        nextGrouped[shelf] = []
      }

      nextGrouped[shelf].push(ingredient)
    })

    return nextGrouped
  }, [combined])

  // ✅ Sorteren volgens route
  const sortedShelves = Object.keys(grouped).sort((a, b) => {
    const ai = route.indexOf(a)
    const bi = route.indexOf(b)

    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1

    return ai - bi
  })

  const shoppingListSignature = useMemo(
    () =>
      sortedShelves
        .flatMap((shelf) =>
          grouped[shelf].map(
            (item) => `${shelf}|${normalizeComparisonText(item.name)}|${item.amount}|${item.unit}`
          )
        )
        .join("||"),
    [grouped, sortedShelves]
  )

  const [crossedOffState, setCrossedOffState] = useState<{
    signature: string
    items: Record<string, boolean>
  }>({
    signature: "",
    items: {}
  })

  const crossedOffItems =
    crossedOffState.signature === shoppingListSignature ? crossedOffState.items : {}

  function toggleCrossedOff(key: string) {
    setCrossedOffState((current) => {
      const items = current.signature === shoppingListSignature ? current.items : {}

      return {
        signature: shoppingListSignature,
        items: {
          ...items,
          [key]: !items[key]
        }
      }
    })
  }

  // ✅ Copy functie
  function copyList() {

    let text = ""

    sortedShelves.forEach((shelf) => {

      text += shelf.toUpperCase() + "\n"

      grouped[shelf].forEach((item) => {
        text += `- ${item.name} ${item.amount} ${item.unit}\n`
      })

      text += "\n"

    })

    navigator.clipboard.writeText(text)

  }

  return (

    <div style={{ marginTop: 40 }}>

      {sortedShelves.map((shelf) => (

        <div key={shelf} style={{ marginBottom: 20 }}>

          <h3>{shelf}</h3>

          <ul>

            {grouped[shelf].map((item) => {
              const itemKey = `${shelf}|${normalizeComparisonText(item.name)}|${item.amount}|${item.unit}`
              const isCrossedOff = crossedOffItems[itemKey] === true

              return (
              <li key={itemKey}>
                <button
                  type="button"
                  className={`shopping-list-item ${isCrossedOff ? "crossed-off" : ""}`}
                  onClick={() => toggleCrossedOff(itemKey)}
                >
                  {item.name} — {item.amount} {item.unit}
                </button>
              </li>
              )
            })}

          </ul>

        </div>

      ))}

      <button onClick={copyList}>
        Kopieer lijst
      </button>

    </div>

  )

}

export default ShoppingList
