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
module.exports.addAI = _addAI;
module.exports.removeAI = _removeAI;

var _users = {};
var _byId = {};

function _bind(socket) {
	socket.on('quit', function () {
		if (socket.userId)
			_quit(socket.userId);
	});


	socket.on('checkUser', function (data) {
		if (socket.userId)
			socket.emit('userInfo', _checkUser(data, socket.userId));
	});
}

function _checkUser(user, userId) {
	var oldUser = _byId[userId];
	var userConn = _users[user];
	var valid = (!userConn || userConn === userId);
	if (valid) {
		if (oldUser)
			_users[oldUser] = null;
		_byId[userId] = user;
		_users[user] = userId;
	}
	return {valid: valid};
}

function _quit(user, userId) {
	_users[user] = null;
	_byId[userId] = null;
}

function _lookup(userId) {
	return _byId[userId];
}

var _aiNames = ['XC-A','DriveBot','WishIWasGooGLe','Bowser','Kirby','Galatea','Ferdinand','Tipsy7k','Harley','Quinto'];

function _addAI(userId) {
    var randomInt = Math.ceil(Math.random()*100);
    var name;
    do {
        var index = Math.floor(Math.random()*_aiNames.length);
        name = _aiNames[index]+"-"+randomInt;
    } while (!_checkUser(name, userId).valid);
}

function _removeAI(userId) {
    var user = _lookup(userId);
    _quit(user, userId);
}