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

angular.module("FormulaW").controller("Header", ['$scope', 'Messaging', 'debounce', function ($scope, Messaging, debounce) {
		var debouncer = debounce('user', 250);

		Messaging.register("userName", function (name) {
			$scope.$apply(function () {
				$scope.user = name;
				$scope.valid = true;
			});
		});

		Messaging.register("userInfo", function (userData) {
			$scope.$apply(function () {
				$scope.valid = userData.valid;
			});
		});

		$scope.user = null;

		$scope.updateUser = function () {
			debouncer(function () {
				Messaging.send("checkUser", $scope.user);
			});
		};

	}]);