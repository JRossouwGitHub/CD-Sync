const { Server } = require("socket.io");
const express = require("express");
const { createServer } = require("http");
const uuid = require('uuid')
const clients = new Map()
const logDebug = false
const logError = true
const adjectives = require('./adjectives.json').data
const nouns = require('./nouns.json').data
const app = express();
const bodyParser = require('body-parser');
app.use(bodyParser.json())
const httpServer = createServer(app);

let players = []
let lobbies = []

const debug = (message, data = null) => {
    if(logDebug){
        console.log(message, data)
    }
}

const error = (message, data = null) => {
    if(logError){
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

const broadcast = (client, message, lobbyID = null) => {
    client.emit('broadcast', message)
    if(lobbyID){
        lobbies.map(lobby => {
            if(lobby.id == lobbyID){
                lobby.players.map(player => {
                    let targetClient = Array.from(clients.entries()).find(([_client, id]) => id === player.id);
                    if(targetClient[0]){
                        targetClient[0].emit('broadcast', message)
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
                    let targetClient = Array.from(clients.entries()).find(([_client, id]) => id === player.id && player.id);
                    if(targetClient[0]){
                        _player[ability].cooldown -= ((_player.ping.time / 1000) + (player.ping.time / 1000))
                        let sync = {
                            player: _player,
                            ability: _player[ability]
                        }
                        let message = packageResponse(200, 'Sync Cooldown.', sync)
                        targetClient[0].emit('broadcast', message)
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
            let targetClient = Array.from(clients.entries()).find(([_client, id]) => id === player.id);
            if(targetClient[0]){
                player.ping.start = Date.now()
                let message = packageResponse(1, 'Ping.', player)
                targetClient[0].emit('broadcast', message)
            }
        }
    }
}

setInterval(() => {
    ping()
}, 100)

const options = { 
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        allowedHeaders: ["Access-Control-Allow-Origin"],
        credentials: true
    }
}

const io = new Server(httpServer, options);

io.on('connection', (client) => {
    const clientID = uuid.v4()
    debug('Client connected, ID:', clientID)
    clients.set(client, clientID)

    response = packageResponse(200, 'Connected.', 'Client connected successfully.')
    broadcast(client, response)

    client.on('message', (message) => {
        debug('Received message from client:', clients.get(client))
        try {
            const data = JSON.parse(message)
            let response
            switch (data.event) {
                case 'pong':
                    debug('Received pong instruction:', data.payload)
                    try{
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
                    } catch(e){
                        error(e)
                    }
                    break;
                case 'register':
                    debug('Received register instruction:', data.payload)
                    try{
                        if(validateRequest(clients.get(client))){
                            response = packageResponse(401, 'Invalid request.', 'Client cannot be registered more than once.')
                        } else {
                            let _adjective = adjectives[Math.floor(Math.random() * adjectives.length)]
                            _adjective = _adjective.charAt(0).toUpperCase() + _adjective.slice(1)
                            let _noun = nouns[Math.floor(Math.random() * nouns.length)]
                            _noun = _noun.charAt(0).toUpperCase() + _noun.slice(1)
                            const player = {
                                id: clients.get(client),
                                username: data.payload.username ?? (_adjective + _noun),
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
                        broadcast(client, response)
                    } catch(e){
                        error(e)
                    }
                    break;
                case 'create':
                    debug('Received create instruction:', data.payload)
                    try{
                        if(!validateRequest(clients.get(client))){
                            response = packageResponse(401, 'Unauthorized request.', 'Requests must be made from registed clients.')
                        } else {
                            players.map((player) => {
                                if(player.id === clients.get(client)){
                                    player.owner = 1
                                }
                            })
                            const lobby = {
                                id: uuid.v4(),
                                name: data.payload.name,
                                password: data.payload.password,
                                players: players.filter(player => player.id === clients.get(client))
                            }
                            lobbies.push(lobby)
                            response = packageResponse(200, 'Lobby created.', lobby)
                        }
                        broadcast(client, response)
                    } catch(e){
                        error(e)
                    }
                    break;
                case 'lobbies':
                    debug('Received lobbies instruction:', data.payload)
                    try{
                        if(!validateRequest(clients.get(client))){
                            response = packageResponse(401, 'Unauthorized request.', 'Requests must be made from registed clients.')
                        } else {
                            response = packageResponse(200, 'List of lobbies.', lobbies)
                        }
                        broadcast(client, response)
                    } catch(e){
                        error(e)
                    }
                    break;
                case 'join':
                    debug('Received join instruction:', data.payload)
                    try{
                        if(!validateRequest(clients.get(client))){
                            response = packageResponse(401, 'Unauthorized request.', 'Requests must be made from registed clients.')
                            broadcast(client, response)
                        } else {
                            let lobbyID = data.payload.lobbyID
                            let lobbyPassword = data.payload.password
                            let _player = players.filter(player => player.id === clients.get(client))[0]
                            if(lobbies.filter(lobby => lobby.id === lobbyID).length == 0){
                                response = packageResponse(400, 'Invalid request.', 'Lobby not found, please try again.')
                                broadcast(client, response)
                            } else {
                                if(
                                    lobbies.filter((lobby) => {
                                        if(lobby.players.filter(player => player.id === clients.get(client)).length == 1){
                                            return true
                                        }
                                        return false
                                    }).length == 1
                                ){
                                    response = packageResponse(400, 'Invalid request.', 'Player already in lobby, please leave the lobby before joining another.')
                                    broadcast(client, response)
                                } else {
                                    let joined = false
                                    lobbies.map((lobby) => {
                                        if(lobby.id === lobbyID && lobby.password === lobbyPassword){
                                            lobby.players.push(players.filter(player => player.id === clients.get(client))[0])
                                            joined = true
                                        }
                                    })
                                    if(joined){
                                        let _lobby = lobbies.filter((lobby) => lobby.id === lobbyID)[0]
                                        response = packageResponse(200, _player.username + ' joined the lobby.', _lobby)
                                        broadcast(client, response, lobbyID)
                                    } 
                                    else {
                                        response = packageResponse(400, 'Invalid request.', 'Password is incorrect.')
                                        broadcast(client, response)
                                    }
                                }
                            }
                        }
                    } catch(e){
                        error(e)
                    }
                    break;
                case 'leave':
                    debug('Received leave instruction:', data.payload)
                    try{
                        if(!validateRequest(clients.get(client))){
                            response = packageResponse(401, 'Unauthorized request.', 'Requests must be made from registed clients.')
                            broadcast(client, response)
                        } else {
                            let lobbyID = data.payload.lobbyID
                            let _player = players.filter(player => player.id === clients.get(client))[0]
                            if(
                                lobbies.filter((lobby) => {
                                    if(lobby.players.filter(player => player.id === clients.get(client)).length == 0){
                                        return false
                                    }
                                    return true
                                }).length == 0
                            )
                            {
                                response = packageResponse(400, 'Invalid request.', 'Player must be in a lobby.')
                                broadcast(client, response)
                            } else {
                                let found = false
                                lobbies.map((lobby) => {
                                    if(lobby.id === lobbyID){
                                        found = true
                                        lobby.players = lobby.players.filter((player) => player.id !== clients.get(client))
                                        if(lobby.players.length == 0){
                                            lobbies = lobbies.filter((lobby) => lobby.id !== lobbyID)
                                        }
                                    }
                                })
                                if(found) {
                                    let _lobby = lobbies.filter((lobby) => lobby.id === lobbyID)[0]
                                    response = packageResponse(200, _player.username + ' left the lobby.', _lobby)
                                    broadcast(client, response, lobbyID)
                                } else {
                                    response = packageResponse(400, 'Invalid request.', 'Lobby not found, please try again.')
                                    broadcast(client, response)
                                }
                            }
                        }
                    } catch(e){
                        error(e)
                    }
                    break;
                case 'cast':
                    debug('Received cooldown instruction:', data.payload)
                    try{
                        if(!validateRequest(clients.get(client))){
                            response = packageResponse(401, 'Unauthorized request.', 'Requests must be made from registed clients.')
                            broadcast(client, response)
                        } else {
                            let lobbyID = data.payload.lobbyID
                            let ability = data.payload.ability
                            let _player = lobbies.filter(lobby => lobby.id === lobbyID)[0].players.filter(player => player.id === clients.get(client))[0]
                            if(
                                lobbies.filter((lobby) => {
                                    if(lobby.players.filter(player => player.id === clients.get(client)).length == 0){
                                        return false
                                    }
                                    return true
                                }).length == 0
                            )
                            {
                                response = packageResponse(400, 'Invalid request.', 'Player must be in a lobby.')
                                broadcast(client, response)
                            } else {
                                let found = false
                                let _cdPlayer
                                lobbies.map((lobby) => {
                                    if(lobby.id === lobbyID){
                                        found = true
                                        lobby.players.map((player) => {
                                            if(player.id == _player.id && player.enabled == 1 && player[ability].enabled == 1){
                                                _cdPlayer = JSON.parse(JSON.stringify(player))
                                            }
                                        })
                                    }
                                })
                                if(found) {
                                    SyncCooldown(lobbyID, _cdPlayer, ability)
                                } else {
                                    response = packageResponse(400, 'Invalid request.', 'Lobby not found, please try again.')
                                    broadcast(client, response)
                                }
                            }
                        }
                    } catch(e){
                        error(e)
                    }
                    break;
                case 'toggle':
                    debug('Received a toggle instruction:', data.payload)
                    try{
                        if(!validateRequest(clients.get(client))){
                            response = packageResponse(401, 'Unauthorized request.', 'Requests must be made from registed clients.')
                        } else {
                            let lobbyID = data.payload.lobbyID
                            let _player = JSON.parse(data.payload.player.replace(/'/g, '\"'))
                            let _owner = players.filter(player => player.id == clients.get(client))[0]
                            let _lobby = lobbies.filter(lobby => lobby.id == lobbyID)[0]
                            if(_owner.owner == false){
                                response = packageResponse(400, 'Invalid request.', 'Only the lobby owner can toggle cooldowns.')
                            } else {
                                let toggled = false
                                if(_lobby.players.filter(player => player.id == _player.id).length == 1){
                                    lobbies = lobbies.map((lobby) => {
                                        if (lobby.id == _lobby.id) {
                                            lobby.players = lobby.players.map((player) => {
                                                if (player.id == _player.id) {
                                                    toggled = true
                                                    return _player
                                                }
                                                return player
                                            })
                                        }
                                        return lobby
                                    })
                                } 
                                if(toggled){
                                    response = packageResponse(200, 'Success.', 'Toggled cooldowns on ' + _player.username)
                                } 
                                else {
                                    response = packageResponse(400, 'Invalid request.', 'Unable to toggle cooldowns.')
                                }
                            }
                        }
                        broadcast(client, response)
                    } catch(e){
                        error(e)
                    }
                    break;
                case 'start':
                    debug('Received a start instruction:', data.payload)
                    try{
                        if(!validateRequest(clients.get(client))){
                            response = packageResponse(401, 'Unauthorized request.', 'Requests must be made from registed clients.')
                            broadcast(client, response)
                        } else {
                            let lobbyID = data.payload.lobbyID
                            if(lobbies.filter(lobby => lobby.id === lobbyID).length == 0){
                                response = packageResponse(400, 'Invalid request.', 'Lobby not found, please try again.')
                                broadcast(client, response)
                            } else {
                                let _lobby = lobbies.filter((lobby) => lobby.id === lobbyID)[0]
                                response = packageResponse(200, 'Lobby started.', _lobby)
                                broadcast(client, response, lobbyID)
                            }
                        }
                    } catch(e){
                        error(e)
                    }
                    break;
                default:
                    debug('Received an unknown instruction:', data.event)
                    if(!validateRequest(clients.get(client))){
                        response = packageResponse(401, 'Unauthorized request.', 'Requests must be made from registed clients.')
                    } else {
                        response = packageResponse(400, 'Invalid request.', 'Unknown instruction event.')
                    }
                    broadcast(client, response)
                    break;
            }
        } catch (e) {
            error(e)
            if(!validateRequest(clients.get(client))){
                response = packageResponse(401, 'Unauthorized request.', 'Requests must be made from registed clients.')
            } else {
                response = packageResponse(500, 'Internal server error.', {error: e})
            }
            broadcast(client, response)
        }
    });

    client.on('disconnect', () => {
        let _lobby = []
        lobbies.map((lobby) => {
            if(lobby.players.filter((player) => player.id === clients.get(client)).length == 1){
                _lobby = lobby
                lobby.players = lobby.players.filter((player) => player.id !== clients.get(client))
                if(lobby.players.length == 0){
                    lobbies = lobbies.filter((_lobby) => _lobby.id !== lobby.id)
                }
            }
        })
        response = packageResponse(200, 'Player left the lobby.', _lobby)
        broadcast(client, response, _lobby.id)
        clients.delete(client)
        debug('Client disconnected')
    });
});

httpServer.listen(5500);