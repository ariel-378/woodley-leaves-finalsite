# Local demo server. Serves this folder with no-cache headers, so the browser
# always shows your latest edits (no hard-refresh needed).
#
#   python3 serve.py           # http://localhost:8781
#   python3 serve.py 9000      # a port you pick
#   npm run serve              # the same thing
#
# If the default port is busy — usually another copy of this site already
# running — it steps to the next free one and prints where it landed, rather
# than failing with "Address already in use".
import errno
import functools
import http.server
import os
import socketserver
import sys

DEFAULT_PORT = 8781
PORTS_TO_TRY = 20
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()


def requested_port() -> int:
    """A port from the command line, then $PORT, then the default."""
    for arg in sys.argv[1:]:
        if arg.isdigit():
            return int(arg)
    env = os.environ.get("PORT", "")
    return int(env) if env.isdigit() else DEFAULT_PORT


def serve() -> None:
    first = requested_port()
    # An explicit choice is honoured exactly; only the default gets to wander,
    # so `python3 serve.py 9000` never quietly lands somewhere else.
    limit = PORTS_TO_TRY if first == DEFAULT_PORT else 1

    socketserver.TCPServer.allow_reuse_address = True
    handler = functools.partial(Handler, directory=DIRECTORY)

    for port in range(first, first + limit):
        try:
            httpd = socketserver.TCPServer(("", port), handler)
        except OSError as err:
            if err.errno != errno.EADDRINUSE:
                raise
            print(f"  port {port} is in use, trying {port + 1}...")
            continue

        with httpd:
            print(f"Serving {DIRECTORY}")
            print(f"  http://localhost:{port}   (Ctrl+C to stop)")
            try:
                httpd.serve_forever()
            except KeyboardInterrupt:
                print("\nStopped.")
        return

    print(
        f"No free port between {first} and {first + limit - 1}.\n"
        f"Pass one explicitly:  python3 serve.py 9000",
        file=sys.stderr,
    )
    sys.exit(1)


if __name__ == "__main__":
    serve()
