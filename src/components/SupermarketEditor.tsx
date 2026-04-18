type Props = {
  route: string[]
  updateRoute: (route: string[]) => void
}

function SupermarketEditor({ route, updateRoute }: Props) {
  function moveShelf(index: number, direction: number) {

    const updated = [...route]

    const target = index + direction

    if (target < 0 || target >= updated.length) return

    const temp = updated[index]
    updated[index] = updated[target]
    updated[target] = temp

    updateRoute(updated)
  }
  return (

    <div style={{ marginTop: 16 }}>

      <ul className="route-list">

        {route.map((shelf, index) => (

          <li
            key={shelf}
            className="route-row"
          >
            <div className="route-controls">
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
