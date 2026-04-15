import { useState } from "react"

type Props = {
  route: string[]
  updateRoute: (route: string[]) => void
}

function SupermarketEditor({ route, updateRoute }: Props) {
  const [draggedShelf, setDraggedShelf] = useState<string | null>(null)

  function moveShelf(index: number, direction: number) {

    const updated = [...route]

    const target = index + direction

    if (target < 0 || target >= updated.length) return

    const temp = updated[index]
    updated[index] = updated[target]
    updated[target] = temp

    updateRoute(updated)
  }

  function moveShelfToIndex(shelf: string, targetIndex: number) {
    const currentIndex = route.indexOf(shelf)

    if (currentIndex < 0 || currentIndex === targetIndex) return

    const updated = [...route]
    updated.splice(currentIndex, 1)
    updated.splice(targetIndex, 0, shelf)
    updateRoute(updated)
  }

  return (

    <div style={{ marginTop: 16 }}>

      <ul className="route-list">

        {route.map((shelf, index) => (

          <li
            key={shelf}
            className={`route-row ${draggedShelf === shelf ? "route-row-dragging" : ""}`}
            draggable
            onDragStart={() => setDraggedShelf(shelf)}
            onDragEnd={() => setDraggedShelf(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (draggedShelf) {
                moveShelfToIndex(draggedShelf, index)
              }
              setDraggedShelf(null)
            }}
          >
            <div className="route-controls">
              <span className="route-drag-handle" aria-hidden="true">⋮⋮</span>
              <button
                type="button"
                className="route-arrow"
                onClick={() => moveShelf(index, -1)}
              >
                ↑
              </button>

              <button
                type="button"
                className="route-arrow"
                onClick={() => moveShelf(index, 1)}
              >
                ↓
              </button>
            </div>

            <span className="route-name">{shelf}</span>

          </li>

        ))}

      </ul>

    </div>

  )

}

export default SupermarketEditor
