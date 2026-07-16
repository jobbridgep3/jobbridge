from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_migrate import Migrate
from flask_socketio import SocketIO
from flask_sqlalchemy import SQLAlchemy

from utils.client_ip import get_client_ip

# No hardcoded engine_options here — Config.SQLALCHEMY_ENGINE_OPTIONS (config.py)
# is the single source of truth for pool settings. Flask-SQLAlchemy dict-merges
# whatever's passed here with app.config, so splitting pool config across both
# files is exactly what caused two prior incidents (a poolclass=None override
# silently reverting to QueuePool defaults, then NullPool having no connection
# ceiling at all) — see config.py for the full story and current settings.
db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
cors = CORS()
socketio = SocketIO(cors_allowed_origins="*", async_mode="eventlet")
limiter = Limiter(key_func=get_client_ip, default_limits=["200 per minute"])
