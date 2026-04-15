import type { Recipe } from "../types"

type Props = {
  recipes: Recipe[]
  selected: boolean[]
  toggle: (index: number) => void
  servingsOverride: Record<string, number>
  setRecipeServings: (index: number, servings: number) => void
}

function RecipeSelector({ 
    recipes, 
    selected, 
    toggle, 
    servingsOverride, 
    setRecipeServings 
}: Props) {

  return (
    <div style={{ marginTop: 40 }}>

      <h2>Selecteer recepten voor boodschappen</h2>

      <ul>

        {recipes.map((recipe, index) => (

          <li key={index}>

<label>

<input
  type="checkbox"
  checked={selected[index] || false}
  onChange={() => toggle(index)}
/>

{" "}
{recipe.name}

</label>

<input
  type="number"
  value={servingsOverride[recipe.id] ?? recipe.servings}
  onChange={(e) =>
    setRecipeServings(index, Number(e.target.value))
  }
  style={{ width: 60, marginLeft: 10 }}
/>

<span style={{ marginLeft: 4 }}>
  personen
</span>

</li>

        ))}

      </ul>

    </div>
  )
}

export default RecipeSelector
