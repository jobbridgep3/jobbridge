from flask import jsonify


def ok(data=None, message="OK", status=200):
    return jsonify({"success": True, "data": data, "message": message}), status


def fail(message="An error occurred", status=400, data=None):
    return jsonify({"success": False, "data": data, "message": message}), status
