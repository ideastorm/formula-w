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

angular.module('FormulaW').factory("Messaging", ['$location', function ($location) {
			var _socket = io($location.protocol() + "://" + $location.host() + ":" + $location.port() + "/");

			var service = {
				register : _register,
				send : _send
			};

			return service;

			function _register(event, callback) {
				console.log("registering callback for " + event);
				_socket.on(event, function (message) {
					console.log("received " + event);
					callback(message);
				});
			}

			function _send(event, message) {
				console.log("sending " + message + " to " + event);
				_socket.emit(event, message);
			}
		}
	]);
