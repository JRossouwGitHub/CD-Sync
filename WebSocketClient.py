import asyncio
import websockets
import json

class WebSocketClient:
    def __init__(self):
        self.websocket = None
        self.event_handlers = {}

    async def connect(self):
        self.websocket = await websockets.connect('ws://localhost:5500')

    async def on(self, event, handler):
        self.event_handlers[event] = handler

    async def listen(self):
        while True:
            message = await self.websocket.recv()
            data = json.loads(message)
            event = data.get('event')
            payload = data.get('payload')
            if event and event in self.event_handlers:
                handler = self.event_handlers[event]
                await handler(payload)
            else:
                print(f"Received unknown event: {event}")

    async def send(self, message):
        await self.websocket.send(message)

    async def register(self, username):
        message = json.dumps({"event": "register", "payload": {"username": username}})
        await self.send(message)

    async def create(self, name, password):
        message = json.dumps({"event": "create", "payload": {"name": name, "password": password}})
        await self.send(message)

    async def lobbies(self):
        message = json.dumps({"event": "lobbies", "payload": {}})
        await self.send(message)

    async def join(self, lobbyID, password):
        message = json.dumps({"event": "join", "payload": {"lobbyID": lobbyID, "password": password}})
        await self.send(message)

    async def leave(self, lobbyID):
        message = json.dumps({"event": "leave", "payload": {"lobbyID": lobbyID}})
        await self.send(message)
