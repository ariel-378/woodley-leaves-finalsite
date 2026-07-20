# Local demo server. Serves this folder on http://localhost:8781 with no-cache
# headers, so the browser always shows your latest edits (no hard-refresh needed).
# Run it in your own terminal:  python3 serve.py    (Ctrl+C to stop)
import http.server, socketserver, functools, os

PORT = 8781
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()


handler = functools.partial(Handler, directory=DIRECTORY)
socketserver.TCPServer.allow_reuse_address = True
print(f"Serving {DIRECTORY}\n  http://localhost:{PORT}   (Ctrl+C to stop)")
with socketserver.TCPServer(("", PORT), handler) as httpd:
    httpd.serve_forever()
