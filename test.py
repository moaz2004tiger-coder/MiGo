import urllib.request, urllib.error, json
req = urllib.request.Request(
    'http://127.0.0.1:8000/api/download',
    method='POST',
    headers={'Content-Type': 'application/json'},
    data=json.dumps({'url': 'https://youtube.com/watch?v=dQw4w9WgXcQ', 'type': 'video', 'quality': '720p', 'lang': None}).encode('utf-8')
)
try:
    urllib.request.urlopen(req)
except urllib.error.HTTPError as e:
    print(e.read().decode())
