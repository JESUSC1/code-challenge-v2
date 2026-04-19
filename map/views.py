import os

from django.shortcuts import render
from django.views.generic import TemplateView
from django.db.models import Count

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response

from map.models import CommunityArea, RestaurantPermit
from map.serializers import CommunityAreaSerializer


class Home(TemplateView):
    template_name = "map/home_page.html"


class MapDataView(APIView):
    def get(self, request):
        year = request.query_params.get("year")
        if not year:
            return Response(
                {"error": "year query parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Single aggregation query groups all permits by area for the selected year
        # Result is sored in a dict for serrializer lookups to avoid N+1 queries
        permit_counts = (
            RestaurantPermit.objects.filter(issue_date__year=year)
            .values("community_area_id")
            .annotate(count=Count("id"))
        )
        counts_by_area = {
            item["community_area_id"]: item["count"] for item in permit_counts
        }

        community_areas = CommunityArea.objects.all()
        serializer = CommunityAreaSerializer(
            community_areas,
            many=True,
            context={"counts": counts_by_area},
        )
        return Response(serializer.data)


def robots_txt(request):
    return render(
        request,
        "map/robots.txt",
        {"ALLOW_CRAWL": True if os.getenv("ALLOW_CRAWL") == "True" else False},
        content_type="text/plain",
    )


def page_not_found(request, exception, template_name="404.html"):
    return render(request, template_name, status=404)


def server_error(request, template_name="500.html"):
    return render(request, template_name, status=500)
