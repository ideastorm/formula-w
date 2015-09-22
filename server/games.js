/* 
 * Copyright 2015 Phillip Hayward <phil@pjhayward.net>.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

module.exports.bind = _bind;
module.exports.lookup = _lookup;
module.exports.getPlayerIndex = _findPlayerIndex;
module.exports.gameOver = _gameOver;

var _games = [];
var _players;
var _io;
var _playerGames = {};
var _maps = require('../shared/maps');
var deepCopy = require('./deepCopy');

function _lookup(socket) {
    if (socket.userId && _playerGames[socket.userId]) {
        return _findGame(_playerGames[socket.userId]);
    }
    return null;
}

function _bind(socket, io, players) {
    _io = io;
    _io.users = {};
    _players = players;
    socket.on('queryList', function () {
        console.log("retrieving list of games");
        socket.emit('gameList', _getList());
    });

    socket.on('newGame', function () {
        if (socket.userId) {
            _io.users[socket.userId] = socket.id;
            var game;
            if (_playerGames[socket.userId]) {
                socket.leave(_playerGames[socket.userId]);
                _removeFromGame(_playerGames[socket.userId], socket.userId);
            }
            game = _create(socket.userId, socket.id);
            _playerGames[socket.userId] = game.id;
            if (game) {
                socket.emit('currentGame', game);
                socket.gameId = game.id;
                socket.join(game.id);
            }
        }
        _io.emit("gameList", _getList());
    });

    socket.on('join', function (gameId) {
        if (socket.userId) {
            _io.users[socket.userId] = socket.id;
            if (_playerGames[socket.userId] && _playerGames[socket.userId] !== gameId) {
                socket.leave(_playerGames[socket.userId]);
                _removeFromGame(_playerGames[socket.userId], socket.userId);
            }
            _playerGames[socket.userId] = gameId;
            socket.join(gameId);
            socket.gameId = gameId;
            _joinGame(gameId, socket.userId, socket.id);
        }
    });

    socket.on('userReady', function () {
        if (socket.userId && _playerGames[socket.userId]) {
            var game = _findGame(_playerGames[socket.userId]);
            if (game) {
                var playerIndex = _findPlayerIndex(game, socket.userId);
                if (playerIndex >= 0) {
                    game.players[playerIndex].ready = 'Ready';
                } else {
                    _playerGames[socket.userId] = null;
                }
                socket.join(game.id);
                socket.gameId = game.id;
                _io.to(game.id).emit('currentGame', game);
            }
        }
    });

    socket.on('leave', function (gameId) {
        socket.leave(gameId);
        socket.gameId = null;
        if (socket.userId) {
            _playerGames[socket.userId] = null;
            _removeFromGame(gameId, socket.userId);
        }
    });

    socket.on('kick', function (message) {
        _playerGames[message.userId] = null;
        _removeFromGame(message.gameId, message.userId);
    });

    socket.on('ban', function (message) {
        _playerGames[message.userId] = null;
        _banFromGame(message.gameId, message.userId);
    });

    socket.on('startGame', function () {
        if (socket.userId && _playerGames[socket.userId]) {
            var game = _findGame(_playerGames[socket.userId]);
            if (game) {
                game.running = true;
                game.map = deepCopy(_maps[game.mapName]);
                game.winners = [];
                _finalizeMap(game.map);
                _randomizePlayers(game);
                _assignStartSpaces(game);
                game.activePlayer = game.playerOrder.shift();
                _initializeDamage(game);
                _io.to(game.id).emit("currentGame", game);
                _io.to(game.id).emit('startGame');
            }
        }
    });

    socket.on('selectCar', function (data) {
        if (socket.userId && _playerGames[socket.userId]) {
            var game = _findGame(_playerGames[socket.userId]);
            if (game) {
                var playerIndex = _findPlayerIndex(game, socket.userId);
                if (playerIndex >= 0) {
                    var player = game.players[playerIndex];
                    var message = {
                        removed: data
                    };
                    if (player.car)
                        message.added = player.car;
                    player.car = data;
                    _io.to(game.id).emit('updateCars', message);
                    _io.to(game.id).emit('currentGame', game);
                }
            }
        }
    });
}

function _create(hostUserId, socketId) {
    var time = Date.now();
    var game = {
        mapName: 'Monaco',
        players: [{id: hostUserId, name: _players.lookup(hostUserId), ready: 'Not Ready', socket: socketId, activeGear: 0}],
        banned: [],
        running: false,
        laps: 2,
        id: hostUserId + time
    };
    game.maxPlayers = _maps[game.mapName].startSpaces.length;
    _games.push(game);
    return game;
}

function _getList() {
    return _games;
}

function _findGame(gameId) {
    var index = _findGameIndex(gameId);
    if (index !== null)
        return _games[index];
    return null;
}

function _findGameIndex(gameId) {
    for (var i = 0; i < _games.length; i++) {
        if (_games[i].id === gameId)
            return i;
    }
    return null;
}

function _findPlayerIndex(game, userId) {
    for (var i = 0; i < game.players.length; i++) {
        if (game.players[i].id === userId)
            return i;
    }
    return -1;
}

function _joinGame(gameId, userId, socketId) {
    var gameIndex = _findGameIndex(gameId);
    if (gameIndex !== null) {
        var game = _games[gameIndex];
        var playerIndex = _findPlayerIndex(game, userId);
        if (!game.running  && game.players.length < game.maxPlayers && playerIndex < 0 && game.banned.indexOf(userId) < 0)
        {
            var playerName = _players.lookup(userId);
            game.players.push({id: userId, name: playerName, ready: 'Not Ready', socket: socketId, activeGear: 0});
        }
        _io.emit('gameList', _games);
        _io.to(gameId).emit('currentGame', game);
    }
}

function _gameOver(game) {
    var gameIndex= _findGameIndex(game.id);
    if (gameIndex !== null) {
        _games.splice(gameIndex,1);
    }
    _io.emit('gameList', _games);
}

function _removeFromGame(gameId, userId) {
    var gameIndex = _findGameIndex(gameId);
    if (gameIndex !== null) {
        var game = _games[gameIndex];
        var index = _findPlayerIndex(game, userId);
        if (index >= 0)
            game.players.splice(index, 1);
        if (!game.players.length)
            _games.splice(gameIndex, 1);
        _io.to(gameId).emit('currentGame', game);
        _io.emit('gameList', _games);
    }
}

function _banFromGame(gameId, userId) {
    var gameIndex = _findGameIndex(gameId);
    if (gameIndex !== null) {
        var game = _games[gameIndex];
        game.banned.push(userId);
        var index = _findPlayerIndex(game, userId);
        if (index >= 0)
            game.players.splice(index, 1);
        if (!game.players.length)
            _games.splice(gameIndex, 1);
        _io.to(gameId).emit('currentGame', game);
        _io.emit('gameList', _games);
    }
}

function _randomizePlayers(game) {
    var i;
    var playerIds = [];
    var orderedIds = [];
    for (i = 0; i < game.players.length; i++) {
        var id = Math.random();
        playerIds.push(id);
        orderedIds.push(id);
    }
    orderedIds.sort();
    game.playerOrder = [];
    var orderedPlayers = [];
    for (i = 0; i < playerIds.length; i++) {
        orderedPlayers.push(game.players[playerIds.indexOf(orderedIds[i])]);
        game.playerOrder.push(i);
    }
}

function _assignStartSpaces(game) {
    var i;
    if (game.map) {
        console.log(game.playerOrder);
        for (i = 0; i < game.playerOrder.length; i++) {
            var player = game.players[game.playerOrder[i]];
            player.location = game.map.startSpaces[i];
            player.lap = 0;
            player.currentCorner = null;
            player.cornerStops = 0;
            switch (game.map.spaces[player.location].corridor) {
                case -1:
                    player.allowIn = false;
                    player.allowOut = true;
                    break;
                case 0:
                    player.allowIn = true;
                    player.allowOut = false;
                    break;
                case 1:
                    player.allowIn = true;
                    player.allowOut = false;
                    break;
            }
        }
    }
}

function _initializeDamage(game) {
    if (!game)
        return;
    for (var i = 0; i < game.players.length; i++) {
        if (!game.advanced) {
            game.players[i].damage = 20;
        } else {
            game.players[i].damage = {
                engine: 6,
                transmission: 6,
                tires: 10,
                brakes: 6,
                suspension: 6,
                body: 6
            };
        }
    }
}

function _finalizeMap(map) {
    for (var i = 0; i < map.spaces.length; i++) {
        var space = map.spaces[i];
        space.inside = null;
        space.outside = null;
        space.forward = null;

        var spaceInner = _isInner(i);
        var spaceOuter = _isOuter(i);
        space.corridor = spaceInner ? -1 : spaceOuter ? 1 : 0;
        if (space.moveTargets.length === 1) {
            space.forward = space.moveTargets[0];
        } else {
        for (var j = 0; j < space.moveTargets.length; j++) {
            var target = space.moveTargets[j];
            var targetInner = _isInner(target);
            var targetOuter = _isOuter(target);
            if (spaceInner && targetInner)
                space.forward = target;
            else if (spaceInner && !targetInner) {
                if (!space.outside)
                    space.outside = target;
                else
                    space.inside = target;
            }
            else if (spaceOuter && targetOuter)
                space.forward = target;
            else if (spaceOuter && !targetOuter)
                space.inside = target;
            else if (targetOuter)
                space.outside = target;
            else if (targetInner)
                space.inside = target;
            else
                space.forward = target;
        }
        }

        space.corner = null;
    }

    for (var cornerIndex in map.corners)
    {
        var corner = map.corners[cornerIndex];
        for (var spaceIndex = 0; spaceIndex < corner.spaces.length; spaceIndex++) {
            map.spaces[corner.spaces[spaceIndex]].corner = +cornerIndex + 1;
        }
    }

    function _isInner(spaceIndex) {
        return map.insideCorridors.indexOf(spaceIndex) >= 0;
    }

    function _isOuter(spaceIndex) {
        return map.outsideCorridors.indexOf(spaceIndex) >= 0;
    }
}