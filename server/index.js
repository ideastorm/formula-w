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


var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var games = require('./games');
var players = require('./players');
games.setPlayers(players);
games.setIO(io);

app.use(express.static('public'));

io.on('connection', function (socket) {
	socket.on("userId", function (data) {
		console.log("userId " + data + " connected");
		socket.userId = data;
		socket.emit("userName", players.lookup(data));
	});

	socket.on('disconnect', function () {

	});

	socket.on('quit', function () {
		if (socket.userId)
			players.quit(socket.userId);
	});

	socket.on('queryList', function () {
		console.log("retrieving list of games");
		socket.emit('gameList', games.getList());
	});

	socket.on('checkUser', function (data) {
		if (socket.userId)
			socket.emit('userInfo', players.checkUser(data, socket.userId));
	});

	socket.on('newGame', function () {
		if (socket.userId) {
			var game = games.create(socket.userId);
			socket.emit('currentGame', game);
			socket.join(game.id);
		}
		io.emit("gameList", games.getList());
	});

	socket.on('join', function (gameId) {
		if (socket.userId) {
			socket.join(gameId);
			games.joinGame(gameId, socket.userId);
		}
	});

	socket.on('leave', function (gameId) {
		socket.leave(gameId);
		if (socket.userId) {
			games.removeFromGame(gameId, socket.userId);
		}
	});

	socket.on('kick', function (message) {
		games.removeFromGame(message.gameId, message.userId);
	});

});

http.listen(1618, function () {
});