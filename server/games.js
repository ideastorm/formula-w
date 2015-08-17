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

module.exports.getList = _getList;
module.exports.create = _create;
module.exports.joinGame = _joinGame;
module.exports.removeFromGame = _removeFromGame;
module.exports.setPlayers = function (players) {
	_players = players;
}
module.exports.setIO = function (io) {
	_io = io;
}

var _games = [];
var _players;
var _io;

function _create(hostUserId) {
	var time = Date.now();
	var game = {
		map: 'Monaco',
		players: [{id: hostUserId, name: _players.lookup(hostUserId)}],
		maxPlayers: 10,
		running: false,
		id: hostUserId + time
	};
	_games.push(game);
	return game;
}

function _getList() {
	return _games;
}

function _findGame(gameId) {
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

function _joinGame(gameId, userId) {
	var gameIndex = _findGame(gameId);
	if (gameIndex !== null) {
		var game = _games[gameIndex];
		var playerName = _players.lookup(userId);
		game.players.push({id: userId, name: playerName});
		_io.to(gameId).emit('currentGame', game);
		_io.emit('gameList', _games);
	}
}

function _removeFromGame(gameId, userId) {
	var gameIndex = _findGame(gameId);
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




