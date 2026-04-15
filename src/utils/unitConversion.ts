export function normalizeUnit(amount: number, unit: string) {
  switch (unit) {
    case "kg":
      return { amount: amount * 1000, unit: "g" }

    case "mg":
      return { amount: amount / 1000, unit: "g" }

    case "liter":
    case "l":
      return { amount: amount * 1000, unit: "ml" }

    default:
      return { amount, unit }
  }
}
