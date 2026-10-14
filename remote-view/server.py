"""Relay server: pairs a host (the shared PC) with viewers (phone/browser)."""
import argparse, hmac, json, secrets
from pathlib import Path
from aiohttp import web, WSMsgType

WEB = Path(__file__).parent / "web"
sessions = {}  # code -> {"host": ws, "password": str, "viewers": set}


async def host_ws(request):
    ws = web.WebSocketResponse(max_msg_size=16 * 2**20)
    await ws.prepare(request)
    code = f"{secrets.randbelow(10**9):09d}"
    password = f"{secrets.randbelow(10**6):06d}"
    s = {"host": ws, "password": password, "viewers": set()}
    sessions[code] = s
    await ws.send_json({"type": "ready", "code": code, "password": password})
    try:
        async for msg in ws:
            if msg.type == WSMsgType.BINARY:
                for v in list(s["viewers"]):
                    if v.closed:
                        s["viewers"].discard(v)
                    elif not getattr(v, "busy", False):  # drop frames for slow viewers
                        v.busy = True
                        try:
                            await v.send_bytes(msg.data)
                        finally:
                            v.busy = False
    finally:
        sessions.pop(code, None)
        for v in list(s["viewers"]):
            await v.close()
    return ws


async def view_ws(request):
    ws = web.WebSocketResponse()
    await ws.prepare(request)
    first = await ws.receive_json()  # {"code":..., "password":...}
    s = sessions.get(str(first.get("code", "")).replace(" ", ""))
    if not s or not hmac.compare_digest(str(first.get("password", "")), s["password"]):
        await ws.send_json({"type": "error", "message": "קוד או סיסמה שגויים"})
        await ws.close()
        return ws
    s["viewers"].add(ws)
    await ws.send_json({"type": "ok"})
    try:
        async for msg in ws:
            if msg.type == WSMsgType.TEXT and not s["host"].closed:
                await s["host"].send_str(msg.data)  # forward input events
    finally:
        s["viewers"].discard(ws)
    return ws


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--host", default="0.0.0.0")
    p.add_argument("--port", type=int, default=8080)
    a = p.parse_args()
    app = web.Application()
    app.add_routes([
        web.get("/ws/host", host_ws),
        web.get("/ws/view", view_ws),
        web.get("/", lambda r: web.FileResponse(WEB / "index.html")),
    ])
    web.run_app(app, host=a.host, port=a.port)


if __name__ == "__main__":
    main()
