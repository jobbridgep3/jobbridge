from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_mail import Mail
from flask_migrate import Migrate
from flask_socketio import SocketIO
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.pool import NullPool

db = SQLAlchemy(engine_options={"poolclass": NullPool, "pool_pre_ping": True})
migrate = Migrate()
jwt = JWTManager()
mail = Mail()
cors = CORS()
socketio = SocketIO(cors_allowed_origins="*", async_mode="eventlet")
limiter = Limiter(key_func=get_remote_address, default_limits=["200 per minute"])
