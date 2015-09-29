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

angular.module('FormulaW').controller('Game', ['$scope', '$routeParams', '$location', 'Games', 'Messaging', 'player', 'notifications', function ($scope, $routeParams, $location, Games, Messaging, player, notifications) {
			var gameView = document.getElementById('fw-game-view');
			var game = $scope.game = Games.currentGame;
			var showGameState = false;
			var messageQueue = [];

			$scope.subMap = function () {
				var copy = angular.copy(game);
				copy.map = {};
				return copy;
			};

			notifications.requestNotification();

			function _notify(message) {
				$scope.notification = message;
				if (message)
					setTimeout(function () {
						$scope.$apply(function () {
							_notify(null);
						});
					}, 3000);
			}

			$scope.notify = _notify;

			$scope.activePlayers = function (value, index, array) {
				return value.location >= 0;
			};

			$scope.animationClass = function (player) {
				return "animate-move-" + player.speed;
			};

			$scope.gear = 0;
			$scope.buildIconStyle = function (item) {
				var space;
				if (typeof item.location === 'number') {
					space = game.map.spaces[item.location];
				} else if (typeof item.space === 'number') {
					space = game.map.spaces[item.space];
				} else {
					console.log("unable to build icon style for unknown item");
					console.log(item);
					return '';
				}
				var left = space.x;
				var top = space.y;
				var theta = space.theta;
				if (item.destroy)
					theta = 0;
				if (item.spinout)
					theta = theta - 180;
				return {
					left : left + 'px',
					top : top + 'px',
					transform : 'rotate(' + theta + 'deg)',
					'-webkit-transform' : 'rotate(' + theta + 'deg)'
				};
			};

			$scope.buildDangerStyle = function (spaceIndex) {
				var space = game.map.spaces[spaceIndex];
				var left = space.x;
				var top = space.y;
				return {
					left : left + 'px',
					top : top + 'px'
				};
			};

			$scope.buildExplosionStyle = function () {
				var left = $scope.explosion.x;
				var top = $scope.explosion.y;
				return {
					left : left + 'px',
					top : top + 'px'
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

			$scope.damageMessage = function (moveOption) {
				var prefix = moveOption.totalDamage + " damage; ";
				if (moveOption.destroy)
					prefix = "Destruction; ";
				if (moveOption.totalDamage == 0)
					prefix = "No Damage; ";

				if (moveOption.pathDanger) {
					var form = "spaces";
					if (moveOption.pathDanger === 1)
						form = "space";
					prefix += moveOption.pathDanger + " dangerous " + form + "; ";
				}

				return prefix + moveOption.damageMsg;
			};

			$scope.damageLeft = function (player) {
				if (!game.advanced) {
					return player.damage;
				} else {
					var d = player.damage;

					return "E:" + d.engine + " Ti:" + d.tires + " Br:" + d.brakes + " Tr:" + d.transmission + " S:" + d.suspension + " Bo:" + d.body;
				}
			};
			$scope.selectMoveOption = function (moveOptionIndex) {
				Messaging.send("selectMove", moveOptionIndex);
				$scope.moveOptions = null;
			};
			$scope.recentMessages = [];
			$scope.systemMessages = [];
			$scope.sendChat = function () {

				var message = $scope.chatMessage.trim();
				if (message) {
					Messaging.send("chatMessage", message);
					$scope.chatMessage = '';
				}
				return false;
			};

			function _processMessage(message, collection, container) {
				var chatBox = document.getElementById(container);
				collection.push(message);
				if (collection.length > 30)
					collection.shift();
				setTimeout(function () {
					chatBox.scrollTop = chatBox.scrollHeight;
				}, 1);
			}

			Messaging.register("checkHeartbeat", function () {
				Messaging.send("heartbeat", {});
			});

			Messaging.register("chatMessage", function (message) {
				$scope.$apply(function () {
					_processMessage(message, $scope.recentMessages, "playerChat");
				});
			});

			Messaging.register("sysMessage", function (message) {
				$scope.$apply(function () {
					_processMessage({
						id : Date.now(),
						text : message
					}, $scope.systemMessages, "systemChat");
				});
			});

			Messaging.register("sysWarning", function (message) {
				$scope.$apply(function () {
					_notify(message);
				});
			});

			Messaging.register("currentPlayer", function (index) {
				$scope.$apply(function () {
					console.log("updating active player");
					_setActivePlayer(index);
				});
			});

			Messaging.register("dangerSpaces", function (spaceList) {
				$scope.$apply(function () {
					$scope.game.dangerSpaces = spaceList;
				});
			});

			Messaging.register("destroyPlayer", function (playerData) {
				function _findPlayer() {
					for (var i = 0; i < game.players.length; i++) {
						if (game.players[i].id === playerData.id)
							return game.players[i];
					}
					return playerData;
				}
				$scope.$apply(function () {
					var gamePlayer = _findPlayer();
					var space = game.map.spaces[playerData.location];
					$scope.explosion = space;
					setTimeout(function () {
						$scope.$apply(function () {
							gamePlayer.location = -1;
						});
					}, 150);
					setTimeout(function () {
						$scope.$apply(function () {
							$scope.explosion = null;
							_notify(playerData.name + " is out of the race!");
						});
					}, 320);
				});
			});

			function _setActivePlayer(playerIndex) {
				if (typeof playerIndex === 'number') {
					game.activePlayer = playerIndex;
					game.players[playerIndex].spinout = false;
					$scope.myTurn = (game.players[playerIndex].id === player.userId);
					$scope.gearSelected = false;
					if ($scope.myTurn) {
						_notify("Your Turn!");
						notifications.notify("Formula W", "It' s your turn ");
					} else {
                        notifications.close();
                    }
					_scrollToActivePlayer();
				}
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
				console.log(" updating player list ");
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
				player.lastMove = path;
				var speed = path.length;
				player.speed = speed;

				$scope.$apply(function () {
					$scope.opponentMoves = [];
					$scope.moveOptions = null;
					setTimeout(_nextSpace, 1);
				});

				function _nextSpace() {
					$scope.$apply(function () {
						if (path.length) {
							console.log(path);
							console.log(player.location);
							var location = path.shift();
							if (player.location > location)
								player.lap++;
							if (player.location === location) {
								player.spinout = true;
							}
                            _smoothScroll(player.location, location, 2000/speed);
							player.location = location;
							setTimeout(_nextSpace, 2000 / speed);
						}
					});
				}
			});
            
            function _smoothScroll(oldLocation, newLocation, time) {
                var xOffset = gameView.clientWidth / 2;
                var yOffset = gameView.clientHeight / 2;
                
                function scrollOp(left, top) {
                    return function(){
                        gameView.scrollLeft = left - xOffset;
                        gameView.scrollTop = top - yOffset;
                    };
                }
                
                var steps = Math.floor(time / 10);                
                var oldLocation = game.map.spaces[oldLocation];
				var location = game.map.spaces[newLocation];
				
                var xDiff = location.x - oldLocation.x;
                var yDiff = location.y - oldLocation.y;
                var xStep = xDiff / steps;
                var yStep = yDiff / steps;
                for (var step = 1; step <= steps; step++) {
                    var x = oldLocation.x + xStep * step;
                    var y = oldLocation.y + yStep * step;
                    setTimeout(scrollOp(x, y), 10*step);
                }
                setTimeout(scrollOp(location.x, location.y),time);
            }

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
			Messaging.send("initPlayerSocket", {});
		}
	]);
