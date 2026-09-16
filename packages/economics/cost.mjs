export function calculateProductEconomics({ generationCost = 0, verificationCost = 0, storageCost = 0, sellingPrice = 0 }) {
  const estimatedTotalCost = generationCost + verificationCost + storageCost;
  return { generationCost, verificationCost, storageCost, estimatedTotalCost, sellingPrice, margin: sellingPrice - estimatedTotalCost, currency: "USD" };
}
