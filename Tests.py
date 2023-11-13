import asyncio
import websockets
import json
from WebSocketClient import WebSocketClient
from threading import Thread

async def handle_user_input(client):
    while True:
        instruction = input("Enter an instruction ('register', 'create', 'lobbies', 'join', 'leave', 'cast', 'exit'): ")
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
        
        if instruction == 'leave':
            lobbyID = input("Enter a lobby ID: ")
            await client.leave(lobbyID)

        if instruction == 'cast':
            lobbyID = input("Enter a lobby ID: ")
            ability = input("Enter an ability ('ability1', 'ability2', 'ability3', 'ability4', 'ability5', 'ability6'): ")
            await client.cast(lobbyID, ability)

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
        elif(status == 1):
            await client.pong()
        else:
            print()
            print(f"Error {status}. {message} {data}")

    await client.on('broadcast', handle_broadcast_message)

    thread = Thread(target = thread_callback, args = (0,client))
    thread.start()

    await client.listen()

asyncio.get_event_loop().run_until_complete(main())
