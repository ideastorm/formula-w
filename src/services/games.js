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

angular.module("FormulaW").factory("Games", ['Messaging', function (Messaging) {
		var service = {
			update: _update,
			currentGame: null
		};

		var _callback;

		Messaging.register("gameList", function (data) {
			_callback.scope.$apply(function () {
				_callback(data);
			});
		});

		return service;

		function _update(scope, callback) {
			_callback = callback;
			_callback.scope = scope;
			Messaging.send('queryList');
		}
	}]);
