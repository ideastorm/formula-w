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

                function readAsText(file, scope) {
                    var deferred = $q.defer();
                    var reader = getReader(deferred, scope);
                    reader.readAsText(file);

                    return deferred.promise;
                }

                return {
                    readAsDataUrl: readAsDataURL,
                    readAsText: readAsText
                };
            }])
        .controller('builder', ['$scope', 'fileReader', function ($scope, fileReader) {

                $scope.mapImage = null;
                _resetFlags();
                $scope.activeCorner = null;

                function _resetFlags() {
                    $scope.spacesPlaced = false;
                    $scope.linksMarked = false;
                    $scope.cornersPlaced = false;
                    $scope.startSpacesMarked = false;
                    $scope.mapComplete = false;
                    $scope.insideMarked = false;
                    $scope.outsideMarked = false;
                }

                function _getMapInfo() {
                    $scope.$apply(function () {
                        $scope.map.width = $scope.mapImage.naturalWidth;
                        $scope.map.height = $scope.mapImage.naturalHeight;
                        var div = document.getElementById('imgContainer');
                        div.style.width = $scope.map.width + 'px';
                        div.style.height = $scope.map.height + 'px';
                        div.style.background = 'url(' + $scope.mapImage.src + ')';
                    });
                }

                function _spacePlacementMouseDown(event, space) {
                    if (event.ctrlKey && event.shiftKey)
                    {
                        var index = $scope.spaceIndex(space);
                        $scope.map.spaces.splice(index, 1);
                        $scope.activeSpace = null;
                        $scope.adjustRotation = false;
                        $scope.deleted = true;
                    } else if (event.ctrlKey) {
                        $scope.activeSpace = space;
                        $scope.adjustRotation = true;
                    } else {
                        if ($scope.activeSpace === space && $scope.adjustRotation) {
                            $scope.adjustRotation = false;
                            $scope.activeSpace = null;
                        }
                        else if ($scope.activeSpace === space)
                            $scope.adjustRotation = true;
                        else {
                            $scope.activeSpace = space;
                            $scope.selected = true;
                        }
                    }
                }

                function _spacePlacementFinalizeAlt(event) {
                    if (!$scope.activeSpace && !$scope.deleted) {
                        $scope.addSpace();
                    } else if (!event.ctrlKey && !event.shiftKey) {
                        $scope.adjustRotation = false;
                        if (!$scope.selected) {
                            $scope.activeSpace = false;
                        }
                    }
                    $scope.deleted = false;
                    $scope.selected = false;
                }

                function _spacePlacementMouseMove(event) {
                    if ($scope.activeSpace) {
						var imgScroll = document.getElementById("imgScroll");
                        if ($scope.adjustRotation || event.ctrlKey) {
                            var dx = event.layerX - $scope.activeSpace.x;
                            var dy = event.layerY - $scope.activeSpace.y;
                            var theta = Math.atan2(dy, dx) * 180 / Math.PI;
                            $scope.activeSpace.theta = theta;
                        } else {
							$scope.activeSpace.x = event.pageX + imgScroll.scrollLeft;
							$scope.activeSpace.y = event.pageY + imgScroll.scrollTop;
                        }
                    }
                }

                var _emptyFn = function () {
                };

                $scope.spaceIndex = function (space) {
                    if ($scope.map && $scope.map.spaces)
                        return $scope.map.spaces.indexOf(space);
                    return -1;
                };

                $scope.isAdjacent = function (spaceIndex) {
                    return $scope.activeSpace && $scope.activeSpace.adjacent.indexOf(spaceIndex) >= 0;
                };
                $scope.isMoveTarget = function (spaceIndex) {
                    return $scope.activeSpace && $scope.activeSpace.moveTargets.indexOf(spaceIndex) >= 0;
                };

                $scope.isStartSpace = function (spaceIndex) {
                    return $scope.map.startSpaces.indexOf(spaceIndex) >= 0;
                };

                $scope.isCorner = function (spaceIndex) {
                    return $scope.activeCorner && $scope.activeCorner.spaces.indexOf(spaceIndex) >= 0;
                };
                
                $scope.isInner = function(spaceIndex) {
                    return $scope.map.insideCorridors.indexOf(spaceIndex) >= 0;
                };

                $scope.isOuter = function(spaceIndex) {
                    return $scope.map.outsideCorridors.indexOf(spaceIndex) >= 0;
                };

                function _removeLink(space, spaceIndex) {
                    if (space) {
                        var removalIndex = space.adjacent.indexOf(spaceIndex);
                        if (removalIndex >= 0)
                            space.adjacent.splice(removalIndex, 1);
                        removalIndex = space.moveTargets.indexOf(spaceIndex);
                        if (removalIndex >= 0)
                            space.moveTargets.splice(removalIndex, 1);
                    }
                }

                function _spaceLinkMouseDown(event, space) {
                    if ($scope.activeSpace) {
                        var activeSpaceIndex = $scope.spaceIndex($scope.activeSpace);
                        var spaceIndex = $scope.spaceIndex(space);
                        if (event.ctrlKey && event.shiftKey) {
                            _removeLink($scope.activeSpace, spaceIndex);
                            _removeLink(space, activeSpaceIndex);
                            return;
                        } else if (event.ctrlKey) {
                            _removeLink($scope.activeSpace, spaceIndex);
                            $scope.activeSpace.moveTargets.push(spaceIndex);
                            _removeLink(space, activeSpaceIndex);
                            $scope.map.spaces[spaceIndex].adjacent.push(activeSpaceIndex);
                            return;
                        } else if (event.shiftKey) {
                            _removeLink($scope.activeSpace, spaceIndex);
                            $scope.activeSpace.adjacent.push(spaceIndex);
                            _removeLink(space, activeSpaceIndex);
                            $scope.map.spaces[spaceIndex].adjacent.push(activeSpaceIndex);
                            return;
                        }
                    }
                    $scope.activeSpace = space;
                }

                function _startSpaceClick(event, space) {
                    _toggleSpace($scope.map.startSpaces);
                }

                function _pitStopClick(event, space) {
                    _toggleSpace(space, $scope.map.pitStops);
                }

                function _cornerSpaceClick(event, space) {
                    if ($scope.activeCorner) {
                        _toggleSpace(space, $scope.activeCorner.spaces);
                    }
                }

                function _toggleSpace(space, collection) {
                    var spaceIndex = $scope.spaceIndex(space);
                    var removalIndex = collection.indexOf(spaceIndex);
                    if (removalIndex >= 0)
                        collection.splice(removalIndex, 1);
                    else
                        collection.push(spaceIndex);
                }

                function _innerCorridorClick(event, space) {
                    _toggleSpace(space, $scope.map.insideCorridors);
                }

                function _outerCorridorClick(event, space) {
                    _toggleSpace(space, $scope.map.outsideCorridors);
                }
                
                $scope.startMarkingCorners = function () {
                    $scope.activeSpace = null;
                    $scope.spacesPlaced = true;
                    $scope.finalizeAltEdit = _emptyFn;
                    $scope.updateActiveLocation = _emptyFn;
                    $scope.imgMouseDown = _emptyFn;
                    $scope.imgClick = _cornerSpaceClick;
                };

                $scope.startMarkingLinks = function () {
                    $scope.activeCorner = null;
                    $scope.activeSpace = null;
                    $scope.cornersPlaced = true;
                    $scope.finalizeAltEdit = _emptyFn;
                    $scope.updateActiveLocation = _emptyFn;
                    $scope.imgMouseDown = _emptyFn;
                    $scope.imgClick = _spaceLinkMouseDown;
                };

                $scope.startMarkingStartSpaces = function () {
                    $scope.activeSpace = null;
                    $scope.linksMarked = true;
                    $scope.finalizeAltEdit = _emptyFn;
                    $scope.updateActiveLocation = _emptyFn;
                    $scope.imgMouseDown = _emptyFn;
                    $scope.imgClick = _startSpaceClick;
                };

                $scope.startMarkingPitStops = function () {
                    $scope.startSpacesMarked = true;
                    $scope.finalizeAltEdit = _emptyFn;
                    $scope.updateActiveLocation = _emptyFn;
                    $scope.imgMouseDown = _emptyFn;
                    $scope.imgClick = _pitStopClick;
                };
                
                $scope.startMarkingInnerCorridor = function() {
                    $scope.pitStopsMarked = true;
                    $scope.finalizeAltEdit = _emptyFn;
                    $scope.updateActiveLocation = _emptyFn;
                    $scope.imgMouseDown = _emptyFn;
                    $scope.imgClick = _innerCorridorClick;
                };
                
                $scope.startMarkingOuterCorridor = function() {
                    $scope.insideMarked = true;
                    $scope.finalizeAltEdit = _emptyFn;
                    $scope.updateActiveLocation = _emptyFn;
                    $scope.imgMouseDown = _emptyFn;
                    $scope.imgClick = _outerCorridorClick;
                };

                $scope.validate = function () {
                    var map = $scope.map;
                    if (!map.name) {
                        alert("No map name");
                    }
                    var spaces = map.spaces;
                    for (var i = 0; i < spaces.length; i++) {
                        var space = spaces[i];
                        if (!space.adjacent.length || !space.moveTargets.length) {
                            alert("space " + i + " is missing links");
							break;
                        }
                    }
                    $scope.mapComplete = true;
                };

                $scope.imgMouseDown = _spacePlacementMouseDown;
                $scope.finalizeAltEdit = _spacePlacementFinalizeAlt;
                $scope.updateActiveLocation = _spacePlacementMouseMove;
                $scope.imgClick = _emptyFn;

                $scope.editCorner = function (corner) {
                    $scope.activeCorner = corner;
                };

                $scope.addCorner = function () {
                    var newCorner = {
                        name: '',
                        requiredStops: 1,
                        spaces: []
                    };
                    $scope.map.corners.push(newCorner);
                    $scope.activeCorner = newCorner;
                };

                $scope.addSpace = function () {
                    var newSpace = {
                        x: $scope.map.width / 2,
                        y: $scope.map.height / 2,
                        theta: 0,
                        adjacent: [],
                        moveTargets: []
                    };
                    $scope.map.spaces.push(newSpace);
                    $scope.activeSpace = newSpace;
                };

                $scope.readFile = function () {
                    fileReader.readAsDataUrl($scope.file, $scope)
                            .then(function (result) {

                                $scope.mapImage = new Image();
                                $scope.mapImage.src = result;
                                $scope.map = {
                                    spaces: [],
                                    corners: [],
                                    startSpaces: [],
                                    pitStops: [],
                                    insideCorridors: [],
                                    outsideCorridors: []
                                };
                                setTimeout(_getMapInfo, 1);
                            });
                };

                $scope.readMapFile = function () {
                    fileReader.readAsText($scope.file, $scope)
                            .then(function (result) {
                                $scope.map = JSON.parse(result);
                                if (!$scope.map.spaces)
                                    $scope.map.spaces = [];
                                if (!$scope.map.corners)
                                    $scope.map.corners = [];
                                if (!$scope.map.startSpaces)
                                    $scope.map.startSpaces = [];
                                if (!$scope.map.pitStops)
                                    $scope.map.pitStops = [];
                                if (!$scope.map.insideCorridors)
                                    $scope.map.insideCorridors = [];
                                if (!$scope.map.outsideCorridors)
                                    $scope.map.outsideCorridors = [];
                            });
                };

            }]);

