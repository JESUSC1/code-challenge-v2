from rest_framework import serializers

from map.models import CommunityArea


class CommunityAreaSerializer(serializers.ModelSerializer):
    class Meta:
        model = CommunityArea
        fields = ["area_id", "name", "num_permits"]

    num_permits = serializers.SerializerMethodField()

    def get_num_permits(self, obj):
        """
        Return the number of restaurant permits issued in this community area
        for the selected year. The view pre-computes counts in a single query
        and passes them via serializer context to avoid N+1 queries.
        """
        counts = self.context.get("counts", {})
        return counts.get(str(obj.area_id), 0)
