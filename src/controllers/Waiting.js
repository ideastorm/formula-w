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

angular.module('FormulaW').filter('prettifyFileName', function () {
	function prettifyFileName(input) {
		input = input.replace('.png', '');
		var result = '';
		var lastChar = ' ';
		for (var i = 0; i < input.length; i++) {
			var char = input.charAt(i);
			if (char === '_')
				char = ' ';
			if (lastChar === ' ')
				char = char.toUpperCase();
			result += char;
			lastChar = char;
		}

		return result;
	}
	return prettifyFileName;
});
angular.module('FormulaW').controller('Waiting', ['$scope', '$location', '$routeParams', 'Messaging', 'Games', 'player', function ($scope, $location, $routeParams, Messaging, Games, player) {
			$scope.player = player;
			$scope.lapCount = 2;
			$scope.lapOptions = [{
					count : 1
				}, {
					count : 2
				}, {
					count : 3
				}, {
					count : 4
				}, {
					count : 5
				}, {
					count : 6
				}, {
					count : 7
				}, {
					count : 8
				}, {
					count : 9
				}, {
					count : 10
				}
			];
			$scope.starting = false;
			$scope.mapNames = [];
			for (var mapName in require('../../shared/maps'))
				$scope.mapNames.push(mapName);
			$scope.mapNames.sort();
			$scope.mapName = 'Monaco';
			$scope.cars = require('../../shared/cars');

			$scope.damageMode = function () {
				return $scope.advancedDamage ? "Advanced" : "Basic";
			};

			$scope.updateMap = function () {};
			$scope.updateLaps = function () {
				if ($scope.hosting() && !$scope.isRunning())
					Messaging.send("updateGame", {
						gameId : Games.currentGame.id,
						settings : {
							laps : $scope.lapCount
						}
					});
			};
			$scope.updateDamage = function () {
				if ($scope.hosting() && !$scope.isRunning())
					Messaging.send("updateGame", {
						gameId : Games.currentGame.id,
						settings : {
							advanced : ($scope.advancedDamage ? true : false)
						}
					});
			};

			$scope.kick = function (otherPlayer) {
				if ($scope.hosting() && !$scope.isRunning())
					Messaging.send("kick", {
						gameId : Games.currentGame.id,
						userId : otherPlayer.id
					});
			};

			$scope.ban = function (otherPlayer) {
				if ($scope.hosting() && !$scope.isRunning())
					Messaging.send("ban", {
						gameId : Games.currentGame.id,
						userId : otherPlayer.id
					});
			};

			$scope.isMe = function (user) {
				return user.id === player.userId;
			};

			$scope.isRunning = function () {
				return $scope.game.running;
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
			};

			$scope.start = function () {
				if ($scope.hosting() && $scope.playersReady()) {
					Messaging.send("startGame");
				}
			};

			$scope.updateCars = function (car) {
				Messaging.send("selectCar", car);
			};

			$scope.$on("$locationChangeStart", function (event) {
				if ($scope.isRunning())
					return;
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
					$scope.game = Games.currentGame;
					$scope.players = data.players;
					$scope.map = data.map;

					for (var i = 0; i < $scope.players.length; i++)
						_removeCar($scope.players[i].car);
				});
			});

			function _removeCar(car) {
				var index = $scope.cars.indexOf(car);
				if (index >= 0)
					$scope.cars.splice(index, 1);
			}

			if ($location.url() === '/host')
				Messaging.send("newGame");
			else {
				Messaging.send("join", $routeParams.game);
			}

			Messaging.register("updateCars", function (data) {
				$scope.$apply(function () {
					if (data.added) {
						var index = $scope.cars.indexOf(data.added);
						if (index < 0)
							$scope.cars.push(data.added);
					}
					if (data.removed) {
						_removeCar(data.removed);
					}
					$scope.cars.sort();
				});
			});

		}
	]);
