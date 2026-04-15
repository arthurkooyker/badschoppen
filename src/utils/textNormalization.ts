export function normalizeComparisonText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("nl-NL")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
}
