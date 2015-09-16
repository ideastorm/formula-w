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
angular.module('FormulaW').controller('Browser', ['$scope', '$location', 'Games', 'player', 'notifications', function ($scope, $location, Games, player, notifications) {
		$scope.games = [];
		$scope.player = player;
		Games.update($scope, function (gameList) {
			$scope.games = gameList;
		});
		$scope.join = function (game) {
			notifications.requestNotification();
			if (game.running) {
				$location.url('/play/' + game.id);
			} else {
				$location.url('/join/' + game.id);
			}
		};
		$scope.joinText = function (game) {
			if (game.running || game.players.length >= game.maxPlayers) {
				return "Watch";
			}
			return "Join";
		};

		$scope.startGame = function () {
			notifications.requestNotification();
			$location.url('/host');
		};
	}]);