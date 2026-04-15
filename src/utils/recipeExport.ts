import type { Recipe, RecipeExportFile } from "../types"

function buildExportFile(recipes: Recipe[]): RecipeExportFile {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    recipes
  }
}

function buildExportFilename(exportedAt: string) {
  const safeTimestamp = exportedAt
    .replaceAll(":", "-")
    .replaceAll(".", "-")

  return `badschoppen-recepten-${safeTimestamp}.json`
}

export function exportRecipes(recipes: Recipe[]) {
  const exportFile = buildExportFile(recipes)
  const json = JSON.stringify(exportFile, null, 2)
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = buildExportFilename(exportFile.exportedAt)
  link.click()

  URL.revokeObjectURL(url)

  return exportFile
}
