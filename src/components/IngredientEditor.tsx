import { useRef, useState } from "react"
import { SHELVES } from "../constants/shelves"
import type { Recipe, Ingredient } from "../types"

type Props = {
  recipe: Recipe
  addIngredient: (recipeId: string, ingredient: Ingredient) => void
  toggleIngredient: (recipeId: string, ingredientId: string) => void
  removeIngredient: (recipeId: string, ingredientId: string) => void
  addLabel: (recipeId: string, label: string) => void
  removeLabel: (recipeId: string, label: string) => void
  allLabels: string[]
  servingsOverride: Record<string, number>
  updateRecipeServings: (id: string, servings: number) => void
  updateRecipeBaseServings: (id: string, servings: number) => void
  updateRecipeNotes: (recipeId: string, notes: string) => void
}

function IngredientEditor({
  recipe,
  addIngredient,
  toggleIngredient,
  removeIngredient,
  addLabel,
  removeLabel,
  allLabels,
  updateRecipeBaseServings,
  servingsOverride,
  updateRecipeServings,
  updateRecipeNotes
}: Props) {
  const nameInputRef = useRef<HTMLInputElement | null>(null)
  const [name, setName] = useState("")
  const [amount, setAmount] = useState("1")
  const [unit, setUnit] = useState("stuk")
  const [shelf, setShelf] = useState("overig")
  const [newLabel, setNewLabel] = useState("")

  function parseAmount(value: string) {
    return Number(value.replace(",", "."))
  }

  function handleAdd() {
    const parsedAmount = parseAmount(amount)

    if (name.trim() === "" || Number.isNaN(parsedAmount)) return

    addIngredient(recipe.id, {
        name,
        amount: parsedAmount,
        unit,
        shelf,
        enabled: true
    })

    setName("")
    setAmount("1")
    nameInputRef.current?.focus()
  }

  function handleAddLabel() {

  if (newLabel.trim() === "") return

    addLabel(recipe.id, newLabel)

    setNewLabel("")
}

  return (
    <div style={{ marginTop: 40 }}>
      
      <h3>Boodschappen voor</h3>

<input
  type="number"
  min={1}
  value={servingsOverride[recipe.id] ?? recipe.servings}
  onChange={(e) =>
    updateRecipeServings(
      recipe.id,
      Math.max(1, Number(e.target.value))
    )
  }
  style={{ width: 60 }}
/>



<span style={{ marginLeft: 6 }}>
  personen
</span>

<div style={{ marginTop: 6, marginBottom: 16, fontSize: 12 }}>
  Dit aantal bepaalt hoeveel er op de boodschappenlijst komt.
</div>

<h3>Overige benodigdheden</h3>

<textarea
  value={recipe.notes ?? ""}
  onChange={(e) =>
    updateRecipeNotes(recipe.id, e.target.value)
  }
  placeholder="bijv: olijfolie, zout, peper, komijn"
  rows={3}
  style={{ width: "100%", marginBottom: 10 }}
/>

      <input
        ref={nameInputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Ingrediënt"
      />

      <input
        type="text"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ width: 60, marginLeft: 10 }}
      />

      <select
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
        style={{ marginLeft: 10 }}
      >
        <option value="stuk">stuk</option>
        <option value="mg">mg</option>
        <option value="g">g</option>
        <option value="kg">kg</option>
        <option value="ml">ml</option>
        <option value="liter">liter</option>
        <option value="el">el</option>
        <option value="tl">tl</option>
        <option value="zak">zak</option>
        <option value="klein">klein</option>
        <option value="groot">groot</option>
      </select>

      <select
  value={shelf}
  onChange={(e) => setShelf(e.target.value)}
  style={{ marginLeft: 10 }}
>

{SHELVES.map((s) => (
  <option key={s} value={s}>
    {s}
  </option>
))}

</select>

      <button onClick={handleAdd} style={{ marginLeft: 10 }}>
        Toevoegen
      </button>

      <ul>
  {recipe.ingredients.map((ingredient) => (
    <li key={ingredient.id}>
      <input
        type="checkbox"
        checked={ingredient.enabled}
        onChange={() => toggleIngredient(recipe.id, ingredient.id)}
      />

      {" "}
      {ingredient.name} — {ingredient.amount} {ingredient.unit} — {ingredient.shelf}

      <button
        onClick={() => removeIngredient(recipe.id, ingredient.id)}
        >
        🗑
        </button>

    </li>
  ))}
</ul>

<div style={{ marginTop: 20 }}>

  <span>Recept aantal personen: </span>

    <input
    type="number"
    min={1}
    value={recipe.servings ?? 1}
    onChange={(e) =>
      updateRecipeBaseServings(
        recipe.id,
        Math.max(1, Number(e.target.value))
      )
    }
    style={{ width: 60, marginLeft: 10 }}
  />

</div>

<h3>Labels</h3>

<div className="ingredient-label-add">
  <input
    value={newLabel}
    onChange={(e) => setNewLabel(e.target.value)}
    placeholder="nieuw label"
  />

  <button
    type="button"
    onClick={handleAddLabel}
  >
    toevoegen
  </button>
</div>

<div className="ingredient-label-options">

{(allLabels ?? []).map(label => (

  <button
    key={label}
    onClick={() => addLabel(recipe.id, label)}
    className="ingredient-label-option"
  >
    {label}
  </button>

))}

</div>

<ul>

  {(recipe.labels ?? []).map((label) => (

  <li
    key={label}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      marginRight: "8px",
      marginBottom: "6px"
    }}
  >
    <span
      style={{
        background: "#1f7a8c",
        color: "white",
        padding: "2px 6px",
        borderRadius: "6px"
      }}
    >
      {label}
    </span>

    <button
      type="button"
      onClick={() => removeLabel(recipe.id, label)}
      style={{ padding: "2px 6px" }}
    >
      x
    </button>
  </li>

))}

</ul>
    </div>
  )
}

export default IngredientEditor
