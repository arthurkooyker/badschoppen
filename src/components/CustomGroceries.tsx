import { useRef, useState } from "react"
import { SHELVES } from "../constants/shelves"
import React from "react"
import type { Grocery } from "../types"

type Props = {
  groceries: Grocery[]
  addGrocery: (g: Grocery) => void
  toggleGrocery: (index: number) => void
  updateGrocery: (index: number, g: Grocery) => void
  removeGrocery: (index: number) => void
  deselectAllGroceries: () => void
  setCategoryEnabled: (category: string | undefined, enabled: boolean) => void
  renameCategory: (currentCategory: string, nextCategory: string | undefined) => void
  removeCategoryItems: (category: string | undefined) => void
}

function CustomGroceries({ 
    groceries, 
    addGrocery, 
    toggleGrocery,
    updateGrocery,
    removeGrocery,
    deselectAllGroceries,
    setCategoryEnabled,
    renameCategory,
    removeCategoryItems
     }: Props) {

  const [name, setName] = useState("")
  const [amount, setAmount] = useState(1)
  const [unit, setUnit] = useState("stuk")
  const [shelf, setShelf] = useState("overig")
  const [category, setCategory] = useState("")
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  const existingCategories = Array.from(
    new Set(
      groceries
        .map((g) => g.category?.trim())
        .filter((value): value is string => Boolean(value))
    )
  ).sort((a, b) => a.localeCompare(b))

  const groupedGroceries = [...groceries]
    .map((g, i) => ({ g, i }))
    .sort((a, b) => a.g.name.localeCompare(b.g.name))
    .filter(({ g }) => {
      const normalizedSearch = search.trim().toLowerCase()
      const normalizedCategory = g.category?.trim() ?? ""
      const matchesSearch =
        normalizedSearch === "" ||
        g.name.toLowerCase().includes(normalizedSearch) ||
        normalizedCategory.toLowerCase().includes(normalizedSearch) ||
        (g.shelf ?? "").toLowerCase().includes(normalizedSearch)

      const matchesCategory =
        categoryFilter === "all" ||
        (categoryFilter === "uncategorized" && normalizedCategory === "") ||
        normalizedCategory === categoryFilter

      return matchesSearch && matchesCategory
    })
    .reduce<Record<string, Array<{ g: Grocery; i: number }>>>((groups, item) => {
      const key = item.g.category?.trim() || "Zonder categorie"

      if (!groups[key]) {
        groups[key] = []
      }

      groups[key].push(item)
      return groups
    }, {})

  const sortedGroupEntries = Object.entries(groupedGroceries).sort(([a], [b]) => {
    if (a === "Zonder categorie") return 1
    if (b === "Zonder categorie") return -1
    return a.localeCompare(b)
  })

  function handleAdd() {

    if (name.trim() === "") return

    addGrocery({
      name,
      amount,
      unit,
      shelf,
      enabled: true,
      category: category.trim() || undefined
    })

    setName("")
    setAmount(1)
    setCategory("")
    nameInputRef.current?.focus()
  }

  function startRenameGroup(groupName: string) {
    if (groupName === "Zonder categorie") return

    setRenamingGroup(groupName)
    setRenameValue(groupName)
  }

  function saveRenameGroup(groupName: string) {
    const trimmed = renameValue.trim()

    renameCategory(groupName, trimmed || undefined)

    setRenamingGroup(null)
    setRenameValue("")
  }

  return (

    <div style={{ marginTop: 40 }}>

      <input
        ref={nameInputRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Naam"
      />

      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
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
        <option value="l">l</option>
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

      <input
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        placeholder="Categorie"
        list="grocery-categories"
        style={{ marginLeft: 10 }}
      />

      <button
        style={{ marginLeft: 10 }}
        onClick={handleAdd}
      >
        toevoegen
      </button>

      <datalist id="grocery-categories">
        {existingCategories.map((existingCategory) => (
          <option key={existingCategory} value={existingCategory} />
        ))}
      </datalist>

      <div className="grocery-toolbar">
        <button type="button" onClick={deselectAllGroceries}>
          deselecteer alles
        </button>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Zoek overige boodschappen"
          className="grocery-search"
        />

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="grocery-filter"
        >
          <option value="all">Alle categorieen</option>
          <option value="uncategorized">Zonder categorie</option>

          {existingCategories.map((existingCategory) => (
            <option key={existingCategory} value={existingCategory}>
              {existingCategory}
            </option>
          ))}
        </select>
      </div>

      <div className="grocery-groups">

        {sortedGroupEntries.length === 0 && (
          <p className="muted-text">Geen overige boodschappen gevonden.</p>
        )}

        {sortedGroupEntries.map(([groupName, items]) => (
          <details key={groupName} className="grocery-group" open>
            <summary className="grocery-group-summary">
              <span>{groupName}</span>
              <span className="grocery-group-count">{items.length}</span>
            </summary>

            <div className="grocery-group-actions">
              <button
                type="button"
                onClick={() =>
                  setCategoryEnabled(
                    groupName === "Zonder categorie" ? undefined : groupName,
                    true
                  )
                }
              >
                alles aan
              </button>

              <button
                type="button"
                onClick={() =>
                  setCategoryEnabled(
                    groupName === "Zonder categorie" ? undefined : groupName,
                    false
                  )
                }
              >
                alles uit
              </button>

              {groupName !== "Zonder categorie" && (
                <button type="button" onClick={() => startRenameGroup(groupName)}>
                  hernoem
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  removeCategoryItems(
                    groupName === "Zonder categorie" ? undefined : groupName
                  )
                }
              >
                {groupName === "Zonder categorie" ? "verwijder alles" : "verwijder categorie"}
              </button>
            </div>

            {renamingGroup === groupName && (
              <div className="grocery-group-rename">
                <input
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  placeholder="Nieuwe categorienaam"
                />

                <button type="button" onClick={() => saveRenameGroup(groupName)}>
                  opslaan
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setRenamingGroup(null)
                    setRenameValue("")
                  }}
                >
                  annuleren
                </button>
              </div>
            )}

            <ul className="grocery-group-list">
              {items.map(({ g, i }) => (
                <li key={`${groupName}-${i}`} className="grocery-row">
                  <input
                    type="checkbox"
                    checked={g.enabled !== false}
                    onChange={() => toggleGrocery(i)}
                  />

                  <input
                    value={g.name}
                    onChange={(e) =>
                      updateGrocery(i, { ...g, name: e.target.value })
                    }
                  />

                  <input
                    type="number"
                    value={g.amount || ""}
                    onChange={(e) =>
                      updateGrocery(i, { ...g, amount: Number(e.target.value) })
                    }
                    style={{ width: 80 }}
                  />

                  <select
                    value={g.unit || ""}
                    onChange={(e) =>
                      updateGrocery(i, { ...g, unit: e.target.value })
                    }
                  >
                    <option value="">-</option>
                    <option value="g">g</option>
                    <option value="kg">kg</option>
              <option value="ml">ml</option>
              <option value="l">l</option>
              <option value="el">el</option>
              <option value="tl">tl</option>
              <option value="stuk">stuk</option>
            </select>

                  <select
                    value={g.shelf || ""}
                    onChange={(e) =>
                      updateGrocery(i, { ...g, shelf: e.target.value })
                    }
                  >
                    <option value="">-</option>

                    {SHELVES.map((shelf) => (
                      <option key={shelf} value={shelf}>
                        {shelf}
                      </option>
                    ))}
                  </select>

                  <input
                    value={g.category || ""}
                    onChange={(e) =>
                      updateGrocery(i, {
                        ...g,
                        category: e.target.value.trim() || undefined
                      })
                    }
                    placeholder="Categorie"
                    list="grocery-categories"
                  />

                  <button onClick={() => removeGrocery(i)}>🗑</button>
                </li>
              ))}
            </ul>
          </details>
        ))}

      </div>

    </div>

  )

}

export default CustomGroceries
