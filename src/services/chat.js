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
/* global angular */

'use strict';

angular.module("FormulaW").factory("chat", ["Messaging", function (Messaging) {
		var listeners = [];

		var service = {
			send: _send,
			localMessage: _processMessage,
			listen: _listen,
			stopListening: _stopListen
		};

		Messaging.register("chatMessage", _processMessage);

		return service;

		function _send(message) {
			Messaging.send("chatMessage", message);
		}

		function _processMessage(message) {
			function buildCall(listener) {
				return function () {
					listener(message);
				};
			}

			for (var i = 0; i < listeners.length; i++) {
				setTimeout(buildCall(listeners[i]), 1);
			}
		}

		function _listen(listener) {
			listeners.push(listener);
		}

		function _stopListen(listener) {
			var index = listeners.indexOf(listener);
			if (index >= 0)
				listeners.splice(index, 1);
		}
	}
]);


