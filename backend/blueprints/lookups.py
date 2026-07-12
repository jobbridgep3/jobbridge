from flask import Blueprint, request
from flask_jwt_extended import jwt_required

from services import psgc_service
from utils.responses import ok

lookups_bp = Blueprint("lookups", __name__, url_prefix="/api/lookups")


@lookups_bp.get("/psgc/regions")
@jwt_required()
def psgc_regions():
    return ok(psgc_service.get_regions())


@lookups_bp.get("/psgc/provinces")
@jwt_required()
def psgc_provinces():
    return ok(psgc_service.get_provinces(request.args.get("region_code", "")))


@lookups_bp.get("/psgc/cities")
@jwt_required()
def psgc_cities():
    return ok(psgc_service.get_cities(request.args.get("province_code", "")))


@lookups_bp.get("/psgc/barangays")
@jwt_required()
def psgc_barangays():
    return ok(psgc_service.get_barangays(request.args.get("city_municipality_code", "")))
