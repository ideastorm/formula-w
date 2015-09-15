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

angular.module('FormulaW').controller('Game', ['$scope', '$routeParams', 'Games', 'Messaging', 'player', function ($scope, $routeParams, Games, Messaging, player) {
        var gameView = document.getElementById('fw-game-view');
        var game = $scope.game = Games.currentGame;
        var messageQueue = [];
        var moving = false;
        $scope.gear = 0;
        $scope.buildIconStyle = function (item) {
            var space;
            if (typeof item.location === 'number') {
                space = game.map.spaces[item.location];
            } else if (typeof item.space === 'number') {
                space = game.map.spaces[item.space];
            }
            var left = space.x;
            var top = space.y;
            var theta = space.theta;
            return "left:" + left + "px;top:" + top + "px;" +
                    "transform:rotate(" + theta + "deg);" +
                    "-webkit-transform:rotate(" + theta + "deg)";
        };
        $scope.damageIndex = function (damage) {
            if (damage > 5)
                return 5;
            if (damage < 0)
                return 0;
            return damage;
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
                Messaging.send("chatMessage", message);
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

        Messaging.register("chatMessage", function (message) {
            $scope.$apply(function () {
                _processMessage(message);
            });
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
                _processMessage({from: 'System', message: "It's your turn"});
            }
            if (!moving)
                _scrollToActivePlayer();
        }

        $scope.selectGear = function () {
            Messaging.send("chatMessage", "I'm using gear " + $scope.gear);
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
            }

            _scrollToActivePlayer();
        }

        Messaging.register("updatePlayers", function (data) {
            messageQueue.push(function updatePlayers() {
                if (moving) {
                    messageQueue.push(updatePlayers);
                    _processMessageQueue();
                } else {
                    console.log("updating player list");
                    _processPlayerUpdate(data);
                }
            });
            _processMessageQueue();
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
        var _processingQueue = false;
        var _queueRetry;
        function _processMessageQueue() {
            console.log("checking queue");
            if (_processingQueue) {
                clearTimeout(_queueRetry);
                _queueRetry = setTimeout(_processMessageQueue, 550);
                return;
            }
            _processingQueue = true;
            var message = messageQueue.shift();
            if (typeof message === 'function')
                $scope.$apply(message);
            _processingQueue = false;
        }

        Messaging.register("activePlayerMove", function (path) {
            var playerIndex = game.activePlayer;
            var player = game.players[playerIndex];
            for (var i = 0; i < path.length; i++) {
                messageQueue.push(buildMove(i));
            }

            function buildMove(index) {
                return function nextMove() {
                    if (moving) {
                        messageQueue.unshift(nextMove);
                        _processMessageQueue();
                    } else {
                        _nextSpace(path[index]);
                    }
                };
            }

            function _nextSpace(location) {
                if (player.location > location)
                    player.lap++;
                player.location = location;
                _processMessageQueue();
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
                if (data.winner) {
                    $scope.winner = data.winner;
                }
                $scope.gameOver = true;
            });
        });

        Messaging.send("join", $routeParams.game);
    }]);