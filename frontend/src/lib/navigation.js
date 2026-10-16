// Links that let an administrator travel to (or share) a reported location.

const fmt = (n) => Number(n).toFixed(6).replace(/\.?0+$/, '')

// Google Maps directions from the user's current position to the point.
// On phones this opens the Google Maps app when it is installed.
export function directionsUrl(lat, lon) {
  return `https://www.google.com/maps/dir/?api=1&destination=${fmt(lat)}%2C${fmt(lon)}`
}

// The same point on OpenStreetMap (no Google account or app needed).
export function osmUrl(lat, lon) {
  return `https://www.openstreetmap.org/?mlat=${fmt(lat)}&mlon=${fmt(lon)}#map=17/${fmt(lat)}/${fmt(lon)}`
}

export function coordinateText(lat, lon) {
  return `${fmt(lat)}, ${fmt(lon)}`
}
