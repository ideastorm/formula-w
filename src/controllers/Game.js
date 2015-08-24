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

        $scope.buildIconStyle = function (player) {
            var space = Games.currentGame.map.spaces[player.location];
            return "left:" + space.x + "px;top:" + space.y + "px;" +
                    "transform:rotate(" + space.theta + "deg);" +
                    "-webkit-transform:rotate(" + space.theta + "deg)";
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

        Messaging.register("chatMessage", function (message) {
            var chatBox = document.getElementById("chat-box");
            $scope.$apply(function () {
                $scope.recentMessages.push(message);
                if ($scope.recentMessages.length > 30)
                    $scope.recentMessages.shift();
                setTimeout(function () {
                    chatBox.scrollTop = chatBox.scrollHeight;
                }, 1);
            });
        });

        function _setActivePlayer(playerIndex) {
            game.activePlayer = playerIndex;
        }

        Messaging.register("currentGame", function (data) {
            console.log(data);
            Games.currentGame = data;
            game = data;
            $scope.game = data;

            if (data.players.length === 0)
                $location.url('/');

            $scope.$apply(function () {
                $scope.players = data.players;
                $scope.map = data.map;
                $scope.user = player.findUser(data.players);

                _scrollToActivePlayer();

//				setTimeout(function () {
//					gameView.scrollTop = 658;
//					gameView.scrollLeft = 0;
//				}, 1);

            });

        });

        Messaging.send("join", $routeParams.game);

        function _scrollToActivePlayer() {
            var playerIndex = Games.currentGame.activePlayer;
            var locationIndex = Games.currentGame.players[playerIndex].location;
            var location = Games.currentGame.map.spaces[locationIndex];
            var yOffset = gameView.clientHeight / 2;
            var xOffset = gameView.clientWidth / 2;
            setTimeout(function () {
                gameView.scrollTop = location.y - yOffset;
                gameView.scrollLeft = location.x - xOffset;
            }, 1);
        }

    }]);