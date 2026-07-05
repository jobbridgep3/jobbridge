import eventlet

eventlet.monkey_patch()

from gunicorn.app.wsgiapp import run  # noqa: E402

if __name__ == "__main__":
    run()
