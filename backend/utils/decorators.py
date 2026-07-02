from functools import wraps

from flask_jwt_extended import get_jwt, verify_jwt_in_request

from utils.responses import fail


def role_required(*allowed_roles):
    """Restrict a route to specific JWT role claims. Use after @jwt_required()."""

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            claims = get_jwt()
            role = claims.get("role")
            if role not in allowed_roles:
                return fail("You do not have permission to access this resource.", 403)
            return fn(*args, **kwargs)

        return wrapper

    return decorator


def staff_or_admin(fn):
    return role_required("staff", "admin")(fn)
