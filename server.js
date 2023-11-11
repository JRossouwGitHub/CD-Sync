const WebSocket = require('ws')
const wss = new WebSocket.Server({ port: 5500 }) // Set the desired port
const uuid = require('uuid')
const clients = new Map()

let players = []
let lobbies = []

const validateRequest = (clientID) => {
    if(players.filter(player => player.id === clientID).length === 1) {
        return true
    } 
    return false
}

const packageResponse = (status, message, data = null) => {
    const response = {
        event: 'broadcast',
        payload: null
    }
    const obj = {}
    if(status){
        obj.status = status
    }
    if(message){
        obj.message = message
    }
    if(data){
        obj.data = data
    }
    response.payload = obj
    return JSON.stringify(response)
}

const broadcast = (ws, message, global = false) => {
    if(global){
        lobbies.map(lobby => {
            if(lobby.players.filter((player) => player.id == clients.get(ws)).length == 1){
                lobby.players.map(player => {
                    let targetClient = Array.from(clients.entries()).find(([_ws, id]) => id === player.id);
                    targetClient[0].send(message)
                })
            }
        })
    } else {
        ws.send(message)
    }
    console.log('Broadcasted message:', message)
}

wss.on('connection', (ws) => {
    const clientID = uuid.v4()
    console.log('Client connected, ID:', clientID)
    clients.set(ws, clientID)

    response = packageResponse(200, 'Connected.', 'Client connected successfully.')
    broadcast(ws, response)

    ws.on('message', (message) => {
        console.log('Received message from client:', clients.get(ws))
        try {
            const data = JSON.parse(message)
            let response
            switch (data.event) {
                case 'register':
                    console.log('Received register instruction:', data.payload)
                    if(validateRequest(clients.get(ws))){
                        response = packageResponse(400, 'Invalid request.', 'Client cannot be registered more than once.')
                    } else {
                        const player = {
                            id: clients.get(ws),
                            username: data.payload.username,
                            owner: false
                        }
                        players.push(player)
                        response = packageResponse(200, 'Player registered.', player)
                    }
                    broadcast(ws, response)
                    break;
                case 'create':
                    console.log('Received create instruction:', data.payload)
                    if(!validateRequest(clients.get(ws))){
                        response = packageResponse(401, 'Invalid request.', 'Requests must be made from registed clients.')
                    } else {
                        players.map((player) => {
                            if(player.id === clients.get(ws)){
                                player.owner = true
                            }
                        })
                        const lobby = {
                            id: uuid.v4(),
                            name: data.payload.name,
                            password: data.payload.password,
                            players: players.filter(player => player.id === clients.get(ws))
                        }
                        lobbies.push(lobby)
                        response = packageResponse(200, 'Lobby created.', lobby)
                    }
                    broadcast(ws, response)
                    break;
                case 'lobbies':
                    console.log('Received lobbies instruction:', data.payload)
                    if(!validateRequest(clients.get(ws))){
                        response = packageResponse(401, 'Invalid request.', 'Requests must be made from registed clients.')
                    } else {
                        response = packageResponse(200, 'List of lobbies.', lobbies)
                    }
                    broadcast(ws, response)
                    break;
                case 'join':
                    console.log('Received join instruction:', data.payload)
                    try{
                        if(!validateRequest(clients.get(ws))){
                            response = packageResponse(401, 'Invalid request.', 'Requests must be made from registed clients.')
                        } else {
                            let lobbyID = data.payload.lobbyID
                            if(lobbies.filter(lobby => lobby.id === lobbyID).length == 0){
                                response = packageResponse(401, 'Invalid request.', 'Lobby not found, please try again.')
                            } else {
                                if(
                                    lobbies.filter((lobby) => {
                                        if(lobby.players.filter(player => player.id === clients.get(ws)).length == 1){
                                            return true
                                        }
                                        return false
                                    }).length == 1
                                ){
                                    response = packageResponse(401, 'Invalid request.', 'Player already in lobby, please leave the lobby before joining another.')
                                } else {
                                    lobbies.map((lobby) => {
                                        if(lobby.id === lobbyID){
                                            lobby.players.push(players.filter(player => player.id === clients.get(ws))[0])
                                        }
                                    })
                                    response = packageResponse(200, 'Lobby joined.', lobbies)
                                }
                            }
                        }
                        broadcast(ws, response, true)
                    } catch(err){
                        console.log(err)
                    }
                    
                    break;
                case 'leave':
                    if(!validateRequest(clients.get(ws))){
                        response = packageResponse(401, 'Invalid request.', 'Requests must be made from registed clients.')
                    } else {
                        
                    }
                    broadcast(ws, response)
                    break;
                default:
                    console.log('Received an unknown instruction:', data.event)
                    if(!validateRequest(clients.get(ws))){
                        response = packageResponse(401, 'Invalid request.', 'Requests must be made from registed clients.')
                    } else {
                        response = packageResponse(400, 'Invalid request.', 'Unknown instruction event.')
                    }
                    broadcast(ws, response)
                    break;
            }
        } catch (error) {
            if(!validateRequest(clients.get(ws))){
                response = packageResponse(401, 'Invalid request.', 'Requests must be made from registed clients.')
            } else {
                response = packageResponse(500, 'Internal server error.', {error: error})
            }
            broadcast(ws, response)
        }
    });

    ws.on('close', () => {
        clients.delete(ws)
        console.log('Client disconnected')
    });
});