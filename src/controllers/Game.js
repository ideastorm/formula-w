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

angular.module('FormulaW').controller('Game', ['$scope', '$routeParams', '$location', 'Games', 'Messaging', 'player', 'chat', 'notifications', function ($scope, $routeParams, $location, Games, Messaging, player, chat, notifications) {
			var gameView = document.getElementById('fw-game-view');
			var game = $scope.game = Games.currentGame;
			var messageQueue = [];

			notifications.requestNotification();

			$scope.animationClass = function (player) {
				return "animate-move-" + player.speed;
			};

			$scope.gear = 0;
			$scope.buildIconStyle = function (item) {
				var space;
				if (typeof item.location === 'number') {
					if (item.location === -1) {
						return "display:none";
					}
					space = game.map.spaces[item.location];
				} else if (typeof item.space === 'number') {
					space = game.map.spaces[item.space];
				} else {
					console.log(item);
					return '';
				}
				var left = space.x;
				var top = space.y;
				var theta = space.theta;
				if (item.destroy)
					theta = 0;
				return {
					left : left + 'px',
					top : top + 'px',
					transform : 'rotate(' + theta + 'deg)',
					'-webkit-transform' : 'rotate(' + theta + 'deg)'
				};
			};

			$scope.damageIndex = function (moveOption) {
				if (moveOption.destroy)
					return "death";
				var damage = moveOption.totalDamage;
				if (damage > 5)
					return 5;
				if (damage < 0)
					return 0;
				return damage;
			};

			$scope.otherDamageIndex = function (moveOption) {
				return moveOption.destroy ? "death" : "black";
			};

			$scope.damageLeft = function (player) {
				if (!game.advanced) {
					return player.damage;
				} else
					return "Adv. Dmg not implemented";
			};
			$scope.selectMoveOption = function (moveOptionIndex) {
				Messaging.send("selectMove", moveOptionIndex);
				$scope.moveOptions = null;
			};
			$scope.recentMessages = [];
			$scope.sendChat = function () {

				var message = $scope.chatMessage.trim();
				if (message) {
					chat.send(message);
					$scope.chatMessage = '';
				}
				return false;
			};
			function _processMessage(message) {
				var chatBox = document.getElementById("chat-box");
				$scope.recentMessages.push(message);
				if ($scope.recentMessages.length > 30)
					$scope.recentMessages.shift();
				setTimeout(function () {
					chatBox.scrollTop = chatBox.scrollHeight;
				}, 1);
			}

			var chatListener = function (message) {
				$scope.$apply(function () {
					_processMessage(message);
				});
			};

			chat.listen(chatListener);
			$scope.$on('$destroy', function () {
				chat.stopListening(chatListener);
			});

			Messaging.register("currentPlayer", function (index) {
				$scope.$apply(function () {
					console.log("updating active player");
					_setActivePlayer(index);
				});
			});

			function _setActivePlayer(playerIndex) {
				game.activePlayer = playerIndex;
				$scope.myTurn = (game.players[playerIndex].id === player.userId);
				$scope.gearSelected = false;
				if ($scope.myTurn) {
					chat.localMessage({
						from : 'System',
						message : "It's your turn"
					});
				}
				_scrollToActivePlayer();
			}

			$scope.selectGear = function () {
				Messaging.send("gearSelect", $scope.gear);
				$scope.gearSelected = true;
			};

			function _processMoveOptions(moveOptions) {
				$scope.gearSelected = true;
				$scope.moveOptions = moveOptions;
			}

			function _processPlayerUpdate(players) {
				game.players = players;
				$scope.players = players;
				$scope.user = player.findUser(players);
				if (!$scope.gear)
					$scope.gear = $scope.user.activeGear;
				if ($scope.myTurn && $scope.user.gearSelected) {
					_processMoveOptions($scope.user.moveOptions);
				} else if (game.activePlayer !== $scope.user.userId && game.players[game.activePlayer].gearSelected) {
					$scope.opponentMoves = game.players[game.activePlayer].moveOptions;
				}

				_scrollToActivePlayer();
			}

			Messaging.register("updatePlayers", function (data) {
				console.log("updating player list");
				$scope.$apply(function () {
					_processPlayerUpdate(data);
				});
			});

			Messaging.register("currentGame", function (data) {
				console.log(data);
				Games.currentGame = data;
				game = data;
				$scope.game = data;
				if (data.players.length === 0)
					$location.url('/');
				$scope.$apply(function () {
					$scope.map = data.map;
					_setActivePlayer(game.activePlayer);
					_processPlayerUpdate(data.players);
				});
			});

			Messaging.register("activePlayerMove", function (path) {
				var playerIndex = game.activePlayer;
				var player = game.players[playerIndex];
				var speed = path.length;
				player.speed = path.length;

				$scope.$apply(function () {
					$scope.opponentMoves = [];
					$scope.moveOptions = null;
					setTimeout(_nextSpace, 1);
				});

				function _nextSpace() {
					$scope.$apply(function () {
						if (path.length) {
							var location = path.shift();
							if (player.location > location)
								player.lap++;
							player.location = location;
							setTimeout(_nextSpace, 2000 / speed);
						}
					});
				}
			});

			function _scrollTo(locationIndex) {
				var location = game.map.spaces[locationIndex];
				var yOffset = gameView.clientHeight / 2;
				var xOffset = gameView.clientWidth / 2;
				var left = location.x - xOffset;
				var top = location.y - yOffset;
				setTimeout(function () {
					gameView.scrollTop = top;
					gameView.scrollLeft = left;
				}, 1);
			}

			function _scrollToActivePlayer() {
				var playerIndex = game.activePlayer;
				var player = game.players[playerIndex];
				var locationIndex = player.location;
				_scrollTo(locationIndex);
			}

			Messaging.register("gameOver", function (data) {
				$scope.$apply(function () {
					if (data.rankings) {
						$scope.rankings = data.rankings;
					}
					$scope.gameOver = true;
				});
			});

			Messaging.send("join", $routeParams.game);
		}
	]);
