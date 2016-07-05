"use strict";
var command_1 = require('./command');
var Commands = (function () {
    function Commands(params) {
        this.state = params.state;
        this.send = params.send;
        this.openCommands = [];
    }
    Commands.prototype.create = function (params) {
        var clientMsgId = params.clientMsgId;
        var msg = params.msg;
        var openCommands = this.openCommands;
        var command = new command_1.Command({
            clientMsgId: clientMsgId
        });
        openCommands.push(command);
        if (this.state.isConnected()) {
            this.send(msg);
        }
        else {
            command.fail(undefined);
            openCommands.splice(openCommands.indexOf(command), 1);
        }
        return command.promise;
    };
    Commands.prototype.fail = function () {
        var openCommands = this.openCommands;
        var command;
        for (var i = 0; i < openCommands.length; i += 1) {
            command = openCommands.pop();
            command.fail();
        }
    };
    Commands.prototype.extract = function (clientMsgId) {
        var openCommands = this.openCommands;
        var openCommandsLength = openCommands.length;
        var command;
        for (var i = 0; i < openCommandsLength; i += 1) {
            command = openCommands[i];
            if (command.clientMsgId === clientMsgId) {
                openCommands.splice(i, 1);
                return command;
            }
        }
    };
    return Commands;
}());
exports.Commands = Commands;
//# sourceMappingURL=commands.js.map