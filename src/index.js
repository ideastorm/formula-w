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

require('angular');
require('angular-route');
require('angular-cookies');

angular.module("FormulaW", ['ngRoute', 'ngCookies'])
				.config(['$routeProvider', function ($routeProvider) {
						$routeProvider
										.when('/', {templateUrl: 'partials/browser.html'})
										.when('/host', {templateUrl: 'partials/waiting.html'})
										.when('/join/:game', {templateUrl: 'partials/waiting.html'})
										.when('/play/:game', {templateUrl: 'partials/game.html'})
										.otherwise({redirectTo: '/'});
					}]);

require('./services/debounce');
require('./services/games');
require('./services/messaging');
require('./services/player');
require('./services/notifications');
require('./controllers/Header');
require('./controllers/Browser');
require('./controllers/Waiting');
require('./controllers/Game');

