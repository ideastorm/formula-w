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

angular.module('mapBuilder', [])
				.directive('fileInput', function ($parse) {
					return {
						restrict: "EA",
						template: "<input type='file' />",
						replace: true,
						link: function (scope, element, attrs) {

							var modelGet = $parse(attrs.fileInput);
							var modelSet = modelGet.assign;
							var onChange = $parse(attrs.onChange);

							var updateModel = function () {
								scope.$apply(function () {
									modelSet(scope, element[0].files[0]);
									onChange(scope);
								});
							};

							element.bind('change', updateModel);
						}
					};
				})
				.factory('fileReader', ['$q', '$log', function ($q, $log) {

						var onLoad = function (reader, deferred, scope) {
							return function () {
								scope.$apply(function () {
									deferred.resolve(reader.result);
								});
							};
						};

						var onError = function (reader, deferred, scope) {
							return function () {
								scope.$apply(function () {
									deferred.reject(reader.result);
								});
							};
						};

						var onProgress = function (reader, scope) {
							return function (event) {
								scope.$broadcast("fileProgress",
												{
													total: event.total,
													loaded: event.loaded
												});
							};
						};

						var getReader = function (deferred, scope) {
							var reader = new FileReader();
							reader.onload = onLoad(reader, deferred, scope);
							reader.onerror = onError(reader, deferred, scope);
							reader.onprogress = onProgress(reader, scope);
							return reader;
						};

						var readAsDataURL = function (file, scope) {
							var deferred = $q.defer();

							var reader = getReader(deferred, scope);
							reader.readAsDataURL(file);

							return deferred.promise;
						};

						return {
							readAsDataUrl: readAsDataURL
						};
					}])
				.controller('builder', ['$scope', 'fileReader', function ($scope, fileReader) {

						$scope.mapImage = null;

						function _getMapInfo() {
							$scope.$apply(function () {
								var img = document.getElementById('mapImage');
								$scope.map.width = img.naturalWidth;
								$scope.map.height = img.naturalHeight;
							});
						}

						$scope.readFile = function () {
							fileReader.readAsDataUrl($scope.file, $scope)
											.then(function (result) {
												$scope.mapImage = result;
												$scope.map = {};
												setTimeout(_getMapInfo, 1);
											});
						};
					}]);

