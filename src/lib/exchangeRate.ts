export interface UsdToGbpRate {
  rate: number
  date: string
}

/**
 * Live USD->GBP mid-market rate (ECB-sourced, frankfurter.dev, no key required) for
 * converting the dummy owner invoice PDF - the owner's real invoice template is in £, priced
 * off whatever the rate is on the day they generate the PDF.
 */
export async function fetchUsdToGbpRate(): Promise<UsdToGbpRate> {
  const response = await fetch('https://api.frankfurter.dev/v1/latest?from=USD&to=GBP')
  if (!response.ok) {
    throw new Error('Could not fetch the USD to GBP exchange rate.')
  }
  const data = (await response.json()) as { date: string; rates: { GBP: number } }
  return { rate: data.rates.GBP, date: data.date }
}
