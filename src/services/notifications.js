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

/* global Notification, angular */
'use strict';

angular.module('FormulaW').factory("notifications", [function () {
			var enable = typeof Notification !== 'undefined';
			if (enable)
				enable = typeof Notification.requestPermission !== 'undefined'
			var lastNotification;

			var service = {
				notify : _notify,
                close: _closeLast,
				requestNotification : _request
			};

			return service;
            
            function _closeLast() {
					if (lastNotification && typeof lastNotification.close === 'function')
						lastNotification.close();
            }

			function _notify(title, message) {
				if (enable) {
                    _closeLast();
					lastNotification = new Notification(title, {
							icon : "markers/0.png",
							body : message
						});
					//			notify.onclick = buildOnclick("/#/log/" + job.id, "log" + job.id);
				} else {
					console.log("HTML5 notifications are disabled");
				}
			}

			function _request() {
				if (enable) {
					Notification.requestPermission(function (permission) {
						console.log("Notification permission was " + permission);
					});
				} else {
					console.log("HTML5 notifications are disabled");
				}
			}
		}
	]);
