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

angular.module('FormulaW').factory('player', ['$cookies', 'Messaging', '$rootScope', function ($cookies, Messaging, $rootScope) {
		var service = {
			name: '',
			userId: null,
			valid: false,
			findUser: _findUser,
			toggleReady: _toggleReady,
                        guid: _guid
		};

		service.userId = $cookies.get('userId');
		if (!service.userId) {
			service.userId = _guid();
			$cookies.put('userId', service.userId);
		}

		Messaging.register("userName", function (name) {
			$rootScope.$apply(function () {
				service.name = name;
				service.valid = (service.name ? true : false);
			}
			);
		});

		Messaging.register("userInfo", function (userData) {
			$rootScope.$apply(function () {
				service.valid = (service.name ? true : false) && userData.valid;
			});
		});

		Messaging.send('userId', service.userId);

		return service;

		function _toggleReady() {
			Messaging.send('userReady');
		}

		function _findUser(playerList) {
			for (var i = 0; i < playerList.length; i++)
			{
				if (playerList[i].id === service.userId)
					return playerList[i];
			}
			return null;
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

