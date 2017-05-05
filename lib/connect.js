"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var rxjs_1 = require("rxjs");
var connection_adapter_1 = require("connection-adapter");
var hat = require('hat');
var Connect = (function () {
    function Connect(params) {
        this.adapterConnected = false;
        this.commandsAwaitingResponse = [];
        this.guaranteedCommandsToBeSent = [];
        this.pushEvents = new rxjs_1.ReplaySubject(null);
        this.instanceId = params.instanceId || 'connect';
        this.adapter = params.adapter;
        this.subscribeToAdapter();
    }
    Connect.prototype.subscribeToAdapter = function () {
        this.adapter.state
            .filter(function (state) { return state === connection_adapter_1.AdapterConnectionStates.CONNECTED; })
            .subscribe(this.onOpen.bind(this));
        this.adapter.state
            .filter(function (state) { return state === connection_adapter_1.AdapterConnectionStates.DISCONNECTED; })
            .subscribe(this.onEnd.bind(this));
        this.adapter.data.subscribe(this.onData.bind(this));
    };
    Connect.prototype.onOpen = function () {
        this.adapterConnected = true;
        this.callGuaranteedCommands();
    };
    Connect.prototype.callGuaranteedCommands = function () {
        var _this = this;
        this.guaranteedCommandsToBeSent.forEach(function (commandToBeSent) {
            var _a = commandToBeSent.command.message, payloadType = _a.payloadType, payload = _a.payload;
            var clientMsgId = commandToBeSent.clientMsgId;
            _this.commandsAwaitingResponse.push(commandToBeSent);
            _this.adapter.send({ payloadType: payloadType, payload: payload, clientMsgId: clientMsgId });
            _this.removeCommandFromList(commandToBeSent, _this.guaranteedCommandsToBeSent);
        });
    };
    Connect.prototype.onData = function (data) {
        if (data.clientMsgId) {
            this.processData(data);
        }
        else {
            this.processPushEvent(data);
        }
    };
    Connect.prototype.processData = function (data) {
        var _this = this;
        this.commandsAwaitingResponse.forEach(function (sentCommand) {
            if (sentCommand.clientMsgId === data.clientMsgId) {
                sentCommand.command.onResponse({ payload: data.payload, payloadType: data.payloadType });
                if (!sentCommand.command.multiResponse) {
                    _this.removeCommandFromList(sentCommand, _this.commandsAwaitingResponse);
                }
            }
        });
    };
    Connect.prototype.removeCommandFromList = function (commandToRemove, listUsed) {
        var commandToRemoveIndex = listUsed.findIndex(function (command) {
            return command.clientMsgId === commandToRemove.clientMsgId;
        });
        if (commandToRemoveIndex >= 0) {
            listUsed.splice(commandToRemoveIndex, 1);
        }
    };
    Connect.prototype.processPushEvent = function (message) {
        var payload = message.payload, payloadType = message.payloadType;
        this.pushEvents.next({ payload: payload, payloadType: payloadType });
    };
    Connect.prototype.onEnd = function () {
        var _this = this;
        this.adapterConnected = false;
        this.commandsAwaitingResponse.forEach(function (sentCommand) {
            if (!sentCommand.command.guaranteed) {
                if (Boolean(sentCommand.command.onError)) {
                    var errDescription = "Message with payladType:" + sentCommand.command.message.payloadType + " was not sent. Connection was closed before sending";
                    sentCommand.command.onError(errDescription);
                }
                _this.removeCommandFromList(sentCommand, _this.commandsAwaitingResponse);
            }
            else {
                _this.guaranteedCommandsToBeSent.push(sentCommand);
            }
        });
    };
    Connect.prototype.sendCommand = function (command) {
        var clientMsgId = this.generateClientMsgId();
        var commandToCache = {
            clientMsgId: clientMsgId,
            command: command
        };
        var messageToSend = {
            clientMsgId: clientMsgId,
            payload: command.message.payload,
            payloadType: command.message.payloadType
        };
        if (this.adapterConnected) {
            this.commandsAwaitingResponse.push(commandToCache);
            this.adapter.send(messageToSend);
        }
        else {
            if (!command.guaranteed && Boolean(command.onError)) {
                var errDescription = "Message with payladType:" + command.message.payloadType + " was not sent. Connection is closed";
                command.onError(errDescription);
            }
            else {
                this.guaranteedCommandsToBeSent.push(commandToCache);
            }
        }
    };
    Connect.prototype.generateClientMsgId = function () {
        return hat();
    };
    Connect.prototype.setPushEventHandler = function (callback) {
        this.pushEvents.subscribe(callback);
    };
    return Connect;
}());
exports.Connect = Connect;
