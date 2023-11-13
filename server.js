const WebSocket = require('ws')
const wss = new WebSocket.Server({ port: 5500 }) // Set the desired port
const uuid = require('uuid')
const clients = new Map()
const logDebug = false

let players = []
let lobbies = []

const debug = (message, data = null) => {
    if(logDebug){
        console.log(message, data)
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

const SyncCooldown = (lobbyID, _player, ability) => {
    lobbies.map(lobby => {
        if(lobby.id == lobbyID){
            lobby.players.map(player => {
                if(player.id != _player.id){
                    let targetClient = Array.from(clients.entries()).find(([_ws, id]) => id === player.id && player.id);
                    if(targetClient[0]){
                        _player[ability].cooldown -= ((_player.ping.time / 1000) + (player.ping.time / 1000))
                        let sync = {
                            player: _player,
                            ability: _player[ability]
                        }
                        let message = packageResponse(200, 'Sync Cooldown.', sync)
                        targetClient[0].send(message)
                        debug('Broadcasted sync message: ', message)
                    }
                }
            })
        }
    })
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
                        response = packageResponse(401, 'Invalid request.', 'Client cannot be registered more than once.')
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
                            },
                            enabled: true,
                            ability1: {
                                key: data.payload.ability1?.key ?? 'Q',
                                cooldown: data.payload.ability1?.cooldown ?? 1.5,
                                enabled: true
                            },
                            ability2: {
                                key: data.payload.ability2?.key ?? 'W',
                                cooldown: data.payload.ability2?.cooldown ?? 3,
                                enabled: true
                            },
                            ability3: {
                                key: data.payload.ability3?.key ?? 'E',
                                cooldown: data.payload.ability3?.cooldown ?? 7,
                                enabled: true
                            },
                            ability4: {
                                key: data.payload.ability4?.key ?? 'R',
                                cooldown: data.payload.ability4?.cooldown ?? 15,
                                enabled: true
                            },
                            ability5: {
                                key: data.payload.ability5?.key ?? 'D',
                                cooldown: data.payload.ability5?.cooldown ?? 23,
                                enabled: true
                            },
                            ability6: {
                                key: data.payload.ability6?.key ?? 'F',
                                cooldown: data.payload.ability6?.cooldown ?? 12,
                                enabled: true
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
                        response = packageResponse(401, 'Unauthorized request.', 'Requests must be made from registed clients.')
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
                        response = packageResponse(401, 'Unauthorized request.', 'Requests must be made from registed clients.')
                    } else {
                        response = packageResponse(200, 'List of lobbies.', lobbies)
                    }
                    broadcast(ws, response)
                    break;
                case 'join':
                    debug('Received join instruction:', data.payload)
                    try{
                        if(!validateRequest(clients.get(ws))){
                            response = packageResponse(401, 'Unauthorized request.', 'Requests must be made from registed clients.')
                            broadcast(ws, response)
                        } else {
                            let lobbyID = data.payload.lobbyID
                            let lobbyPassword = data.payload.password
                            let _player = players.filter(player => player.id === clients.get(ws))[0]
                            if(lobbies.filter(lobby => lobby.id === lobbyID).length == 0){
                                response = packageResponse(400, 'Invalid request.', 'Lobby not found, please try again.')
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
                                    response = packageResponse(400, 'Invalid request.', 'Player already in lobby, please leave the lobby before joining another.')
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
                                        let _lobby = lobbies.filter((lobby) => lobby.id === lobbyID)
                                        response = packageResponse(200, _player.username + ' joined the lobby.', _lobby)
                                        broadcast(ws, response, lobbyID)
                                    } 
                                    else {
                                        response = packageResponse(400, 'Invalid request.', 'Password is incorrect.')
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
                        response = packageResponse(401, 'Unauthorized request.', 'Requests must be made from registed clients.')
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
                            response = packageResponse(400, 'Invalid request.', 'Player must be in a lobby.')
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
                                let _lobby = lobbies.filter((lobby) => lobby.id === lobbyID)
                                response = packageResponse(200, _player.username + ' left the lobby.', _lobby)
                                broadcast(ws, response, lobbyID)
                            } else {
                                response = packageResponse(400, 'Invalid request.', 'Lobby not found, please try again.')
                                broadcast(ws, response)
                            }
                        }
                    }
                    break;
                case 'cast':
                    debug('Received cooldown instruction:', data.payload)

                    if(!validateRequest(clients.get(ws))){
                        debug('Invalid cast request')
                        response = packageResponse(401, 'Unauthorized request.', 'Requests must be made from registed clients.')
                        broadcast(ws, response)
                    } else {
                        let lobbyID = data.payload.lobbyID
                        let ability = data.payload.ability
                        let _player = players.filter(player => player.id === clients.get(ws))[0]
                        debug('Player: ', _player)
                        if(
                            lobbies.filter((lobby) => {
                                if(lobby.players.filter(player => player.id === clients.get(ws)).length == 0){
                                    return false
                                }
                                return true
                            }).length == 0
                        )
                        {
                            debug('Player must be in a lobby')
                            response = packageResponse(400, 'Invalid request.', 'Player must be in a lobby.')
                            broadcast(ws, response)
                        } else {
                            let found = false
                            let _cdPlayer
                            lobbies.map((lobby) => {
                                if(lobby.id === lobbyID){
                                    found = true
                                    lobby.players.map((player) => {
                                        if(player.id == _player.id && player.enabled == true && player[ability].enabled == true){
                                            _cdPlayer = player
                                            debug('Found player: ', _cdPlayer)
                                        }
                                    })
                                }
                            })
                            if(found) {
                                debug('Starting Sync Event')
                                SyncCooldown(lobbyID, _cdPlayer, ability)
                                debug('Ended Sync Event')
                            } else {
                                response = packageResponse(400, 'Invalid request.', 'Lobby not found, please try again.')
                                broadcast(ws, response)
                            }
                        }
                    }
                    break;
                default:
                    debug('Received an unknown instruction:', data.event)
                    if(!validateRequest(clients.get(ws))){
                        response = packageResponse(401, 'Unauthorized request.', 'Requests must be made from registed clients.')
                    } else {
                        response = packageResponse(400, 'Invalid request.', 'Unknown instruction event.')
                    }
                    broadcast(ws, response)
                    break;
            }
        } catch (error) {
            if(!validateRequest(clients.get(ws))){
                response = packageResponse(401, 'Unauthorized request.', 'Requests must be made from registed clients.')
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