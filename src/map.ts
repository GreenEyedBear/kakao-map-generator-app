import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@/assets/leaflet-draw/leaflet.draw.js' // npm one is broken for rectangles so we use a patched one
import '@/assets/leaflet-draw/leaflet.draw.css'
import 'leaflet.markercluster'
import 'leaflet.markercluster.freezable/dist/leaflet.markercluster.freezable.js'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import 'leaflet-contextmenu'
import 'leaflet-contextmenu/dist/leaflet.contextmenu.css'

import worldBorders from '@/assets/geojson/world_borders.json'

import markerBlue from '@/assets/markers/marker-blue.png'
import markerRed from '@/assets/markers/marker-red.png'
import markerViolet from '@/assets/markers/marker-violet.png'
import markerGreen from '@/assets/markers/marker-green.png'
import markerPink from '@/assets/markers/marker-pink.png'

import { ref } from 'vue'
import { useStorage } from '@vueuse/core'
import { settings } from '@/settings'
import { isValidGeoJSON, getPolygonName } from '@/composables/utils.ts'

import { useStore } from '@/store'
const { selected, select, state } = useStore()

const { electronAPI } = window

let map: L.Map
const currentZoom = ref(1)

const roadmapBaseLayer = L.tileLayer(
  'https://www.google.com/maps/vt?pb=!1m7!8m6!1m3!1i{z}!2i{x}!3i{y}!2i9!3x1!2m2!1e0!2sm!3m5!2sen!3sus!5e1105!12m1!1e3!4e0!5m4!1e0!8m2!1e1!1e1!6m6!1e12!2i2!11e0!39b0!44e0!50e0',
  { minZoom: 1, maxZoom: 20 },
)
const roadmapLabelsLayer = L.tileLayer(
  'https://www.google.com/maps/vt?pb=!1m7!8m6!1m3!1i{z}!2i{x}!3i{y}!2i9!3x1!2m2!1e0!2sm!3m5!2sen!3sus!5e1105!12m1!1e15!4e0!5m4!1e0!8m2!1e1!1e1!6m6!1e12!2i2!11e0!39b0!44e0!50e0',
  { pane: 'labelPane' },
)
const roadmapLayer = L.layerGroup([roadmapBaseLayer, roadmapLabelsLayer])

const terrainBaseLayer = L.tileLayer(
  'https://www.google.com/maps/vt?pb=!1m7!8m6!1m3!1i{z}!2i{x}!3i{y}!2i9!3x1!2m2!1e0!2sm!2m1!1e4!3m7!2sen!3sus!5e1105!12m1!1e67!12m1!1e3!4e0!5m4!1e0!8m2!1e1!1e1!6m6!1e12!2i2!11e0!39b0!44e0!50e0',
  { minZoom: 1, maxZoom: 20 },
)
const terrainLayer = L.layerGroup([terrainBaseLayer, roadmapLabelsLayer])

const satelliteBaseLayer = L.tileLayer(
  'https://www.google.com/maps/vt?pb=!1m7!8m6!1m3!1i{z}!2i{x}!3i{y}!2i9!3x1!2m2!1e1!2sm!3m3!2sen!3sus!5e1105!4e0!5m4!1e0!8m2!1e1!1e1!6m6!1e12!2i2!11e0!39b0!44e0!50e0',
  { minZoom: 1, maxZoom: 20 },
)
const satelliteLabelsLayer = L.tileLayer(
  'https://www.google.com/maps/vt?pb=!1m7!8m6!1m3!1i{z}!2i{x}!3i{y}!2i9!3x1!2m2!1e0!2sm!3m5!2sen!3sus!5e1105!12m1!1e4!4e0!5m4!1e0!8m2!1e1!1e1!6m6!1e12!2i2!11e0!39b0!44e0!50e0',
  { pane: 'labelPane' },
)
const satelliteLayer = L.layerGroup([satelliteBaseLayer, satelliteLabelsLayer])

const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  minZoom: 1,
  maxZoom: 19,
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
})

