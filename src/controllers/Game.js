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

angular.module('FormulaW').controller('Game', ['$scope', '$routeParams', 'Games', 'Messaging', function ($scope, $routeParams, Games, Messaging) {
		$scope.games = Games;

		Messaging.register("currentGame", function (data) {
			Games.currentGame = data;
			if (data.players.length === 0)
				$location.url('/');

			$scope.$apply(function () {
				$scope.players = data.players;
				$scope.map = data.map;
			});
		});

		Messaging.send("join", $routeParams.game);

	}]);