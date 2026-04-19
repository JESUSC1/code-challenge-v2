import pytest
from datetime import date

from django.shortcuts import reverse

from map.models import CommunityArea, RestaurantPermit


@pytest.fixture
def community_areas_with_permits():
    area1 = CommunityArea.objects.create(name="Hyde Park", area_id=1)
    area2 = CommunityArea.objects.create(name="Lincoln Park", area_id=2)

    # Hyde Park — 2 permits in 2021
    RestaurantPermit.objects.create(
        community_area_id=str(area1.area_id), issue_date=date(2021, 1, 15)
    )
    RestaurantPermit.objects.create(
        community_area_id=str(area1.area_id), issue_date=date(2021, 2, 20)
    )

    # Lincoln Park — 3 permits in 2021
    RestaurantPermit.objects.create(
        community_area_id=str(area2.area_id), issue_date=date(2021, 3, 10)
    )
    RestaurantPermit.objects.create(
        community_area_id=str(area2.area_id), issue_date=date(2021, 2, 14)
    )
    RestaurantPermit.objects.create(
        community_area_id=str(area2.area_id), issue_date=date(2021, 6, 22)
    )

    return area1, area2


# Required: verify the endpoint returns correct permit counts for a given year.
@pytest.mark.django_db
def test_map_data_returns_permit_counts_for_year(client, community_areas_with_permits):
    response = client.get(reverse("map_data"), {"year": 2021})

    assert response.status_code == 200
    data = {item["name"]: item["num_permits"] for item in response.json()}
    assert data["Hyde Park"] == 2
    assert data["Lincoln Park"] == 3


# Edge case: permits from other years must not bleed into the filtered result.
@pytest.mark.django_db
def test_map_data_year_filter_excludes_other_years(client, community_areas_with_permits):
    area1, _ = community_areas_with_permits

    RestaurantPermit.objects.create(
        community_area_id=str(area1.area_id), issue_date=date(2022, 5, 1)
    )

    response = client.get(reverse("map_data"), {"year": 2021})

    assert response.status_code == 200
    data = {item["name"]: item["num_permits"] for item in response.json()}
    assert data["Hyde Park"] == 2


# Edge case: areas with no permits must still appear in the response with 0, not be omitted.
@pytest.mark.django_db
def test_map_data_area_with_no_permits_returns_zero(client):
    CommunityArea.objects.create(name="Loop", area_id=54)

    response = client.get(reverse("map_data"), {"year": 2021})

    assert response.status_code == 200
    data = {item["name"]: item["num_permits"] for item in response.json()}
    assert data["Loop"] == 0


# Edge case: omitting ?year= must return 400 — filtering on None would silently return wrong data.
@pytest.mark.django_db
def test_map_data_missing_year_returns_400(client):
    response = client.get(reverse("map_data"))

    assert response.status_code == 400