const gsvLayer = L.tileLayer(
  'https://www.google.com/maps/vt?pb=!1m7!8m6!1m3!1i{z}!2i{x}!3i{y}!2i9!3x1!2m8!1e2!2ssvv!4m2!1scc!2s*211m3*211e2*212b1*213e2*211m3*211e3*212b1*213e2*212b1*214b1!4m2!1ssvl!2s*211b0*212b1!3m8!2sen!3sus!5e1105!12m4!1e68!2m2!1sset!2sRoadmap!4e0!5m4!1e0!8m2!1e1!1e1!6m6!1e12!2i2!11e0!39b0!44e0!50e0',
)
const gsvLayer2 = L.tileLayer(
  'https://www.google.com/maps/vt?pb=!1m7!8m6!1m3!1i{z}!2i{x}!3i{y}!2i9!3x1!2m8!1e2!2ssvv!4m2!1scc!2s*211m3*211e2*212b1*213e2*212b1*214b1!4m2!1ssvl!2s*211b0*212b1!3m8!2sen!3sus!5e1105!12m4!1e68!2m2!1sset!2sRoadmap!4e0!5m4!1e0!8m2!1e1!1e1!6m6!1e12!2i2!11e0!39b0!44e0!50e0',
)
const gsvLayer3 = L.tileLayer(
  'https://maps.googleapis.com/maps/vt?pb=!1m5!1m4!1i{z}!2i{x}!3i{y}!4i256!2m8!1e2!2ssvv!4m2!1scb_client!2sapiv3!4m2!1scc!2s*211m3*211e3*212b1*213e2*211m3*211e2*212b1*213e2!3m3!3sUS!12m1!1e68!4e0',
  { minZoom: 12, minNativeZoom: 14 },
)
const gsvLayer4 = L.tileLayer(
  'https://www.google.com/maps/vt?pb=!1m7!8m6!1m3!1i{z}!2i{x}!3i{y}!2i9!3x1!2m8!1e2!2ssvv!4m2!1scc!2s*211m3*211e3*212b1*213e2*212b1*214b1!4m2!1ssvl!2s*211b0*212b1!3m8!2sen!3sus!5e1105!12m4!1e68!2m2!1sset!2sRoadmap!4e0!5m4!1e0!8m2!1e1!1e1!6m6!1e12!2i2!11e0!39b0!44e0!50e0',
)

const baseMaps = {
  Roadmap: roadmapLayer,
  Satellite: satelliteLayer,
  Terrain: terrainLayer,
  OSM: osmLayer,
}

const overlayMaps = {
  'Google Street View': gsvLayer,
  'Google Street View Official Only': gsvLayer2,
  'Google Street View Roads (Only Works at Zoom Level 12+)': gsvLayer3,
  'Unofficial coverage only': gsvLayer4,
}

const drawnPolygonsLayer = new L.GeoJSON()

const drawControl = new L.Control.Draw({
  position: 'bottomleft',
  draw: {
    polyline: false,
    marker: false,
    circlemarker: false,
    circle: false,
    polygon: {
      allowIntersection: false,
      drawError: {
        color: '#e1e100',
        message:
          '<strong>Polygon draw does not allow intersections!<strong> (allowIntersection: false)',
      },
      shapeOptions: { color: '#5d8ce3' },
    },
    rectangle: { shapeOptions: { color: '#5d8ce3' } },
  },
  edit: { featureGroup: drawnPolygonsLayer },
})

