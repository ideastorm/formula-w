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

angular.module('FormulaW').factory("Messaging", ['$location', function ($location) {
		var service = {};

		try {
			var ws = new WebSocket("ws://" + $location.host() + ":" + $location.port() + "/socket/");
			ws.onmessage = function (message) {
				_process(JSON.parse(message.data));
			};
		} catch (error) {
			console.log(error);
			alert("Failed to construct a web socket");
		}

		return service;

		function _process(message) {
			console.log(message);
		}
	}]);
