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

angular.module('FormulaW').controller('Host', ['$scope', '$location', '$routeParams', 'Messaging', 'Games', function ($scope, $location, $routeParams, Messaging, Games) {
		$scope.map = 'Monaco';

		$scope.kick = function (player) {
			if ($scope.hosting())
				Messaging.send("kick", {gameId: Games.currentGame.id, userId: player.id});
		};

		$scope.hosting = function () {
			return $scope.players[0].id === Messaging.getUserId();
		};

		$scope.$on("$locationChangeStart", function (event) {
			if (!confirm('Leaving now will remove you from this game.  Continue?'))
				event.preventDefault();
			else
				Messaging.send('leave', Games.currentGame.id);
		});

		Messaging.register("currentGame", function (data) {
			Games.currentGame = data;
			$scope.$apply(function () {
				$scope.players = data.players;
				$scope.map = data.map;
			});
		});

		if ($location.url() === '/host')
			Messaging.send("newGame");
		else {
			Messaging.send("join", $routeParams.game);
		}

	}]);
