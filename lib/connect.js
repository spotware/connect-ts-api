'use strict';
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var events_1 = require('events');
var State = (function () {
    function State() {
        this.disconnected();
    }
    State.prototype.disconnected = function () {
        this.value = false;
    };
    State.prototype.connected = function () {
        this.value = true;
    };
    State.prototype.isConnected = function () {
        return this.value;
    };
    return State;
}());
exports.State = State;
var GuaranteedCommand = (function () {
    function GuaranteedCommand(msg) {
        this.msg = msg;
        this.promise = $.Deferred();
    }
    GuaranteedCommand.prototype.done = function (msg) {
        this.promise.resolve(msg);
        this.destroy();
    };
    GuaranteedCommand.prototype.fail = function (msg) {
        this.promise.reject(msg);
        this.destroy();
    };
    GuaranteedCommand.prototype.destroy = function () {
        delete this.msg;
    };
    return GuaranteedCommand;
}());
exports.GuaranteedCommand = GuaranteedCommand;
var GuaranteedCommands = (function () {
    function GuaranteedCommands(params) {
        this.state = params.state;
        this.send = params.send;
        this.openCommands = [];
    }
    GuaranteedCommands.prototype.create = function (msg) {
        var command = new GuaranteedCommand(msg);
        this.openCommands.push(command);
        if (this.state.isConnected()) {
            this.send(msg);
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
        var index = 0;
        while (index < openCommandsLength) {
            var command = openCommands[index];
            if (command.msg.clientMsgId === clientMsgId) {
                openCommands.splice(index, 1);
                return command;
            }
            index += 1;
        }
    };
    return GuaranteedCommands;
}());
exports.GuaranteedCommands = GuaranteedCommands;
var Command = (function () {
    function Command(msg) {
        this.msg = msg;
        this.promise = $.Deferred();
    }
    Command.prototype.done = function (respond) {
        this.promise.resolve(respond);
        this.destroy();
    };
    Command.prototype.fail = function (respond) {
        this.promise.reject(respond);
        this.destroy();
    };
    Command.prototype.destroy = function () {
        delete this.msg;
    };
    return Command;
}());
exports.Command = Command;
var Commands = (function () {
    function Commands(params) {
        this.state = params.state;
        this.send = params.send;
        this.openCommands = [];
    }
    Commands.prototype.create = function (msg) {
        var command = new Command(msg);
        this.openCommands.push(command);
        if (this.state.isConnected()) {
            this.send(msg);
        }
        else {
            command.fail(undefined);
        }
        return command.promise;
    };
    Commands.prototype.fail = function () {
        this.openCommands.forEach(function (command) {
            command.fail();
        });
    };
    Commands.prototype.extract = function (clientMsgId) {
        var openCommands = this.openCommands;
        var openCommandsLength = openCommands.length;
        var command;
        var index = 0;
        while (index < openCommandsLength) {
            var command = openCommands[index];
            if (command.msg.clientMsgId === clientMsgId) {
                openCommands.splice(index, 1);
                return command;
            }
            index += 1;
        }
    };
    return Commands;
}());
exports.Commands = Commands;
var Connect = (function (_super) {
    __extends(Connect, _super);
    function Connect(params) {
        _super.call(this);
        this.adapter = params.adapter;
        this.encodeDecode = params.encodeDecode;
        this.protocol = params.protocol;
        this.initialization();
    }
    Connect.prototype.setAdapter = function (adapter) {
        this.adapter = adapter;
    };
    Connect.prototype.initialization = function () {
        this.state = new State();
        this.guaranteedCommands = new GuaranteedCommands({
            state: this.state,
            send: this.send.bind(this)
        });
        this.commands = new Commands({
            state: this.state,
            send: this.send.bind(this)
        });
        this.encodeDecode.registerDecodeHandler(this.onMessage.bind(this));
    };
    Connect.prototype.start = function () {
        var _this = this;
        var def = $.Deferred();
        var adapter = this.adapter;
        adapter.onOpen = function () {
            _this.onOpen();
            def.resolve();
        };
        adapter.onData = this.onData.bind(this);
        adapter.onError = adapter.onEnd = function (e) {
            def.reject();
            _this._onEnd(e);
        };
        adapter.connect();
        return def;
    };
    Connect.prototype.onData = function (data) {
        this.encodeDecode.decode(data);
    };
    Connect.prototype.onOpen = function () {
        this.state.connected();
        this.guaranteedCommands.resend();
        this.onConnect();
    };
    Connect.prototype.sendGuaranteedCommand = function (payloadType, params) {
        return this.guaranteedCommands.create(this.protocol.encode(payloadType, params));
    };
    Connect.prototype.sendCommand = function (payloadType, params) {
        return this.commands.create(this.protocol.encode(payloadType, params));
    };
    Connect.prototype.send = function (msg) {
        var data = this.encodeDecode.encode(msg);
        this.adapter.send(data);
    };
    Connect.prototype.onMessage = function (data) {
        data = this.protocol.decode(data);
        var msg = data.msg;
        var payloadType = data.payloadType;
        var clientMsgId = data.clientMsgId;
        if (clientMsgId) {
            this.processMessage(msg, clientMsgId, payloadType);
        }
        else {
            this.processPushEvent(msg, payloadType);
        }
    };
    Connect.prototype.isError = function (payloadType) {
        return false;
    };
    Connect.prototype.processMessage = function (msg, clientMsgId, payloadType) {
        var command = this.guaranteedCommands.extract(clientMsgId) || this.commands.extract(clientMsgId);
        if (command) {
            if (this.isError(payloadType)) {
                command.fail(msg);
            }
            else {
                command.done(msg);
            }
        }
    };
    Connect.prototype.processPushEvent = function (msg, payloadType) {
        this.emit(payloadType, msg);
    };
    Connect.prototype._onEnd = function (e) {
        this.state.disconnected();
        this.commands.fail();
        this.onEnd(e);
    };
    Connect.prototype.isDisconnected = function () {
        return !this.state.isConnected();
    };
    Connect.prototype.isConnected = function () {
        return this.state.isConnected();
    };
    Connect.prototype.onConnect = function () { };
    Connect.prototype.onEnd = function (e) { };
    return Connect;
}(events_1.EventEmitter));
exports.Connect = Connect;
//# sourceMappingURL=connect.js.map