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

var io = require('socket.io-client');

angular.module('FormulaW').factory("Messaging", ['$location', '$cookies', function ($location, $cookies) {
		var _socket = io($location.protocol() + "://" + $location.host() + ":" + $location.port() + "/");
		var _userId = $cookies.get('userId');
		if (!_userId) {
			_userId = _guid();
			$cookies.put('userId', _userId);
		}
		_socket.emit('userId', _userId);

		var service = {
			register: _register,
			send: _send,
			getUserId: _getUserId
		};

		return service;

		function _register(event, callback) {
			console.log("registering callback for " + event);
			_socket.on(event, callback);
		}

		function _send(event, message) {
			console.log("sending " + message + " to " + event);
			_socket.emit(event, message);
		}

		function _getUserId() {
			return _userId;
		}
	}]);

function _guid() { //from http://stackoverflow.com/a/105074/1024576
	function s4() {
		return Math.floor((1 + Math.random()) * 0x10000)
						.toString(16)
						.substring(1);
	}
	return s4() + s4() + '-' + s4() + '-' + s4() + '-' +
					s4() + '-' + s4() + s4() + s4();
}
