import asyncio
import websockets
import json
from WebSocketClient import WebSocketClient
from threading import Thread

async def handle_user_input(client):
    while True:
        instruction = input("Enter an instruction ('register', 'create', 'lobbies', 'exit'): ")
        if instruction == 'exit':
            await client.websocket.close()
            break

        if instruction == 'register':
            username = input("Enter a username: ")
            await client.register(username)
            
        if instruction == 'create':
            name = input("Enter a lobby name: ")
            password = input("Enter a lobby password: ")
            await client.create(name, password)

        if instruction == 'lobbies':
            await client.lobbies()
        
        if instruction == 'join':
            lobbyID = input("Enter a lobby ID: ")
            password = input("Enter a lobby password: ")
            await client.join(lobbyID, password)

def thread_callback(arg, client):
    asyncio.run(handle_user_input(client))

async def main():
    client = WebSocketClient()
    await client.connect()

    async def handle_broadcast_message(payload):
        status = payload.get('status')
        message = payload.get('message')
        data = payload.get('data')
        if(status == 200):
            print()
            print(f"Success. {message} {data}")
        else:
            print()
            print(f"Error {status}. {message} {data}")
        print()

    await client.on('broadcast', handle_broadcast_message)

    thread = Thread(target = thread_callback, args = (0,client))
    thread.start()

    await client.listen()

asyncio.get_event_loop().run_until_complete(main())