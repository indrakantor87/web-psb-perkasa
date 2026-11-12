export function getFocusedIntegerAxisDomain(values: number[]): [number, number] | undefined {
  const finiteValues = values.filter(Number.isFinite)
  if (finiteValues.length === 0) return undefined

  const dataMin = Math.min(...finiteValues)
  const dataMax = Math.max(...finiteValues)
  const range = dataMax - dataMin
  const rawStep =
    range > 0
      ? Math.max(range / 5, 1)
      : Math.max(Math.abs(dataMin), Math.abs(dataMax), 1) * 0.01
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const normalizedStep = rawStep / magnitude
  const step = (normalizedStep <= 1 ? 1 : normalizedStep <= 2 ? 2 : normalizedStep <= 5 ? 5 : 10) * magnitude
  const padding = step * 0.25
  const lower = Math.max(0, Math.floor((dataMin - padding) / step) * step)
  const upper = Math.ceil((dataMax + padding) / step) * step

  return [lower, upper > lower ? upper : lower + step]
}