async function initMap(el: string) {
  if (map) return map

  map = L.map(el, {
    attributionControl: false,
    contextmenu: true,
    contextmenuItems: [
      { text: 'Copy Coordinates', callback: copyCoords },
      { text: 'See Nearest Pano', callback: openNearestPano },
    ],
    center: [36.1126901, 127.6279063],
    preferCanvas: true,
    zoom: 6,
    minZoom: 6,
    zoomControl: false,
    worldCopyJump: true,
  })

  map.createPane('labelPane')
  map.getPane('labelPane')!.style.zIndex = '300'

  const selectedBase = baseMaps[storedLayers.value.base] || roadmapLayer
  selectedBase.addTo(map)

  storedLayers.value.overlays.forEach((name) => {
    const layer = overlayMaps[name]
    if (layer) map.addLayer(layer)
  })

  L.control.layers(baseMaps, overlayMaps, { position: 'bottomleft' }).addTo(map)

  Object.entries(markerLayers).forEach(([key]) => {
    updateMarkerLayers(key as MarkerLayersTypes)
  })

  const layers = await electronAPI.invoke('load-custom-layers')
  for (const layer of layers) {
    if (!isValidGeoJSON(layer.source)) {
      alert(`Invalid GeoJSON in "${layer.label}"`)
      console.warn(`Invalid GeoJSON: ${layer.label}`)
      continue
    }
    availableLayers.value.push(layer)
  }

  for (const layer of availableLayers.value) {
    if (layer.visible) {
      const loaded = await loadLayer(layer as LayerMeta)
      map.addLayer(loaded)
    }
  }

  map.addControl(drawControl)

  map.on('baselayerchange', (e) => {
    const name = baseLayerToName.get(e.layer)
    if (name) storedLayers.value.base = name as BaseMapName
  })
  map.on('overlayadd', (e) => {
    const name = overlayLayerToName.get(e.layer) as OverlayMapName
    if (name && !storedLayers.value.overlays.includes(name)) {
      storedLayers.value.overlays.push(name)
    }
  })
  map.on('overlayremove', (e) => {
    const name = overlayLayerToName.get(e.layer)
    if (name) {
      storedLayers.value.overlays = storedLayers.value.overlays.filter((n) => n !== name)
    }
  })

  map.on('draw:created', (e) => {
    const event = e as L.DrawEvents.Created
    const polygon = event.layer as Polygon
    polygon.feature = event.layer.toGeoJSON()
    polygon.feature.properties.name = `Custom polygon ${drawnPolygonsLayer.getLayers().length + 1}`
    initPolygon(polygon)
    polygon.setStyle(polygonStyles.customPolygonStyle())
    polygon.setStyle(polygonStyles.highlighted())
    polygon.on('mouseover', (e: L.LeafletMouseEvent) => highlightFeature(e))
    polygon.on('mouseout', (e: L.LeafletMouseEvent) => resetHighlight(e))
    polygon.on('click', (e: L.LeafletMouseEvent) => selectPolygon(e))
    drawnPolygonsLayer.addLayer(polygon)
    selected.value.push(polygon)
  })
  map.on('draw:edited', (e) => {
    const event = e as L.DrawEvents.Edited
    event.layers.eachLayer((layer) => {
      const polygon = layer as Polygon
      const geojson = polygon.toGeoJSON()
      polygon.feature = geojson
      const index = selected.value.findIndex((x) => x._leaflet_id === polygon._leaflet_id)
      if (index != -1) selected.value[index] = polygon
    })
  })
  map.on('draw:deleted', (e) => {
    const event = e as L.DrawEvents.Deleted
    event.layers.eachLayer((layer) => {
      const polygon = layer as Polygon
      clearPolygon(polygon)
      const index = selected.value.findIndex((x) => x._leaflet_id === polygon._leaflet_id)
      if (index != -1) selected.value.splice(index, 1)
    })
  })

  map.on('zoom', ({ target }) => {
    currentZoom.value = target.getZoom()
  })
  map.on('zoomend', ({ target }) => {
    currentZoom.value = target.getZoom()
  })

  const mapDiv = document.getElementById('map') as HTMLElement
  const resizeObserver = new ResizeObserver(() => {
    map.invalidateSize()
    // Hack for tiles not loading after hard refresh on firefox
    const zoom = map.getZoom()
    map.setZoom(zoom - 1)
    map.setZoom(zoom + 1)
  })
  resizeObserver.observe(mapDiv)

  // we move leaflet controls out of the #map container for z-index
  const drawControlContainer = map.getContainer().querySelector('.leaflet-control-container')
  const ui = document.getElementById('leaflet-ui')
  if (ui && drawControlContainer) {
    ui.appendChild(drawControlContainer)
  }

  return map
}

const copyCoords = (e: L.ContextMenuItemClickEvent) => {
  navigator.clipboard.writeText(e.latlng.lat.toFixed(7) + ', ' + e.latlng.lng.toFixed(7))
}
const openNearestPano = (e: L.ContextMenuItemClickEvent) => {
  open(
    `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${e.latlng.lat},${e.latlng.lng}`,
  )
}

function initPolygon(polygon: Polygon) {
  if (!polygon.found) polygon.found = []
  if (!polygon.nbNeeded) polygon.nbNeeded = 100
  if (!polygon.checkedPanos) polygon.checkedPanos = new Set()
}

function selectPolygon(e: L.LeafletMouseEvent) {
  if (state.started) return
  const polygon = e.target as Polygon
  const index = selected.value.findIndex((x) => x._leaflet_id === polygon._leaflet_id)
  if (index == -1) {
    polygon.setStyle(polygonStyles.highlighted())
    selected.value.push(polygon)
  } else {
    selected.value.splice(index, 1)
    resetHighlight(e)
  }
}

const loadedLayers: Record<string, L.GeoJSON> = {}

type BaseMapName = keyof typeof baseMaps
type OverlayMapName = keyof typeof overlayMaps
const storedLayers = useStorage<{
  base: BaseMapName
  overlays: OverlayMapName[]
}>('kakao_map_generator__layers', {
  base: 'Roadmap',
  overlays: ['Google Street View Official Only'],
})

