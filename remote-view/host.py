"""Host agent: runs on the PC you want to watch. Streams the screen as JPEG frames."""
import argparse, asyncio, io, json
import aiohttp, mss
from PIL import Image


def grab(sct, mon, scale, quality):
    shot = sct.grab(mon)
    img = Image.frombytes("RGB", shot.size, shot.bgra, "raw", "BGRX")
    if scale < 1:
        img = img.resize((int(img.width * scale), int(img.height * scale)))
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=quality)
    return buf.getvalue(), shot.size


def handle_input(ev, mon, gui):
    """ev coords are 0..1 relative to the shared screen."""
    x = mon["left"] + ev.get("x", 0) * mon["width"]
    y = mon["top"] + ev.get("y", 0) * mon["height"]
    t = ev["type"]
    if t == "move": gui.moveTo(x, y)
    elif t == "click": gui.click(x, y, button=ev.get("button", "left"))
    elif t == "scroll": gui.scroll(int(ev.get("dy", 0)))
    elif t == "key": gui.press(ev["key"])
    elif t == "text": gui.write(ev["text"])


async def run(url, fps, scale, quality, control):
    gui = None
    if control:
        import pyautogui
        pyautogui.FAILSAFE = False
        gui = pyautogui
    with mss.mss() as sct:
        mon = sct.monitors[1]
        async with aiohttp.ClientSession() as http, http.ws_connect(url + "/ws/host", max_msg_size=0) as ws:
            info = await ws.receive_json()
            print(f"\n  קוד:   {info['code']}\n  סיסמה: {info['password']}\n"
                  f"  שליטה מרחוק: {'פעילה' if control else 'כבויה (צפייה בלבד)'}\n")

            async def reader():
                async for m in ws:
                    if m.type == aiohttp.WSMsgType.TEXT and gui:
                        try: handle_input(json.loads(m.data), mon, gui)
                        except Exception as e: print("input error:", e)

            task = asyncio.create_task(reader())
            while not ws.closed:
                data, _ = await asyncio.to_thread(grab, sct, mon, scale, quality)
                await ws.send_bytes(data)
                await asyncio.sleep(1 / fps)
            task.cancel()


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--server", default="ws://localhost:8080")
    p.add_argument("--fps", type=int, default=10)
    p.add_argument("--scale", type=float, default=0.6)
    p.add_argument("--quality", type=int, default=55)
    p.add_argument("--allow-control", action="store_true", help="אפשר שליטה בעכבר/מקלדת")
    a = p.parse_args()
    asyncio.run(run(a.server.rstrip("/"), a.fps, a.scale, a.quality, a.allow_control))
