import json
import math

import pytest

from app.services.geo import (
    INDIA_STATES_AND_UTS,
    CoordinateError,
    check_india_coordinates,
    haversine_km,
    load_boundary,
    normalize_state,
    point_in_polygons,
)

# Approximate town-centre coordinates across states and union territories.
INDIAN_PLACES = [
    ("Kochi", "Kerala", 9.931, 76.267),
    ("Jaipur", "Rajasthan", 26.912, 75.787),
    ("Srinagar", "Jammu and Kashmir", 34.083, 74.797),
    ("Leh", "Ladakh", 34.152, 77.577),
    ("Port Blair", "Andaman and Nicobar Islands", 11.623, 92.726),
    ("Kavaratti", "Lakshadweep", 10.566, 72.642),
    ("Bhuj", "Gujarat", 23.242, 69.666),
    ("Kanyakumari", "Tamil Nadu", 8.088, 77.538),
    ("Joshimath", "Uttarakhand", 30.555, 79.565),
    ("Shimla", "Himachal Pradesh", 31.104, 77.173),
    ("Darjeeling", "West Bengal", 27.041, 88.266),
    ("Mumbai", "Maharashtra", 19.076, 72.878),
    ("Bhubaneswar", "Odisha", 20.296, 85.825),
    ("Panaji", "Goa", 15.491, 73.828),
    ("Tawang", "Arunachal Pradesh", 27.586, 91.866),
    ("Aizawl", "Mizoram", 23.727, 92.718),
]

OUTSIDE = [
    ("London", 51.507, -0.128),
    ("Karachi", 24.861, 67.010),
    ("Kunming", 25.040, 102.710),
    ("Singapore", 1.352, 103.820),
    ("Dubai", 25.204, 55.270),
    ("Null Island", 0.0, 0.0),
]

# Inside the bounding envelope although outside India: the documented limitation of envelope-only checks.
ENVELOPE_LIMITATION = [("Kathmandu", 27.717, 85.324), ("Colombo", 6.927, 79.861), ("Dhaka", 23.810, 90.412)]


@pytest.mark.parametrize("name,state,lat,lon", INDIAN_PLACES)
def test_places_across_india_are_accepted(name, state, lat, lon):
    assert check_india_coordinates(lat, lon) == "india_envelope"
    assert state in INDIA_STATES_AND_UTS


@pytest.mark.parametrize("name,lat,lon", OUTSIDE)
def test_places_outside_india_are_rejected(name, lat, lon):
    with pytest.raises(CoordinateError, match="outside India"):
        check_india_coordinates(lat, lon)


@pytest.mark.parametrize("lat,lon", [(math.nan, 77.0), (28.6, math.inf), (95.0, 77.0), (28.6, 190.0)])
def test_invalid_numbers_are_rejected(lat, lon):
    with pytest.raises(CoordinateError):
        check_india_coordinates(lat, lon)


# A deliberately simple SYNTHETIC test polygon (not a real boundary): a box with a hole.
SYNTHETIC_BOUNDARY = {
    "type": "FeatureCollection",
    "features": [{
        "type": "Feature",
        "properties": {"note": "synthetic test geometry"},
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [[68, 6], [98, 6], [98, 38], [68, 38], [68, 6]],
                [[84, 27], [86, 27], [86, 28.5], [84, 28.5], [84, 27]],  # hole
            ],
        },
    }],
}


def test_envelope_only_check_has_a_documented_limitation():
    for _, lat, lon in ENVELOPE_LIMITATION:
        assert check_india_coordinates(lat, lon) == "india_envelope"


def test_boundary_file_rejects_points_outside_polygon(tmp_path):
    path = tmp_path / "boundary.geojson"
    path.write_text(json.dumps(SYNTHETIC_BOUNDARY), encoding="utf-8")
    assert check_india_coordinates(31.104, 77.173, str(path)) == "india_boundary"  # Shimla, inside
    with pytest.raises(CoordinateError, match="boundary"):
        check_india_coordinates(27.717, 85.324, str(path))  # inside the hole


def test_point_in_multipolygon():
    polys = [
        [[(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0), (0.0, 0.0)]],
        [[(20.0, 20.0), (30.0, 20.0), (30.0, 30.0), (20.0, 30.0), (20.0, 20.0)]],
    ]
    assert point_in_polygons(5, 5, polys)
    assert point_in_polygons(25, 25, polys)
    assert not point_in_polygons(15, 15, polys)


def test_boundary_file_without_polygons_is_an_error(tmp_path):
    path = tmp_path / "empty.geojson"
    path.write_text(json.dumps({"type": "FeatureCollection", "features": []}), encoding="utf-8")
    with pytest.raises(ValueError):
        load_boundary(str(path))


@pytest.mark.parametrize("raw,expected", [
    ("kerala", "Kerala"),
    ("  Tamil   Nadu ", "Tamil Nadu"),
    ("Jammu & Kashmir", "Jammu and Kashmir"),
    ("NCT of Delhi", "Delhi"),
    ("Orissa", "Odisha"),
    ("Uttaranchal", "Uttarakhand"),
    ("Pondicherry", "Puducherry"),
    ("Daman and Diu", "Dadra and Nagar Haveli and Daman and Diu"),
    ("Atlantis", None),
    ("", None),
    (None, None),
])
def test_normalize_state(raw, expected):
    assert normalize_state(raw) == expected


def test_states_list_is_complete():
    assert len(INDIA_STATES_AND_UTS) == 36 == len(set(INDIA_STATES_AND_UTS))


def test_haversine_known_distance():
    # Delhi to Mumbai is roughly 1,150 km in a straight line.
    assert 1100 < haversine_km(28.614, 77.209, 19.076, 72.878) < 1200