const baseLayerToName = new Map<L.Layer, string>()
for (const [name, layer] of Object.entries(baseMaps)) {
  baseLayerToName.set(layer, name)
}

const overlayLayerToName = new Map<L.Layer, string>()
for (const [name, layer] of Object.entries(overlayMaps)) {
  overlayLayerToName.set(layer, name)
}

type MarkerLayersTypes = 'gen4' | 'gen2Or3' | 'gen1' | 'newRoad' | 'noBlueLine'
const markerLayers: Record<MarkerLayersTypes, L.MarkerClusterGroup> = {
  gen4: L.markerClusterGroup({ maxClusterRadius: 100, disableClusteringAtZoom: 15 }),
  gen2Or3: L.markerClusterGroup({ maxClusterRadius: 100, disableClusteringAtZoom: 15 }),
  gen1: L.markerClusterGroup({ maxClusterRadius: 100, disableClusteringAtZoom: 15 }),
  newRoad: L.markerClusterGroup({ maxClusterRadius: 100, disableClusteringAtZoom: 15 }),
  noBlueLine: L.markerClusterGroup({ maxClusterRadius: 100, disableClusteringAtZoom: 15 }),
}

export interface LayerMeta {
  label: string
  key: string
  source: string | L.Layer | GeoJSON.GeoJsonObject
  visible: boolean
}
const availableLayers = ref<LayerMeta[]>([
  {
    label: 'World Borders',
    key: 'world_borders',
    source: worldBorders as unknown as L.GeoJSON,
    visible: true,
  },
  {
    label: 'Drawn polygons',
    key: 'drawn_polygons',
    source: drawnPolygonsLayer,
    visible: true,
  },
])

async function loadLayer(layer: LayerMeta) {
  if (loadedLayers[layer.key]) return loadedLayers[layer.key]

  let geoJsonLayer: L.GeoJSON

  if (layer.key === 'drawn_polygons') {
    geoJsonLayer = drawnPolygonsLayer
  } else {
    // let data: GeoJSON.GeoJsonObject
    // if (typeof layer.source === 'string') {
    //   const response = await fetch(layer.source)
    //   data = await response.json()
    // } else {
    //   data = layer.source
    // }
    const data = layer.source as GeoJSON.GeoJsonObject

    const style =
      layer.key === 'world_borders' ? polygonStyles.defaultHidden : polygonStyles.customPolygonStyle

    geoJsonLayer = L.geoJSON(data, { style, onEachFeature })
    geoJsonLayer.eachLayer((polygon) => {
      initPolygon(polygon as Polygon)
    })
  }
  loadedLayers[layer.key] = geoJsonLayer
  return geoJsonLayer
}

async function toggleLayer(layer: LayerMeta) {
  if (layer.visible) {
    const loaded = await loadLayer(layer)
    map.addLayer(loaded)
  } else {
    const loaded = loadedLayers[layer.key]
    if (loaded) map.removeLayer(loaded)
  }
}

function selectLayer(layerKey: string) {
  const layer = loadedLayers[layerKey]
  if (!layer) return

  const alreadySelected = new Set(selected.value.map((p) => p._leaflet_id))
  const toAdd: Polygon[] = []

  layer.eachLayer((polygon) => {
    const p = polygon as Polygon
    if (!alreadySelected.has(p._leaflet_id)) {
      toAdd.push(p)
    }
  })
  layer.setStyle(polygonStyles.highlighted)
  selected.value.push(...toAdd)
}

function deselectLayer(layerKey: string) {
  const layer = loadedLayers[layerKey]
  if (!layer) return

  const idsToRemove = new Set<number>()

  layer.eachLayer((polygon) => {
    const p = polygon as Polygon
    if (p._leaflet_id) {
      idsToRemove.add(p._leaflet_id)
    }
  })
  layer.setStyle(
    layerKey === 'world_borders' ? polygonStyles.defaultHidden : polygonStyles.customPolygonStyle,
  )
  selected.value = selected.value.filter((p) => !idsToRemove.has(p._leaflet_id))
}

// async function importLayer(e: Event) {
//   const input = e.target as HTMLInputElement
//   if (!input.files) return

//   for (const file of input.files) {
//     const result = await readFileAsText(file)
//     try {
//       const json = JSON.parse(result)
//       if (!isValidGeoJSON(json)) {
//         throw new Error('Invalid GeoJSON structure.')
//       }

