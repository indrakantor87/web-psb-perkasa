export type OdcNamedRow = {
  nama_odc: string
}

export function compareOdcRows<T extends OdcNamedRow>(a: T, b: T) {
  const extractNumber = (name: string) => {
    const match = name.match(/\bodc\b.*?(\d+)/i)
    return match ? Number(match[1]) : Number.POSITIVE_INFINITY
  }
  const numberA = extractNumber(a.nama_odc)
  const numberB = extractNumber(b.nama_odc)

  if (numberA !== numberB) return numberA < numberB ? -1 : 1
  return a.nama_odc.localeCompare(b.nama_odc, undefined, { numeric: true })
}
