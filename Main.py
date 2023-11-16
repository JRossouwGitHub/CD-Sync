import wx
from GUI import MyFrame
import asyncio
import websockets
from WebSocketClient import WebSocketClient
from threading import Thread

def on_exit(client):
    asyncio.run(client.websocket.close())  # Close the WebSocket connection
    wx.GetApp().GetTopWindow().Destroy()

async def on_connect(frame, client):
    await client.register(frame.settings_panel.settings_data)

def add_lobby(lobbies):
    active_frame = wx.GetApp().GetTopWindow()
    active_frame.lobby_panel.lobby_data = lobbies
    for lobby in lobbies:
        wx.CallAfter(active_frame.lobby_panel.add_lobby_item, lobby)

async def handle_broadcast_message(client, payload):
    status = payload.get('status')
    message = payload.get('message')
    data = payload.get('data')
    if status == 200:
        print(f"Success. {message} {data}")
        if message == "Player registered.":
            await client.lobbies()

        if message == "List of lobbies.":
            add_lobby(data)

    elif status == 1:
        await client.pong()
    else:
        print(f"Error {status}. {message} {data}")

def run_gui(arg, client):
    app = wx.App(False)
    frame = MyFrame(None, title="CD Sync v1.0.0 - By Odious", size=(800, 600))
    frame.Bind(wx.EVT_CLOSE, frame.on_exit)
    app.SetTopWindow(frame)
    # Center the frame on the screen
    frame.Center()

    frame.Show()

    # Start the event loop in the background thread
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(on_connect(frame, client))
    loop.run_until_complete(client.on('broadcast', handle_broadcast_message))

    app.MainLoop()

def main():
    client = WebSocketClient()
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    gui_thread = Thread(target=run_gui, args=(0, client))
    gui_thread.start()

    loop.run_until_complete(client.connect())
    loop.run_until_complete(client.listen())

if __name__ == "__main__":
    main()
