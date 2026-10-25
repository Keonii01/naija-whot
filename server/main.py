import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from room_manager import RoomManager

app = FastAPI()

@app.get("/health")
async def health_check():
    return {"status": "ok"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

manager = RoomManager()


@app.websocket("/ws/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    if not (16 <= len(token) <= 64):
        await websocket.close(code=1008)
        return
    await websocket.accept()
    pid = manager.register(token, websocket)
    await manager.send(pid, {"type": "welcome", "player_id": pid})
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except json.JSONDecodeError:
                continue
            if not isinstance(msg, dict):
                continue
            await manager.handle_message(pid, msg)
    except WebSocketDisconnect:
        await manager.disconnect(pid, websocket)