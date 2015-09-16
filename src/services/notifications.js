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

angular.module('FormulaW').factory("notifications", ['chat', function (chat) {

		var service = {
			notify: _notify,
			requestNotification: _request
		};

		chat.listen(function (message) {
			console.log("Got a chat message: " + message);
			if (message.from === 'System')
				_notify("Formula-W", message.message);
		});

		return service;

		function _notify(title, message) {
//			var notify =
			new Notification(title,
					{
						icon: "markers/0.png",
						body: message
					});
//			notify.onclick = buildOnclick("/#/log/" + job.id, "log" + job.id);

		}

		function _request() {
			Notification.requestPermission(function (permission) {
				console.log("Notification permission was " + permission);
			});
		}
	}]);

