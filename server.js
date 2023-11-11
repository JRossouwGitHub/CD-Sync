const WebSocket = require('ws')
const wss = new WebSocket.Server({ port: 5500 }) // Set the desired port
const uuid = require('uuid')
const clients = new Map()
const logDebug = false

let players = []
let lobbies = []

const debug = (message) => {
    if(logDebug){
        console.log(message)
    }
}

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

const broadcast = (ws, message, lobbyID = null) => {
    ws.send(message)
    if(lobbyID){
        lobbies.map(lobby => {
            if(lobby.id == lobbyID){
                lobby.players.map(player => {
                    let targetClient = Array.from(clients.entries()).find(([_ws, id]) => id === player.id);
                    if(targetClient[0]){
                        targetClient[0].send(message)
                    }
                })
            }
        })
    } 
    debug('Broadcasted message:', message)
}

const ping = () => {
    for(let i = 0; i < lobbies.length; i++){
        let lobby = lobbies[i]
        for(let j = 0; j < lobby.players.length; j++){
            let player = lobby.players[j]
            let targetClient = Array.from(clients.entries()).find(([_ws, id]) => id === player.id);
            if(targetClient[0]){
                player.ping.start = Date.now()
                let message = packageResponse(1, 'Ping.', player)
                targetClient[0].send(message)
            }
        }
    }
}

setInterval(() => {
    ping()
}, 100)

wss.on('connection', (ws) => {
    const clientID = uuid.v4()
    debug('Client connected, ID:', clientID)
    clients.set(ws, clientID)

    response = packageResponse(200, 'Connected.', 'Client connected successfully.')
    broadcast(ws, response)

    ws.on('message', (message) => {
        debug('Received message from client:', clients.get(ws))
        try {
            const data = JSON.parse(message)
            let response
            switch (data.event) {
                case 'pong':
                    debug('Received pong instruction:', data.payload)
                    for(let i = 0; i < lobbies.length; i++){
                        let lobby = lobbies[i]
                        for(let j = 0; j < lobby.players.length; j++){
                            let player = lobby.players[j]
                            player.ping.end = Date.now()
                            let pingDelta = player.ping.end - player.ping.start
                            player.pings.push(pingDelta)
                            if(player.pings.length > 10){
                                player.pings.shift()
                            }
                            player.ping.time = (player.pings.reduce((a, b) => a + b, 0) / player.pings.length)
                        }
                    }
                    break;
                case 'register':
                    debug('Received register instruction:', data.payload)
                    if(validateRequest(clients.get(ws))){
                        response = packageResponse(400, 'Invalid request.', 'Client cannot be registered more than once.')
                    } else {
                        const player = {
                            id: clients.get(ws),
                            username: data.payload.username,
                            owner: false,
                            pings: [],
                            ping: {
                                start: 0,
                                end: 0,
                                time: 0
                            }
                        }
                        players.push(player)
                        response = packageResponse(200, 'Player registered.', player)
                    }
                    broadcast(ws, response)
                    break;
                case 'create':
                    debug('Received create instruction:', data.payload)
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
                    debug('Received lobbies instruction:', data.payload)
                    if(!validateRequest(clients.get(ws))){
                        response = packageResponse(401, 'Invalid request.', 'Requests must be made from registed clients.')
                    } else {
                        response = packageResponse(200, 'List of lobbies.', lobbies)
                    }
                    broadcast(ws, response)
                    break;
                case 'join':
                    debug('Received join instruction:', data.payload)
                    try{
                        if(!validateRequest(clients.get(ws))){
                            response = packageResponse(401, 'Invalid request.', 'Requests must be made from registed clients.')
                            broadcast(ws, response)
                        } else {
                            let lobbyID = data.payload.lobbyID
                            let lobbyPassword = data.payload.password
                            let _player = players.filter(player => player.id === clients.get(ws))[0]
                            if(lobbies.filter(lobby => lobby.id === lobbyID).length == 0){
                                response = packageResponse(401, 'Invalid request.', 'Lobby not found, please try again.')
                                broadcast(ws, response)
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
                                    broadcast(ws, response)
                                } else {
                                    let joined = false
                                    lobbies.map((lobby) => {
                                        if(lobby.id === lobbyID && lobby.password === lobbyPassword){
                                            lobby.players.push(players.filter(player => player.id === clients.get(ws))[0])
                                            joined = true
                                        }
                                    })
                                    if(joined){
                                        response = packageResponse(200, _player.username + ' joined the lobby.', lobbies)
                                        broadcast(ws, response, lobbyID)
                                    } 
                                    else {
                                        response = packageResponse(401, 'Invalid request.', 'Password is incorrect.')
                                        broadcast(ws, response)
                                    }
                                }
                            }
                        }
                    } catch(err){
                        debug(err)
                    }
                    
                    break;
                case 'leave':
                    debug('Received leave instruction:', data.payload)
                    if(!validateRequest(clients.get(ws))){
                        response = packageResponse(401, 'Invalid request.', 'Requests must be made from registed clients.')
                        broadcast(ws, response)
                    } else {
                        let lobbyID = data.payload.lobbyID
                        let _player = players.filter(player => player.id === clients.get(ws))[0]
                        if(
                            lobbies.filter((lobby) => {
                                if(lobby.players.filter(player => player.id === clients.get(ws)).length == 0){
                                    return false
                                }
                                return true
                            }).length == 0
                        )
                        {
                            response = packageResponse(401, 'Invalid request.', 'Player must be in a lobby.')
                            broadcast(ws, response)
                        } else {
                            let found = false
                            lobbies.map((lobby) => {
                                if(lobby.id === lobbyID){
                                    found = true
                                    lobby.players = lobby.players.filter((player) => player.id !== clients.get(ws))
                                    if(lobby.players.length == 0){
                                        lobbies = lobbies.filter((lobby) => lobby.id !== lobbyID)
                                    }
                                }
                            })
                            if(found) {
                                response = packageResponse(200, _player.username + ' left the lobby.', lobbies)
                                broadcast(ws, response, lobbyID)
                            } else {
                                response = packageResponse(401, 'Invalid request.', 'Lobby not found, please try again.')
                                broadcast(ws, response)
                            }
                        }
                    }
                    break;
                default:
                    debug('Received an unknown instruction:', data.event)
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
        lobbies.map((lobby) => {
            if(lobby.players.filter((player) => player.id === clients.get(ws)).length == 1){
                lobby.players = lobby.players.filter((player) => player.id !== clients.get(ws))
                if(lobby.players.length == 0){
                    lobbies = lobbies.filter((_lobby) => _lobby.id !== lobby.id)
                }
            }
        })
        clients.delete(ws)
        debug('Client disconnected')
    });
});