//       const meta: LayerMeta = {
//         label: file.name,
//         key: file.name,
//         source: json,
//         visible: true,
//       }
//       availableLayers.value.push(meta)
//       const layer = await loadLayer(meta)
//       map.addLayer(layer)
//     } catch (e) {
//       alert(`Invalid GeoJSON in "${file.name}"`)
//       console.error(e)
//     }
//   }
// }

function exportLayer(l: LayerMeta) {
  const layer = loadedLayers[l.key]
  if (!layer) return

  const dataUri =
    'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(layer.toGeoJSON()))
  const fileName = l.label ?? 'Custom Layer'
  const linkElement = document.createElement('a')
  linkElement.href = dataUri
  linkElement.download = fileName
  linkElement.click()
}

function updateMarkerLayers(gen: MarkerLayersTypes) {
  if (
    (gen === 'gen4' && settings.markers.gen4) ||
    (gen === 'gen2Or3' && settings.markers.gen2Or3) ||
    (gen === 'gen1' && settings.markers.gen1) ||
    (gen === 'newRoad' && settings.markers.newRoad) ||
    (gen === 'noBlueLine' && settings.markers.noBlueLine)
  ) {
    map.addLayer(markerLayers[gen])
    if (!settings.markers.cluster) markerLayers[gen].disableClustering()
    else markerLayers[gen].enableClustering()
  } else {
    map.removeLayer(markerLayers[gen])
  }
}

function updateClusters() {
  Object.values(markerLayers).forEach((markerLayer) => {
    if (settings.markers.cluster) markerLayer.enableClustering()
    else markerLayer.disableClustering()
  })
}

function clearPolygon(polygon: Polygon) {
  Object.values(markerLayers).forEach((markerLayer) => {
    const toRemove = markerLayer.getLayers().filter((layer) => {
      const marker = layer as L.Marker
      return marker.polygonID === polygon._leaflet_id
    })
    toRemove.forEach((marker) => {
      markerLayer.removeLayer(marker)
    })
  })
  polygon.found.length = 0
}

function clearMarkers() {
  Object.values(markerLayers).forEach((markerLayer) => {
    markerLayer.clearLayers()
  })
}

function onEachFeature(_: Feature, layer: L.Layer) {
  layer.on({
    mouseover: highlightFeature,
    mouseout: resetHighlight,
    click: selectPolygon,
  })
}

function highlightFeature(e: L.LeafletMouseEvent) {
  if (state.started) return
  const polygon = e.target as Polygon
  if (!selected.value.some((x) => x._leaflet_id === polygon._leaflet_id)) {
    polygon.setStyle(polygonStyles.highlighted())
  }
  select.value = `${getPolygonName(polygon.feature.properties)} ${polygon.found ? '(' + polygon.found.length + ')' : '(0)'}`
}

function resetHighlight(e: L.LeafletMouseEvent) {
  const polygon = e.target as Polygon
  if (!selected.value.some((x) => x._leaflet_id === polygon._leaflet_id)) {
    polygon.setStyle(polygonStyles.removeHighlight())
  }
  select.value = 'Select a country or draw a polygon'
}

const polygonStyles = {
  defaultHidden: () => ({
    opacity: 0,
    fillOpacity: 0,
  }),

  customPolygonStyle: () => ({
    weight: 2,
    color: getRandomColor(),
    fillOpacity: 0,
  }),

  highlighted: () => ({
    fillColor: getRandomColor(),
    fillOpacity: 0.5,
  }),

  removeHighlight: () => ({
    fillOpacity: 0,
  }),
}

function getRandomColor() {
  const red = Math.floor(((1 + Math.random()) * 256) / 2)
  const green = Math.floor(((1 + Math.random()) * 256) / 2)
  const blue = Math.floor(((1 + Math.random()) * 256) / 2)
  return 'rgb(' + red + ', ' + green + ', ' + blue + ')'
}

const icons = {
  gen1: L.icon({ iconUrl: markerGreen, iconAnchor: [12, 41] }),
  gen2Or3: L.icon({ iconUrl: markerViolet, iconAnchor: [12, 41] }),
  gen4: L.icon({ iconUrl: markerBlue, iconAnchor: [12, 41] }),
  newLoc: L.icon({ iconUrl: markerRed, iconAnchor: [12, 41] }),
  noBlueLine: L.icon({ iconUrl: markerPink, iconAnchor: [12, 41] }),
}

export {
  L,
  initMap,
  selectLayer,
  deselectLayer,
  toggleLayer,
  // importLayer,
  exportLayer,
  updateMarkerLayers,
  availableLayers,
  markerLayers,
  updateClusters,
  clearMarkers,
  currentZoom,
  icons,
}
