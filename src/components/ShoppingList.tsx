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

  const combined: Record<string, Ingredient> = {}

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

        if (!combined[key]) {

          combined[key] = {
            ...ingredient,
            amount,
            unit
          }

        } else {

          combined[key].amount += amount

        }

      })

  })

  // ✅ Overige boodschappen toevoegen aan dezelfde lijst
  groceries
  .filter(g => g.enabled !== false)
  .forEach((g) => {
    const normalized = normalizeUnit(g.amount ?? 1, g.unit ?? "")
    const amount = normalized.amount
    const unit = normalized.unit
    const shelf = g.shelf ?? "overig"
    const key = `${normalizeComparisonText(g.name)}|${unit}|${shelf}`

    if (!combined[key]) {
      combined[key] = {
        name: g.name,
        amount,
        unit,
        shelf: g.shelf ?? "overig",
        enabled: true
      }
    } else {
      combined[key].amount += amount
    }
  })


  // ✅ Groeperen per schap
  const grouped: Record<string, Ingredient[]> = {}

  Object.values(combined).forEach((ingredient) => {

    const shelf = ingredient.shelf || "overig"

    if (!grouped[shelf]) {
      grouped[shelf] = []
    }

    grouped[shelf].push(ingredient)

  })

  // ✅ Sorteren volgens route
  const sortedShelves = Object.keys(grouped).sort((a, b) => {
    const ai = route.indexOf(a)
    const bi = route.indexOf(b)

    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1

    return ai - bi
  })

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

            {grouped[shelf].map((item, i) => (

              <li key={i}>
                {item.name} — {item.amount} {item.unit}
              </li>

            ))}

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
