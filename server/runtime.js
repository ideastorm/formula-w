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

module.exports.bind = function (socket, io, games) {
    socket.on('gearSelect', function (selectedGear) {
        var game = games.lookup(socket);
        var playerIndex = games.getPlayerIndex(game, socket.userId);
        if (playerIndex === game.activePlayer) {
            var player = game.players[playerIndex];
            _validateAndUpdateGearSelection(game, player, +selectedGear);
            if (player.gearSelected)
                setTimeout(function () {
                    _calculateMoveOptions(game, player);
                }, 100);
            else
                socket.emit("updatePlayers", game.players);
        }
    });
    socket.on('selectMove', function (selectedMove) {
        var game = games.lookup(socket);
        var playerIndex = games.getPlayerIndex(game, socket.userId);
        if (playerIndex === game.activePlayer) {
            var player = game.players[playerIndex];
            var move = player.moveOptions[selectedMove];
            if (move.space < player.location) {
                player.lap++;
            }
            io.to(game.id).emit("activePlayerMove", move.path);
            _applyDamage(game, player, move);
            player.location = move.space;
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
            if (!game.playerOrder.length) {
                console.log("Recycling player list");
                _sortPlayers(game);
            }
            game.activePlayer = game.playerOrder.shift();
            if (player.lap >= game.laps) {
                _gameOver(game, player);
            }
            console.log("active player: " + game.activePlayer);
            if (typeof game.activePlayer === 'number') {
                game.players[game.activePlayer].gearSelected = false;
                io.to(game.id).emit("updatePlayers", game.players);
                io.to(game.id).emit("currentPlayer", game.activePlayer);
            } else {
                _gameOver(game, null);
            }
        }
    });


function _validateAndUpdateGearSelection(game, player, selectedGear) {
    console.log("desired gear: " + selectedGear);
    console.log(typeof selectedGear);
    if (typeof selectedGear !== 'number' || selectedGear < 1 || selectedGear > 6 || selectedGear > player.activeGear + 1)
        return;
    var damage = (player.activeGear - 1) - selectedGear;
    console.log("damage from selecting desired gear: " + damage);
    var availableDamage = !game.advanced ? player.damage : player.damage.transmission;
    console.log("available damage: " + availableDamage);
    if (availableDamage < damage) {
        console.log("rejecting gear selection");
        socket.emit("chatMessage", {from: "System", message: "Downshifting to " + selectedGear + " will destroy your car."});
        return;
    }
    console.log("accepting gear selection");
    player.gearSelected = true;
    player.activeGear = selectedGear;
    if (damage > 0) {
        console.log("taking damage");
        io.to(game.id).emit({from: player.name, message: "I took " + damage + " damage for aggressive downshifting"});
        if (!game.advanced) {
            player.damage -= damage;
        } else {
            player.damage.transmission -= damage;
        }
    }
}

function _movementPoints(gear) {
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
    var index = Math.floor(Math.random() * options.length);
    return options[index];
}

function _calculateMoveOptions(game, player) {
    var map = game.map;
    var corners = map.corners;
    var playerLocations = _getPlayerLocations(game.players);
    var movePoints = _movementPoints(player.activeGear);
    var touchedSpaces = 0;
    console.log(player.name + " rolled a " + movePoints + ", calculating move options");
    io.to(game.id).emit("chatMessage", {from: player.name, message: "I rolled a " + movePoints});
    var availableSpaces = [];
    var workQueue = [{space: player.location,
            distance: 0,
            path: [],
            swerve: 0,
            allowIn: player.allowIn,
            allowOut: player.allowOut,
            corner: player.currentCorner,
            cornerStops: player.cornerStops,
            cornerDamage: 0,
            addCornerDamage: 0}];
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
        else
        {
            console.log("processed " + touchedSpaces + " spaces and found " + availableSpaces.length + " options");
            _mergeOptions(availableSpaces);
            console.log("merged available options, " + availableSpaces.length + " now available");
            player.moveOptions = availableSpaces;

            io.to(game.id).emit("updatePlayers", game.players);
        }

        function _pushOption(spaceIndex, isSwerve) {
            var distance = entry.distance + 1;
            var processDownstream = distance < movePoints;
            var brakingDamage = Math.max(0, movePoints - distance);
            var tireDamage = Math.max(0, Math.min(brakingDamage - 3, 3));
            var brakeDamage = Math.min(brakingDamage, 3);
            var destroy = brakingDamage > 6;
            var newPath = deepCopy(entry.path);
            newPath.push(spaceIndex);
            var nextEntry = {
                space: spaceIndex,
                brakingDamage: brakeDamage,
                tireDamage: tireDamage,
                totalDamage: brakeDamage + tireDamage,
                destroy: destroy,
                distance: distance,
                path: newPath,
                swerve: isSwerve,
                allowIn: (space.corner ? true : entry.allowIn),
                allowOut: (space.corner ? true : entry.allowOut),
                cornerStops: entry.cornerStops,
                addCornerDamage: entry.addCornerDamage
            };

            _processCornerDamage();

            if (locationsThisDistance.indexOf(spaceIndex) < 0) {
                locationsThisDistance.push(spaceIndex);
                availableSpaces.push(nextEntry);
                if (processDownstream)
                    workQueue.push(nextEntry);
            }
            return nextEntry;

            function _processCornerDamage() {
                var target = map.spaces[spaceIndex];
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
                        nextEntry.destroy = true;
                        processDownstream = false;
                    }
                }
                nextEntry.cornerDamage += nextEntry.addCornerDamage;
                nextEntry.totalDamage += nextEntry.cornerDamage;
                if (!game.advanced) {
                    if (nextEntry.totalDamage >= player.damage) {
                        nextEntry.destroy = true;
                    }
                } else
                    console.log("Advanced damage not implemented");
            }
        }

        function _isBlocked(spaceIndex) {
            return playerLocations.indexOf(spaceIndex) >= 0;
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
        if (!game.players[i].destroyed)
            players.push(game.players[i]);
    }
    return players;
}

function _sortPlayers(game) {
    var players = game.players;
    var spaces = game.map.spaces.length;
    var locations = [];
    for (var i = 0; i < players.length; i++) {
        var player = players[i];
        if (!player.destroyed)
            locations.push(player.lap * spaces + player.location);
    }
    var sortedLocations = deepCopy(locations);
    sortedLocations.sort();
    for (var i = sortedLocations.length - 1; i >= 0; i--) {
        game.playerOrder.push(locations.indexOf(sortedLocations[i]));
    }
}

function _gameOver(game, winner) {
    var message = {winner: winner ? winner.name : null};
    io.to(game.id).emit("gameOver", message);
    game.running = false;
    game.players = [];
    games.gameOver(game);
}

function _applyDamage(game, player, move) {
    if (!game.advanced)
        simpleDamage();
    else
        advancedDamage();
    if (move.destroy) {
        io.to(game.id).emit("chatMessage", {from: "System", message: player.name + " has destroyed their car."});
        player.destroyed = true;
        var remaining = _remainingPlayers(game);
        if (remaining.count === 1) {
            _gameOver(game, remaining[0]);
        }
    }

    function simpleDamage() {
        player.damage -= move.totalDamage;
        if (player.damage <= 0)
            move.destroy = true;
        if (move.totalDamage > 0)
            io.to(game.id).emit("chatMessage", {from: player.name, message: "I took " + move.totalDamage + " damage"});
    }

    function advancedDamage() {
        io.to(game.id).emit("chatMessage", {from: "System", message: "Damage for advanced games isn't implemented!"});
    }
}

};