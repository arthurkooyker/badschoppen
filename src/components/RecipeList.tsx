import { useState } from "react"
import type { Recipe } from "../types"

type Props = {
  recipes: Recipe[]
  selectedRecipes: string[]
  toggleRecipe: (id: string) => void
  onSelect: (id: string) => void
  renameRecipe: (id: string, name: string) => void
  deleteRecipe: (id: string) => void
  onLabelClick: (label: string) => void
}


function RecipeList({ 
    recipes,
    deleteRecipe, 
    onSelect, 
    renameRecipe,
    selectedRecipes,
    toggleRecipe, 
    onLabelClick }: Props) {

  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingName, setEditingName] = useState("")

  function startEditing(index: number, currentName: string) {
    setEditingIndex(index)
    setEditingName(currentName)
  }

  function saveEdit(recipeId: string) {
  if (editingName.trim() === "") return

  renameRecipe(recipeId, editingName)

  setEditingIndex(null)
  setEditingName("")
}


  function cancelEdit() {
    setEditingIndex(null)
    setEditingName("")
  }

  return (

  <div style={{ marginTop: 40 }}>

    <ul>

      {recipes.map((recipe, index) => (

        <li key={recipe.id} style={{ marginBottom: 12 }}>

          {editingIndex === index ? (

            <div>

              <input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
              />

              <button
                style={{ marginLeft: 8 }}
                onClick={() => saveEdit(recipe.id)}
              >

                opslaan
              </button>

              <button
                style={{ marginLeft: 4 }}
                onClick={cancelEdit}
              >
                annuleren
              </button>

            </div>

          ) : (

            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>

              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>

                <input
                  type="checkbox"
                  checked={selectedRecipes.includes(recipe.id)}
                  onChange={() => toggleRecipe(recipe.id)}
                />

                <button onClick={() => onSelect(recipe.id)}>
                  {recipe.name}
                </button>

              </div>

              <button
                onClick={() => startEditing(index, recipe.name)}
              >
                ✏️
              </button>

              <button
                onClick={() => deleteRecipe(recipe.id)}
              >
                🗑
              </button>

            </div>

          )}

          {(recipe.labels ?? []).length > 0 && (

            <div style={{ marginTop: 4 }}>

              {(recipe.labels ?? []).map((label, i) => (

                <button
                  type="button"
                  key={i}
                  onClick={() => onLabelClick(label)}
                  style={{
                    background: "#1f7a8c",
                    color: "white",
                    padding: "2px 6px",
                    borderRadius: "6px",
                    marginRight: "4px"
                  }}
                >
                  {label}
                </button>

              ))}

            </div>

          )}

        </li>

      ))}

    </ul>

  </div>

)

}

export default RecipeList
