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
var runtime = require('./runtime');
var chat = require('./chat');

app.use(express.static('public'));

io.on('connection', function (socket) {
	socket.on("userId", function (data) {
		console.log("userId " + data + " connected");
		socket.userId = data;
		socket.emit("userName", players.lookup(data));
	});

	games.bind(socket, io, players);
	players.bind(socket);
	runtime.bind(socket, io, games);
        chat.bind(socket, io, players);

	socket.on('disconnect', function () {

	});
});

http.listen(1618, function () {
});