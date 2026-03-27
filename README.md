# DataMade Code Challenge: React Map

![2026 DataMade Code Challenge](https://github.com/datamade/code-challenge-v2/blob/main/map/static/images/2026-datamade-code-challenge.jpg)

Welcome to the 2026 DataMade code challenge! 👋

## Overview

Your task is to complete the following programming exercise to show us some of your code! This exercise is based on work that DataMade does every day: pulling data from the web, debugging tricky code, and presenting information to the world.

Submissions should be submitted as a pull request against your fork of this original repository. **Make sure to make your pull request against your own fork of the repository, not the original DataMade repository**.

There’s no time limit, but don’t feel the need to go over the top with your submission. We expect this task to take about two hours to complete, but it could take more or less time depending on your familiarity with Django and React. When you’re all set, share your code with us as a repository on GitHub.

We’ll be evaluating whether the code works, as well as its quality. Before submitting, make sure that your code does what you expect it to do, that it’s clean and neat enough to meet your standards, and that you’ve provided us some instructions on how to run it.

## Installation

Development requires a local installation of [Docker](https://docs.docker.com/get-started/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/). These are the only two system-level dependencies you should need.

Once you have Docker and Docker Compose installed, build the application containers from the project's root directory:

```bash
docker compose build
```

Load in the data:

```bash
docker compose run --rm app python manage.py loaddata map/fixtures/restaurant_permits.json map/fixtures/community_areas.json
```

And finally, run the app:

```bash
docker compose up
```

The app will log to the console, and you should be able to visit it at http://localhost:8000

## Completing the Challenge

Once you have the app up and running on your computer, you'll need to flesh out certain code blocks to make the map functional. You'll be using [Django](https://docs.djangoproject.com/en/6.0/) and [React-Leaflet](https://react-leaflet.js.org/docs/api-components/) to complete this task. By the end of this challenge, you should have:

- a map that displays Chicago's community areas, shaded depending on how many new restaurant permits were issued in a given year
- community area shapes that show some light details on that community area when a user interacts with them
- a filter that allows users to request permits that were issued in a given year
- UI components that display the total number of permits and max number of permits in one community area for that year

This way you go about completing these goals is meant to be open-ended, so tackle the following steps in whatever way you're most comfortable!

### Step 1: Supplement the community area geojson data

In `map/serializers.py`, supplement each community area with data on the amount of permits issued in each area during the currently filtered year. From here, the view will pass that data to the front end.

### Step 2: Write a test for your data endpoint

In `tests/test_views.py` implement a test to validate the data that your endpoint produces. You will want to create some test `CommunityArea` and `RestaurantPermit` objects and then assert that the expected values are returned when querying the endpoint.

Use this command to run tests:

```bash
docker compose -f docker-compose.yml -f tests/docker-compose.yml run --rm app
```

### Step 3: Filter results by a specific year

In `map/static/js/RestaurantPermitMap.js`, create a filter that allows users to send a request for a specific year to the backend. The options shoulds be any year between 2016 and 2026, inclusive. Then, use the fetch api in the map component to make a request and receive that data.

### Step 4: Display results on the page

In the map component, process the community area and use it to display shapes for all areas on the map. Then, display the total number of restaurant permits that year as well as the maximum number of permits in any one area.

### Step 5: Make the map dynamic

Start displaying some data! Use the `setAreaInteraction()` method to shade the map according to how many permits it has in a year, making sure that it updates automatically when a new year is selected. In this same method, have each area display a popup during some kind of user interaction. The popup should have some light details to help the user understand what they're looking at.

---

## Implementation Notes

The following documents what was changed to complete each step and the reasoning behind key decisions.

> **Note:** I completed this challenge with the assistance of [Claude Code](https://claude.ai/code). I have a Python background but limited Django experience, so I used it to navigate the framework, understand patterns like serializer context and DRF views, and validate decisions along the way.

### Step 1: Supplement the community area GeoJSON data

**File:** `map/serializers.py` · `map/views.py`

`CommunityAreaSerializer` exposes a `num_permits` field via `SerializerMethodField`. Rather than querying the database once per community area (an N+1 problem across ~77 areas), the view pre-computes all permit counts in a single aggregation query and passes the result as serializer context:

```python
# views.py — one query, not 77
permit_counts = (
    RestaurantPermit.objects.filter(issue_date__year=year)
    .values("community_area_id")
    .annotate(count=Count("id"))
)
counts_by_area = {item["community_area_id"]: item["count"] for item in permit_counts}
```

The serializer then does a simple dict lookup per area. Areas with no permits return `0` rather than being omitted, so the frontend always receives a complete list.

The view also returns a `400` if `?year=` is missing — filtering on `None` would silently return wrong data.

### Step 2: Write a test for your data endpoint

**File:** `tests/test_views.py`

| Test | What it checks |
|---|---|
| `test_map_data_returns_permit_counts_for_year` | Correct counts returned for a given year |

**Additional edge cases:**

| Test | What it checks |
|---|---|
| `test_map_data_year_filter_excludes_other_years` | Permits from other years don't bleed in |
| `test_map_data_area_with_no_permits_returns_zero` | Areas with no permits still appear with `num_permits: 0` |
| `test_map_data_missing_year_returns_400` | Missing `?year=` query param returns HTTP 400 |

A shared `community_areas_with_permits` fixture creates two areas (Beverly, Lincoln Park) with known permit counts so each test assertion is explicit and easy to follow. The built-in `client` fixture from `conftest.py` is used directly since it already enforces SSL — no need for `APIClient`.

> **Troubleshooting — port 5432 already in use**
>
> If you see `ports are not available: exposing port TCP 0.0.0.0:5432`, a local PostgreSQL instance is running and blocking the test container. First stop the app stack if it's running:
> ```bash
> docker compose down
> ```
> Then find and stop the conflicting process:
> ```bash
> sudo lsof -i :5432        # find the PID
> sudo kill -9 <PID>        # stop it
> ```
> Or if it's a Homebrew-managed Postgres:
> ```bash
> brew services list        # find the exact service name
> brew services stop postgresql@<version>
> ```

### Step 3: Filter results by a specific year

**File:** `map/static/js/RestaurantPermitMap.js`

`YearSelect` is a dropdown component that generates year options from 2016–2026 dynamically (counting down from 2026) rather than listing each year manually.

When the user picks a year, the dropdown calls `setFilterVal` which updates the `year` value stored in the parent component's state. That `year` is used to build the API URL (`/map-data/?year=2021`), and React's `useEffect` hook watches that URL — think of it as "whenever this URL changes, go fetch new data." So selecting a new year automatically triggers a fresh request to the backend with no extra wiring needed.

### Step 4: Display results on the page

**File:** `map/static/js/RestaurantPermitMap.js`

After each fetch, two summary stats are computed from the response:

- **Total permits** — sum of all `num_permits` values
- **Max permits** — `Math.max(...counts, 0)`, where the trailing `0` guards against an empty array returning `-Infinity`

Both are rendered above the map and formatted with `.toLocaleString()` for readability (e.g. `1,234` instead of `1234`). A `loading` flag is set around the fetch so a brief indicator is shown while data is in flight.

### Step 5: Make the map dynamic

**File:** `map/static/js/RestaurantPermitMap.js`

`getColor(percentage)` uses a 4-step ColorBrewer blue palette and divides a community area's permit count by `maxNumPermits` (not the total). This stretches the color range across the busiest area each year, so even low-volume years show meaningful variation rather than everything appearing as the lightest shade.

`setAreaInteraction(feature, layer)` applies the choropleth fill and binds three interactions per area:

- `mouseover` — highlights the border (orange, weight 4) and opens a popup with the area name, permit count, and share of total
- `mouseout` — restores default style and closes the popup unless pinned
- `click` — toggles a pinned state so the popup stays open after mouseout; clicking the popup itself or the X also dismisses it

Multiple popups can be open simultaneously via `autoClose: false, closeOnClick: false` on `bindPopup`.

**Accessibility:** The single-hue blue scale varies by lightness, not hue — safe across all common types of color blindness. The orange hover border (`#ff7f00`) provides maximum contrast against blue and a weight increase gives a non-color cue. A legend note below the map explains the shading.

A `permitsByName` lookup dict is built once outside `setAreaInteraction` to avoid a `.find()` call per feature. The `<GeoJSON key>` forces a full re-render on year change since React-Leaflet does not re-run `onEachFeature` on prop updates alone.

**Stats display** shows total permits, max permits per area, and the name of the top area — each on its own line above the map.

---

### Step 6: Submit your work

To submit your work, create a feature branch for your code, commit your changes, push your commits up to your fork, and open up a pull request against main. Finally, drop a link to your pull request in your application.

_Note: If you would prefer to keep your code challenge private, please share access with the following members of DataMade on GitHub:_

| Member    | GitHub Account                   |
| --------- | -------------------------------- |
| Hannah    | https://github.com/hancush       |
| Derek     | https://github.com/derekeder     |
| Monkruman | https://github.com/antidipyramid |
| Xavier    | https://github.com/xmedr         |
| Hayley    | https://github.com/haowens       |

Keep in mind that you cannot create a private fork of a public repository on GitHub, so you’ll need to [follow these instructions](https://gist.github.com/0xjac/85097472043b697ab57ba1b1c7530274) to create a private copy of the repo.

---

## Data Observations

Across all years, the same community areas — particularly **Near North Side** and other centrally located neighborhoods — consistently receive the majority of new restaurant permits. These areas correspond to Chicago's more affluent corridors, where capital investment is concentrated and new establishments open at a higher rate.

The contrast with areas on the west and south sides is visible year over year: lighter shading persists regardless of the year selected, suggesting those communities see comparatively little new restaurant activity. This pattern reflects broader economic inequality in the city — the permit data is one signal of where investment flows and where it doesn't.

This is worth keeping in mind when interpreting the map, and reinforces why normalized shading would be a more honest representation of growth versus absolute volume, see future work.

---

## Future Work

| Area | Description |
|---|---|
| **Dependency management** | Replace `requirements.txt` with `uv` or `poetry` for a proper lockfile, dependency resolution, and separation of dev vs prod dependencies |
| **Accessibility — audio** | Add `aria-live` announcements or Web Audio API tones on hover for users with visual impairments |
| **Frontend testing** | Add Jest + React Testing Library to cover `YearSelect`, `getColor`, and the fetch/state logic in `RestaurantPermitMap` |
| **Database performance** | Add indexes on `RestaurantPermit.community_area_id` and `issue_date` to speed up the aggregation query as the dataset grows |
| **Frontend error state** | The `.catch()` currently logs to the console only — surface a visible error message to the user when the API request fails |
| **Dynamic year range** | The 2016–2026 range is hardcoded in the frontend — derive it from the earliest/latest `issue_date` in the database so it stays current without a code change |
| **Normalized shading** | Current shading uses raw permit counts, which biases toward high-density areas. Shading by permits per existing restaurant would normalize for area size and better surface neighborhoods with proportionally high new permit activity |
| **Map legend** | Add a color scale legend to the map showing what each shade represents — especially important if normalized shading is implemented, as the scale would no longer be self-evident from the stats above the map |