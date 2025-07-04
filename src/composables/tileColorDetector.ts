function lat2tile(lat: number, zoom: number) {
  return Math.floor(
    ((1 -
      Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) /
      2) *
      Math.pow(2, zoom),
  )
}

function lng2tile(lng: number, zoom: number) {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom))
}

export function getTileUrl(loc: LatLng, type: TileProvider, zoom: number) {
  const tileX = lng2tile(loc.lng, zoom)
  const tileY = lat2tile(loc.lat, zoom)
  return `https://mt1.google.com/vt/lyrs=m&x=${tileX}&y=${tileY}&z=${zoom}`
}

export async function getTileColorPresence(loc: LatLng, config: TileColorConfig): Promise<boolean> {
  const colorGroups = config.tileColors[config.tileProvider].filter((g) => g.active)

  const url = getTileUrl(loc, config.tileProvider, config.zoom)
  const response = await fetch(url)
  const blob = await response.blob()
  const imageBitmap = await createImageBitmap(blob)

  const tileSize = 256
  const pixelCount = tileSize * tileSize
  const canvas = new OffscreenCanvas(tileSize, tileSize)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context not available')

  ctx.drawImage(imageBitmap, 0, 0, tileSize, tileSize)
  const data = ctx.getImageData(0, 0, tileSize, tileSize).data

  // Use Map<number, string[]>: 24-bit RGB -> group labels
  const colorToGroups = new Map()
  const groupStats = new Map()

  for (const group of colorGroups) {
    groupStats.set(group.label, { matchCount: 0, threshold: group.threshold })

    for (const color of group.colors) {
      const [r, g, b] = color.split(',').map(Number)
      const key = (r << 16) | (g << 8) | b
      if (!colorToGroups.has(key)) colorToGroups.set(key, [])
      colorToGroups.get(key).push(group.label)
    }
  }

  // One pass over pixels
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const key = (r << 16) | (g << 8) | b
    const affectedGroups = colorToGroups.get(key)
    if (affectedGroups) {
      for (const label of affectedGroups) {
        groupStats.get(label).matchCount++
      }
    }
  }

  const results = [...groupStats.entries()].map(([label, { matchCount, threshold }]) => {
    // 1%: Match if at least 50 pixels matches (arbitrary threshold but seems reasonable to avoid false positives)
    // under use fixed threshold
    return threshold === 0.01 ? matchCount > 50 : matchCount / pixelCount >= threshold
  })

  const match =
    config.operator === 'AND' ? results.length > 0 && results.every(Boolean) : results.some(Boolean)

  return config.filterType === 'exclude' ? !match : match
}
