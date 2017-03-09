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

var deepCopy = require('./deepCopy');
var _sockets = {};
var autoMoveTimeouts = {};

module.exports.bind = function (socket, io, games) {
    console.log("binding socket info for " + socket.userId + " to socket " + socket.id);
    _sockets[socket.userId] = playerSocket(socket, io, games);
    console.log("disconnect function stored for " + socket.userId);
};

module.exports.disconnect = function (socket) {
    console.log("userId " + socket.userId + " disconnected");
    var disconnetFn = _sockets[socket.userId];
    if (typeof disconnetFn === 'function')
        disconnetFn();
};

function playerSocket(socket, io, games) {
    console.log("initializing game runtime for web socket " + socket.id);
    socket.on("initPlayerSocket", function () {
        var game = games.lookup(socket);
        console.log("marking player at index " + games.getPlayerIndex(game, socket.userId) + " as connected");
        var player = games.getPlayer(socket);
        if (player) {
            player.disconnected = false;
        }
        console.log(autoMoveTimeouts);
        if (game.host === socket.userId && (typeof autoMoveTimeouts[game.id] === 'undefined')) {
            console.log("initializing game loop");
            _nextPlayer();
        }
    });

    socket.on('gearSelect', _gearSelect);
    socket.on('selectMove', _selectMove);

    function _setWarning(player, message, action, delay, warnDelay) {
        var game = games.lookup(socket);
        if (player.disconnected) {
//            console.log(player.name + " is disconnected; reducing auto play delays");
            delay = 500;
            warnDelay = 50;
        }
        clearTimeout(autoMoveTimeouts[game.id]);

        autoMoveTimeouts[game.id] = setTimeout(function () {
            autoMoveTimeouts[game.id] = setTimeout(action, delay);
            io.to(io.users[player.id]).emit("sysWarning", message);
        }, warnDelay);
    }

    function _autoGearSelect() {
        var game = games.lookup(socket);
        if (!game.running)
            return;
        var player = game.players[game.activePlayer];
        var space = game.map.spaces[player.location];
        var targetDistance = space.cornerEndDistance;
        var corner = space.corner ? game.map.corners[space.corner - 1] : null;
        if (corner) {
            if (player.cornerStops < corner.requiredStops) {
                //try to make sure we get enough stops
                var remainingStops = corner.requiredStops - player.cornerStops;
                targetDistance = targetDistance / remainingStops;
            } else {
                targetDistance = space.cornerStartDistance; //aim for the next corner;
            }
        }
        var targetGear = _pickGearForDistance(targetDistance);
        targetGear = Math.min(player.activeGear + 1, Math.max(player.activeGear - 1, targetGear));
        _gearSelect(targetGear, game.activePlayer);
    }

    function _pickGearForDistance(distance) {
        if (distance < 2)
            return 1;
        if (distance < 5)
            return 2;
        if (distance < 10)
            return 3;
        if (distance < 15)
            return 4;
        if (distance < 24)
            return 5;
        return 6;
    }

    function _autoMoveSelect() {
        var game = games.lookup(socket);
        if (!game.running)
            return;
        var player = game.players[game.activePlayer];
        var moves = player.moveOptions;
        if (!moves || !moves.length) {
            console.log("no move options, waiting");
            setTimeout(_autoMoveSelect, 10);
            return;
        }
        var best = 100;
        var bestIndex = moves.length - 1;
        for (var i = moves.length - 1; i >= 0; i--) {
            var move = moves[i];
            if (move.destroy)
                continue;
            if (move.totalDamage < best) {
                best = move.totalDamage;
                bestIndex = i;
            }
        }
        if (typeof bestIndex === 'number')
            _selectMove(bestIndex, game.activePlayer);
    }

    function _gearSelect(selectedGear, forcePlayer) {
        var game = games.lookup(socket);
        var playerIndex = games.getPlayerIndex(game, socket.userId);
        if (typeof forcePlayer === 'number')
            playerIndex = forcePlayer;
        if (playerIndex === game.activePlayer) {
            clearTimeout(autoMoveTimeouts[game.id]);
            var player = game.players[playerIndex];
            if (!player.gearSelected) {
                _validateAndUpdateGearSelection(game, player, +selectedGear);
                if (player.gearSelected)
                    setTimeout(function () {
                        _calculateMoveOptions(game, player);
                        _setWarning(player,
                                "A move will be selected for you in 10 seconds",
                                _autoMoveSelect,
                                10000,
                                50000);
                    }, 100);
                else
                    io.to(game.id).emit("updatePlayers", game.players);
            }
        }
    }

    function _selectMove(selectedMove, forcePlayer) {
        var game = games.lookup(socket);
        var playerIndex = games.getPlayerIndex(game, socket.userId);
        if (typeof forcePlayer === 'number')
            playerIndex = forcePlayer;
        if (playerIndex === game.activePlayer) {
            clearTimeout(autoMoveTimeouts[game.id]);
            var player = game.players[playerIndex];
            var move = player.moveOptions[selectedMove];
            if (move.space < player.location) {
                player.lap++;
            }
            if (move.spinout) {
                move.path.push(move.path[move.path.length - 1]); //duplicate the last entry
            }
            io.to(game.id).emit("activePlayerMove", move.path);
            var delay = 2250;
            if (game.fastMovement) {
                delay = 450;
            }
            console.log("delay before finishing processing: " + delay);
            setTimeout(function () {
                if (move.slowStop)
                    player.skipNext = true;
                if (move.pitStop) {
                    player.activeGear = 3; //allows gear 4 or lower
                }
                if (move.spinout) {
                    _sysNotify(game, player.name + " spun out!");
                    player.activeGear = 0;
                }
                _applyMoveDamage(game, player, move);
                player.location = move.space;
                _adjacentDamage(game, player);
                player.allowIn = move.allowIn;
                player.allowOut = move.allowOut;
                if (player.corner && player.corner === move.corner)
                    player.cornerStops++;
                else {
                    player.corner = move.corner;
                    if (move.corner)
                        player.cornerStops = 1;
                    else
                        player.cornerStops = 0;
                }
                player.moveOptions = [];

                if (player.lap > game.laps) {
                    game.winners.push(playerIndex);
                    player.finished = true;
                }
                var nextPlayerDelay = 1;
                if (player.destroyed || player.finished) {
                    player.location = -1;
                    nextPlayerDelay = 500;
                }
                var nextFn = _nextPlayer;
                if (_remainingPlayers(game).length === 0) {
                    nextFn = function () {
                        _gameOver(game);
                    };
                }
                //Allows for animation time before moving on
                autoMoveTimeouts[game.id] = setTimeout(nextFn, nextPlayerDelay);
            }, delay);
        }
    }

    function _nextPlayer() {
        var game = games.lookup(socket);
        if (!game)
            return;
        if (!game.running)
            return;
        clearTimeout(autoMoveTimeouts[game.id]);

        _updateLeaders(game);

        if (!game.playerOrder.length) {
            console.log("Recycling player list");
            _sortPlayers(game);
        }
        game.activePlayer = game.playerOrder.shift();

        console.log("active player: " + game.activePlayer);
        if (typeof game.activePlayer === 'number') {
            var nextPlayer = game.players[game.activePlayer];
            if (nextPlayer.skipNext) {
                nextPlayer.skipNext = false;
                _sysNotify(game, nextPlayer.name + " had a slow pit stop - skipping this turn");
                autoMoveTimeouts[game.id] = setTimeout(_nextPlayer, 1000); //give some time for people to read the message
            } else {
                nextPlayer.gearSelected = false;
                io.to(game.id).emit("updatePlayers", game.players);
                io.to(game.id).emit("currentPlayer", game.activePlayer);
                _setWarning(nextPlayer,
                        "A gear will be automatically selected in 10 seconds",
                        _autoGearSelect, 10000, 35000);
            }
        } else {
            _gameOver(game);
        }
    }

    function _isMyPitStop(game, playerInfo, spaceIndex) {
        var playerIndex;
        if (typeof playerInfo === 'number')
            playerIndex = playerInfo;
        else
            playerIndex = game.players.indexOf(playerInfo);
        return game.map.pitStops.indexOf(spaceIndex) === playerIndex;
    }

    function _validateAndUpdateGearSelection(game, player, selectedGear) {
        if (typeof selectedGear !== 'number' || selectedGear < 1 || selectedGear > 6 || selectedGear > player.activeGear + 1)
            return;
        if (_isMyPitStop(game, player, player.location)) {
            player.gearSelected = true;
            player.activeGear = selectedGear;
            _sysMessage(game, player.name + " is leaving the pits in gear " + selectedGear);
            return;
        }
        var damage = (player.activeGear - 1) - selectedGear;
        player.gearSelected = true;
        player.activeGear = selectedGear;
        _sysMessage(game, player.name + " is using gear " + selectedGear);
        if (damage > 0) {
            _sysMessage(game, player.name + " takes " + damage + " damage for aggressive down shifting");
            if (!game.advanced) {
                player.damage -= damage;
            } else {
                player.damage.transmission -= damage;
            }
            _checkDamage(game, player);
        }
    }

    function _movementPoints(gear, speedBoost) {
        var options;
        switch (gear) {
            case 1:
                options = [1, 2];
                break;
            case 2:
                options = [2, 3, 4];
                break;
            case 3:
                options = [4, 5, 6, 7, 8];
                break;
            case 4:
                options = [7, 8, 9, 10, 11, 12];
                break;
            case 5:
                options = [11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
                break;
            case 6:
                options = [19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
                break;
            default:
                return 1;
        }
        if (speedBoost) {
            var targetLength = Math.ceil(options.length / 2);
            while (options.length > targetLength) {
                options.shift();
            }
        }
        var index = Math.floor(Math.random() * options.length);
        return options[index];
    }

    function _calculateMoveOptions(game, player) {
        var map = game.map;
        var corners = map.corners;
        var playerLocations = _getPlayerLocations(game.players);
        var movePoints = _movementPoints(player.activeGear, game.playerOrder.length < 1);

        if (typeof player.firstRoll === 'undefined') {
            var rand = Math.ceil(20 * Math.random());
            if (rand === 1) {
                player.firstRoll = 'poor';
                player.activeGear = 0;
                _sysNotify(game, player.name + " had a poor start and will restart next turn.");
                _nextPlayer();
                return;
            } else if (rand === 20) {
                player.firstRoll = 'great';
                _sysNotify(game, player.name + " had a great start, and can move four spaces.");
                movePoints = 4;
            } else {
                _sysNotify(game, player.name + " had a normal start.");
                player.firstRoll = 'normal';
            }
        }
        var touchedSpaces = 0;
        console.log(player.name + " rolled a " + movePoints + ", calculating move options");
        var extraMessage = "";
        if ((player.activeGear === 5 && movePoints === 20) || (player.activeGear === 6 && movePoints === 30)) {
            _applyEngineDamage(game, player);
            extraMessage = " and took 1 engine damage.  This space is now dangerous!";
        }
        _sysMessage(game, player.name + " rolled " + movePoints + extraMessage);
        if (player.location < 0)
        { //taking damage can take the player out of the game.
            _sysMessage(game, "skipping " + player.name);
            _nextPlayer();
            return;
        }
        var availableSpaces = [];
        var workQueue = [{
                space: player.location,
                distance: 0,
                path: [],
                swerve: 0,
                allowIn: player.allowIn,
                allowOut: player.allowOut,
                corner: player.corner,
                cornerStops: player.cornerStops,
                cornerDamage: 0,
                addCornerDamage: 0,
                pathDanger: 0
            }
        ];
        var lastDistance = 0;
        var locationsThisDistance = [];
        _processQueue();

        function _processQueue() {
            touchedSpaces++;

            var entry = workQueue.shift();
            if (entry.distance + 1 > lastDistance) {
                lastDistance = entry.distance + 1;
                locationsThisDistance = [];
                console.log("starting work on spaces at distance " + lastDistance + " (" + touchedSpaces + " spaces already processed)");
            }

            var space = map.spaces[entry.space];

            var swerveIndex = 0;
            var newEntry;

            if (space.forward !== null) {
                if (_isBlocked(space.forward))
                    swerveIndex = 1;
                else
                    newEntry = _pushOption(space.forward, Math.abs(entry.swerve) === 1 ? entry.swerve * 2 : 0);
            }

            if (space.outside !== null) {
                if (!_isBlocked(space.outside) && (entry.allowOut || entry.swerve === -2)) {
                    newEntry = _pushOption(space.outside, swerveIndex);
                    if (entry.swerve !== -2 && !space.corner)
                        newEntry.allowIn = false;
                }
            }

            if (space.inside !== null) {
                if (!_isBlocked(space.inside) && (entry.allowIn || entry.swerve === 2)) {
                    newEntry = _pushOption(space.inside, swerveIndex);
                    if (entry.swerve !== 2 && !space.corner)
                        newEntry.allowOut = false;
                }
            }

            if (workQueue.length)
                setTimeout(_processQueue, 1);
            else {
                console.log("processed " + touchedSpaces + " spaces and found " + availableSpaces.length + " options");
                _mergeOptions(availableSpaces);
                console.log("merged available options, " + availableSpaces.length + " now available");
                player.moveOptions = availableSpaces;

                io.to(game.id).emit("updatePlayers", game.players);
                if (availableSpaces.length < 1) {
                    autoMoveTimeouts[game.id] = setTimeout(_nextPlayer, 1000); 
                }
            }

            function _pushOption(spaceIndex, isSwerve) {
                var target = map.spaces[spaceIndex];
                var distance = entry.distance + 1;
                var processDownstream = distance < movePoints;
                var damageMsg = "";
                var brakingDamage = Math.max(0, movePoints - distance);
                var tireDamage = Math.max(0, Math.min(brakingDamage - 3, 3));
                var brakeDamage = Math.min(brakingDamage, 3);
                if (brakeDamage > 0)
                    damageMsg = brakeDamage + " brake damage";
                if (tireDamage > 0)
                    damageMsg += " and " + tireDamage + " tire damage from braking";
                var destroy = brakingDamage > 6;
                if (destroy)
                    damageMsg = "Braking 7+ spaces destroys your car";
                var newPath = deepCopy(entry.path);
                newPath.push(spaceIndex);
                var nextEntry = {
                    space: spaceIndex,
                    dangerous: (game.dangerSpaces.indexOf(spaceIndex) >= 0),
                    brakeDamage: brakeDamage,
                    tireDamage: tireDamage,
                    totalDamage: brakeDamage + tireDamage,
                    destroy: destroy,
                    damageMsg: damageMsg,
                    distance: distance,
                    path: newPath,
                    swerve: isSwerve,
                    allowIn: (target.corner ? true : entry.allowIn),
                    allowOut: (target.corner ? true : entry.allowOut),
                    cornerStops: entry.cornerStops,
                    addCornerDamage: entry.addCornerDamage
                };
                nextEntry.pathDanger = (nextEntry.dangerous ? 1 : 0) + entry.pathDanger;

                _processCornerDamage();

                if (_isMyPitStop(game, player, spaceIndex)) {
                    nextEntry.pitStop = true;
                    nextEntry.allowOut = true;
                    nextEntry.slowStop = _percentChance(50);
                    nextEntry.totalDamage -= nextEntry.brakeDamage;
                    nextEntry.totalDamage -= nextEntry.tireDamage;
                    nextEntry.brakeDamage = 0;
                    nextEntry.tireDamage = 0;
                    if (!game.advanced) {
                        nextEntry.totalDamage = Math.max(player.damage - 20, -10); //should give a negative number so we actually repair
                        nextEntry.damageMsg = "Pit Stop: " + (-nextEntry.totalDamage) + " damage repaired!";
                    } else {
                        nextEntry.tireDamage = player.damage.tires - 10;
                        nextEntry.totalDamage += nextEntry.tireDamage;
                        nextEntry.damageMsg = "Pit Stop: Tire damage repaired!";
                    }
                    nextEntry.destroy = false;
                    processDownstream = false;
                }

                if (locationsThisDistance.indexOf(spaceIndex) < 0) {
                    locationsThisDistance.push(spaceIndex);
                    availableSpaces.push(nextEntry);
                    if (processDownstream)
                        workQueue.push(nextEntry);
                }
                return nextEntry;

                function _processCornerDamage() {
                    var cornerStops = entry.cornerStops;
                    nextEntry.corner = target.corner;
                    nextEntry.cornerDamage = entry.cornerDamage;
                    if (!target.corner)
                        nextEntry.cornerStops = 0;
                    if (!target.corner && entry.corner) {
                        var corner = corners[entry.corner - 1];
                        if (cornerStops < corner.requiredStops)
                            nextEntry.addCornerDamage++;
                        if (cornerStops < corner.requiredStops - 1) {
                            nextEntry.damageMsg = "Overshooting a corner by more than 1 required stop destroys your car";
                            nextEntry.destroy = true;
                            processDownstream = false;
                        }
                    }
                    nextEntry.cornerDamage += nextEntry.addCornerDamage;
                    nextEntry.totalDamage += nextEntry.cornerDamage;
                    if (nextEntry.cornerDamage && !nextEntry.destroy) {
                        var cornerDamageMsg = nextEntry.cornerDamage + " tire damage from overshooting a corner";
                        if (nextEntry.damageMsg === "")
                            nextEntry.damageMsg = cornerDamageMsg;
                        else
                            nextEntry.damageMsg += " and " + cornerDamageMsg;
                    }
                    if (!game.advanced) {
                        if (nextEntry.totalDamage > player.damage) {
                            nextEntry.destroy = true;
                        } else if (nextEntry.totalDamage === player.damage) {
                            _spinoutCheck(nextEntry);
                        }
                    } else {
                        if (nextEntry.tireDamage + nextEntry.cornerDamage > player.damage.tires) {
                            nextEntry.destroy = true;
                        } else if (nextEntry.tireDamage + nextEntry.cornerDamage === player.damage.tires) {
                            _spinoutCheck(nextEntry);
                        }
                        nextEntry.destroy |= (nextEntry.brakeDamage >= player.damage.brakes);
                    }

                    function _spinoutCheck(moveEntry) {
                        if (moveEntry.cornerDamage) {
                            moveEntry.totalDamage -= 1;
                            moveEntry.cornerDamage -= 1;
                            moveEntry.spinout = true;
                        } else {
                            moveEntry.destroy = true;
                        }
                    }
                }
            }

            function _isBlocked(spaceIndex) {
                var blockingPlayerIndex = playerLocations.indexOf(spaceIndex);
                return blockingPlayerIndex >= 0 && !_isMyPitStop(game, blockingPlayerIndex, spaceIndex);
            }
        }

        function _getPlayerLocations(players) {
            var locations = [];
            for (var i = 0; i < players.length; i++) {
                locations.push(players[i].location);
            }
            return locations;
        }
        function _mergeOptions(options) {
            var optionMap = {};
            for (var i = 0; i < options.length; i++) {
                var option = options[i];
                var conflict = optionMap[option.space];
                if (conflict && conflict.totalDamage < option.totalDamage)
                    continue;
                optionMap[options[i].space] = option;
            }
            options.length = 0;
            for (var key in optionMap) {
                options.push(optionMap[key]);
            }
        }
    }

    function _remainingPlayers(game) {
        var players = [];
        for (var i = 0; i < game.players.length; i++) {
            var player = game.players[i];
            if (!player.destroyed && !player.finished)
                players.push(player);
        }
        return players;
    }

    function _updateLeaders(game) {
        var players = game.players;
        var spaces = game.map.spaces.length;
        var placeOrder = deepCopy(game.winners);
        var locations = []; //all players, including destroyed & finished
        var sortedLocations = [];
        for (var i = 0; i < players.length; i++) {
            var player = players[i];
            player.place = 'DNF';
            var cumulativeLocation = player.lap * spaces + player.location;
            if (player.destroyed || player.finished)
                cumulativeLocation *= -1;
            locations.push(cumulativeLocation);
            if (!player.destroyed && !player.finished)
                sortedLocations.push(cumulativeLocation);
        }
        console.log(locations);
        sortedLocations.sort(function (a, b) {
            return a - b;
        });
        var i;
        for (i = sortedLocations.length - 1; i >= 0; i--) {
            placeOrder.push(locations.indexOf(sortedLocations[i]));
        }
        for (i = 0; i < placeOrder.length; i++) {
            players[placeOrder[i]].place = i + 1;
        }
    }

    function _sortPlayers(game) {
        var players = game.players;
        var spaces = game.map.spaces.length;
        var locations = []; //all players, including destroyed &
        var sortedLocations = [];
        for (var i = 0; i < players.length; i++) {
            var player = players[i];
            var cumulativeLocation = player.lap * spaces + player.location;
            if (player.destroyed || player.finished)
                cumulativeLocation *= -1;
            locations.push(cumulativeLocation);
            if (!player.destroyed && !player.finished)
                sortedLocations.push(cumulativeLocation);
        }
        console.log(locations);
        sortedLocations.sort(function (a, b) {
            return a - b;
        });
        console.log(sortedLocations);
        for (var i = sortedLocations.length - 1; i >= 0; i--) {
            game.playerOrder.push(locations.indexOf(sortedLocations[i]));
        }
        console.log(game.playerOrder);
    }

    function _gameOver(game) {
        var rankings = [];
        var i;
        for (i = 0; i < game.winners.length; i++) {
            rankings.push({
                place: i + 1,
                name: game.players[game.winners[i]].name
            });
        }
        for (i = 0; i < game.players.length; i++) {
            if (game.winners.indexOf(i) < 0) {
                rankings.push({
                    place: 'DNF',
                    name: game.players[i].name
                });
            }
        }
        io.to(game.id).emit("gameOver", {
            rankings: rankings
        });
        games.gameOver(game);
        game.running = false;
        game.players = [];
        game.activePlayer = null;
    }

    function _applyMoveDamage(game, player, move) {
        var dangerDamage = 0;
        for (var i = 0; i < move.pathDanger; i++)
            if (_percentChance(5))
                dangerDamage++;
        if (dangerDamage)
            _sysMessage(game, player.name + " took " + dangerDamage + " suspension damage from dangerous spaces");
        if (!game.advanced)
            simpleDamage();
        else
            advancedDamage();
        if (move.destroy) {
            player.location = move.space;
            _destroyPlayer(game, player);
        }

        function simpleDamage() {
            player.damage -= dangerDamage;
            if (player.damage <= 0)
                move.destroy = true;
            player.damage -= move.totalDamage;
            if (player.damage <= 0)
                move.destroy = true;
            if (move.totalDamage > 0)
                _sysMessage(game, player.name + " took " + move.totalDamage + " damage");
            else if (move.totalDamage < 0)
                _sysMessage(game, player.name + " repaired " + (0 - move.totalDamage) + " damage in the pits.");
        }

        function advancedDamage() {
            if (move.tireDamage)
                player.damage.tires -= move.tireDamage;
            if (move.cornerDamage)
                player.damage.tires -= move.cornerDamage;
            if (move.brakeDamage)
                player.damage.brakes -= move.brakeDamage;
            if (dangerDamage)
                player.damage.suspension -= dangerDamage;
        }
    }

    function _percentChance(percentChance) {
        return Math.random() * 100 <= percentChance;
    }

    function _checkDamage(game, player) {
        if (!game.advanced) {
            if (player.damage <= 0) {
                _destroyPlayer(game, player);
            }
        } else {
            for (var key in player.damage) {
                if (player.damage[key] <= 0) {
                    _destroyPlayer(game, player);
                    return;
                }
            }
        }
    }

    function _adjacentDamage(game, player) {
        function _isPitStop(spaceIndex) {
            return game.map.pitStops.indexOf(spaceIndex) >= 0;
        }

        if (_isPitStop(player.location))
            return;
        var space = game.map.spaces[player.location];
        var adjacentSpaces = [];
        var i;
        for (i = 0; i < space.adjacent.length; i++)
            if (!_isPitStop(space.adjacent[i]))
                adjacentSpaces.push(space.adjacent[i]);

        for (i = 0; i < space.moveTargets.length; i++)
            if (!_isPitStop(space.moveTargets[i]))
                adjacentSpaces.push(space.moveTargets[i]);

        var adjacentPlayers = [];
        for (i = 0; i < game.players.length; i++) {
            if (adjacentSpaces.indexOf(game.players[i].location) >= 0) {
                adjacentPlayers.push(game.players[i]);
                adjacentPlayers.push(player); //once for each adjacent player
            }
        }
        while (adjacentPlayers.length) {
            var p = adjacentPlayers.shift();
            if (_percentChance(5)) {
                if (!game.advanced) {
                    p.damage--;
                } else {
                    p.damage.body--;
                }
                _sysMessage(game, p.name + " takes 1 body damage from collision - this space is now dangerous!");
                _markDangerousSpace(game, p.location);
                _checkDamage(game, p);
            } else
                _sysMessage(game, p.name + " takes no damage from collision");
        }
    }

    function _ordinality(ordinal) {

        var suffix = "th";
        if (ordinal < 10 || ordinal > 20) //teens are all "th"
            switch (ordinal % 10) {
                case 1:
                    suffix = "st";
                    break;
                case 2:
                    suffix = "nd";
                    break;
                case 3:
                    suffix = "rd";
                    break;
            }
        return ordinal + suffix;
    }

    function _destroyPlayer(game, player) {
        var message = player.name + " is out of the race!  This space is now dangerous!";
        var playerIndex = game.players.indexOf(player);
        var place = game.winners.indexOf(playerIndex);
        if (place >= 0) {
            message = player.name + " will be rewarded " + _ordinality(place + 1) + " place posthumously.";
        }
        io.to(game.id).emit("destroyPlayer", player);
        _sysMessage(game, message);
        _markDangerousSpace(game, player.location);
        player.location = -1;
        player.destroyed = true;
    }

    function _markDangerousSpace(game, spaceIndex) {
        if (game.dangerSpaces.indexOf(spaceIndex) < 0) {
            game.dangerSpaces.push(spaceIndex);
            io.to(game.id).emit("dangerSpaces", game.dangerSpaces);
        }
    }

    function _sysMessage(game, message) {
        io.to(game.id).emit("sysMessage", message);
    }

    function _sysNotify(game, message) {
        io.to(game.id).emit("sysWarning", message);
    }

    function _applyEngineDamage(game, player) {
        _markDangerousSpace(game, player.location);
        if (!game.advanced) {
            player.damage--;
        } else {
            player.damage.engine--;
        }
        _checkDamage(game, player);
    }

    console.log("runtime initialized for socket " + socket.id);

    return function () {
        var player = games.getPlayer(socket);
        if (player) {
            console.log("marking " + player.name + " as disconnected");
            player.disconnected = true;
        }
    };
}
