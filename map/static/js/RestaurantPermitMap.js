import React, { useEffect, useState } from "react"

import { MapContainer, TileLayer, GeoJSON } from "react-leaflet"

import "leaflet/dist/leaflet.css"

import RAW_COMMUNITY_AREAS from "../../../data/raw/community-areas.geojson"

function YearSelect({ filterVal, setFilterVal }) {
  // Filter by the permit issue year for each restaurant
  const startYear = 2026
  const years = [...Array(11).keys()].map((increment) => {
    return startYear - increment
  })
  const options = years.map((year) => {
    return (
      <option value={year} key={year}>
        {year}
      </option>
    )
  })

  return (
    <>
      <label htmlFor="yearSelect" className="fs-3">
        Filter by year:{" "}
      </label>
      <select
        id="yearSelect"
        className="form-select form-select-lg mb-3"
        value={filterVal}
        onChange={(e) => setFilterVal(e.target.value)}
      >
        {options}
      </select>
    </>
  )
}

export default function RestaurantPermitMap() {
  // Sequential blue palette (ColorBrewer 4-step) — accessible for color-blind users
  const communityAreaColors = ["#eff3ff", "#bdd7e7", "#6baed6", "#2171b5"]

  const [currentYearData, setCurrentYearData] = useState([])
  const [year, setYear] = useState(2026)
  const [totalPermits, setTotalPermits] = useState(0)
  const [maxNumPermits, setMaxNumPermits] = useState(0)
  const [topArea, setTopArea] = useState(null)
  const [loading, setLoading] = useState(false)

  const yearlyDataEndpoint = `/map-data/?year=${year}`

  // Re-runs whenever yearlyDataEndpoint changes (i.e. when year state updates)
  useEffect(() => {
    setLoading(true)
    fetch(yearlyDataEndpoint)
      .then((res) => res.json())
      .then((data) => {
        setCurrentYearData(data)
        const counts = data.map((area) => area.num_permits)
        setTotalPermits(counts.reduce((a, b) => a + b, 0))
        // Guard against empty array: Math.max() with no args returns -Infinity
        const max = Math.max(...counts, 0)
        setMaxNumPermits(max)
        const top = data.find((area) => area.num_permits === max)
        setTopArea(top ? top.name : null)
      })
      .catch((err) => console.error("Failed to load map data", err))
      .finally(() => setLoading(false))
  }, [yearlyDataEndpoint])

  // Pre-build lookup map so setAreaInteraction doesn't call .find() per feature
  const permitsByName = Object.fromEntries(
    currentYearData.map((area) => [area.name.toUpperCase(), area.num_permits])
  )

  function getColor(percentageOfPermits) {
    // Dividing by maxNumPermits (not total) spreads the color range across
    // the busiest area each year, so sparse years still show meaningful variation.
    if (percentageOfPermits > 0.75) return communityAreaColors[3]
    if (percentageOfPermits > 0.5) return communityAreaColors[2]
    if (percentageOfPermits > 0.25) return communityAreaColors[1]
    return communityAreaColors[0]
  }

  function setAreaInteraction(feature, layer) {
    const areaName = feature.properties.community
    // ?? 0 fallback handles areas present in GeoJSON but missing from the API response
    const numPermits = permitsByName[areaName.toUpperCase()] ?? 0
    const percentage = maxNumPermits > 0 ? numPermits / maxNumPermits : 0
    // Share of the year's total permits — shown in the popup for context
    const share =
      totalPermits > 0 ? ((numPermits / totalPermits) * 100).toFixed(1) : 0

    layer.setStyle({ fillColor: getColor(percentage), fillOpacity: 0.7, weight: 1 })

    // autoClose: false and closeOnClick: false allow multiple popups to stay open simultaneously
    layer.bindPopup(
      `<b>${areaName}</b><br>Permits: ${numPermits.toLocaleString()} (${share}% of total)`,
      { autoClose: false, closeOnClick: false }
    )

    let pinned = false

    layer.on("mouseover", () => {
      layer.setStyle({ weight: 4, color: "#ff7f00" })
      layer.openPopup()
    })

    layer.on("mouseout", () => {
      layer.setStyle({ weight: 1, color: "#3388ff" })
      // Only close the popup if the area hasn't been double-clicked to pin it
      if (!pinned) layer.closePopup()
    })

    // Single click on the area pins/unpins the popup
    layer.on("click", () => {
      pinned = !pinned
      if (!pinned) layer.closePopup()
    })

    // Clicking the popup itself also dismisses it
    layer.on("popupopen", (e) => {
      e.popup.getElement().addEventListener("click", () => {
        pinned = false
        layer.closePopup()
      })
    })

    // Reset pinned state if popup is closed via the X button
    layer.on("popupclose", () => {
      pinned = false
    })
  }

  return (
    <>
      <YearSelect filterVal={year} setFilterVal={setYear} />
      <p className="fs-4">
        Restaurant permits issued this year: {totalPermits.toLocaleString()}
      </p>
      <p className="fs-4">
        Maximum number of restaurant permits in a single area:{" "}
        {maxNumPermits.toLocaleString()}
      </p>
      {topArea && (
        <p className="fs-4">
          Area with the most permits: {topArea}
        </p>
      )}
      <MapContainer
        id="restaurant-map"
        center={[41.88, -87.62]}
        zoom={10}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png"
        />
        {/* key change forces a full re-render so onEachFeature re-runs with fresh data */}
        {currentYearData.length > 0 ? (
          <GeoJSON
            data={RAW_COMMUNITY_AREAS}
            onEachFeature={setAreaInteraction}
            key={`${year}-${maxNumPermits}`}
          />
        ) : null}
      </MapContainer>
      {loading && <p className="text-muted">Loading...</p>}
      <p className="text-muted mt-2">
        Map shading: darker blue indicates more restaurant permits issued in that area.
        Hover over an area to see details. Click to pin the popup — click again to dismiss.
      </p>
    </>
  )
}
