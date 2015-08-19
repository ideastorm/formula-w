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

angular.module('FormulaW').controller('Host', ['$scope', '$location', '$routeParams', 'Messaging', 'Games', 'player', function ($scope, $location, $routeParams, Messaging, Games, player) {
		$scope.mapName = 'Monaco';
		$scope.player = player;
		$scope.starting = false;

		$scope.kick = function (otherPlayer) {
			if ($scope.hosting())
				Messaging.send("kick", {gameId: Games.currentGame.id, userId: otherPlayer.id});
		};

		$scope.ban = function (otherPlayer) {
			if ($scope.hosting())
				Messaging.send("ban", {gameId: Games.currentGame.id, userId: otherPlayer.id});
		};

		$scope.isMe = function (user) {
			return user.id === player.userId;
		}

		$scope.hosting = function () {
			return $scope.players
							&& $scope.players[0]
							&& $scope.players[0].id === player.userId;
		};

		$scope.inGame = function () {
			if ($scope.players) {
				for (var i = 0; i < $scope.players.length; i++) {
					if ($scope.players[i].id === player.userId)
						return true;
				}
			}
			return false;
		};

		$scope.playersReady = function () {
			if ($scope.players && $scope.players.length) {
				for (var i = 0; i < $scope.players.length; i++) {
					if ($scope.players[i].ready === "Not Ready")
						return false;
				}
				return true;
			}
			return false;
		}

		$scope.start = function () {
			if ($scope.hosting() && $scope.playersReady()) {
				Messaging.send("startGame");
			}
		};

		$scope.$on("$locationChangeStart", function (event) {
			var message;
			if ($scope.starting)
				return;
			if ($scope.hosting()) {
				if ($scope.players.length > 1)
					message = 'Leaving will transfer ownership of the game to another player.  Continue?';
				else
					message = 'Leaving will shut down this game.  Continue?';
			} else if ($scope.inGame()) {
				message = 'Leaving now will remove you from this game.  Continue?';
			} // else you are a spectator
			if (message && !confirm(message)) {
				event.preventDefault();
				return;
			}
			Messaging.send('leave', Games.currentGame.id);
		});

		Messaging.register("startGame", function () {
			$scope.$apply(function () {
				$scope.starting = true;
				$location.url('/play/' + Games.currentGame.id);
			});
		});

		Messaging.register("currentGame", function (data) {
			Games.currentGame = data;
			if (data.players.length === 0)
				$location.url('/');

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
