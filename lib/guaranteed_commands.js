"use strict";
var guaranteed_command_1 = require('./guaranteed_command');
var GuaranteedCommands = (function () {
    function GuaranteedCommands(params) {
        this.state = params.state;
        this.send = params.send;
        this.openCommands = [];
    }
    GuaranteedCommands.prototype.create = function (params) {
        var command = new guaranteed_command_1.GuaranteedCommand(params);
        this.openCommands.push(command);
        if (this.state.isConnected()) {
            this.send(command.msg);
        }
        return command.promise;
    };
    GuaranteedCommands.prototype.resend = function () {
        this.openCommands
            .map(function (command) {
            return command.msg;
        })
            .forEach(this.send);
    };
    GuaranteedCommands.prototype.extract = function (clientMsgId) {
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
    return GuaranteedCommands;
}());
exports.GuaranteedCommands = GuaranteedCommands;
//# sourceMappingURL=guaranteed_commands.js.map