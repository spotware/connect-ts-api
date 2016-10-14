"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var hat = require('hat');
var events_1 = require('events');
var Connect = (function (_super) {
    __extends(Connect, _super);
    function Connect(params) {
        _super.call(this);
        this._isConnected = false;
        this.incomingMessagesListeners = [];
        this.callbacksOnConnect = [];
        this.encodeDecode = params.encodeDecode;
        this.protocol = params.protocol;
        this.handlePushEvent = params.onPushEvent;
        this.initialization();
    }
    Connect.prototype.getAdapter = function () {
        return this.adapter;
    };
    Connect.prototype.setAdapter = function (adapter) {
        this.adapter = adapter;
    };
    Connect.prototype.initialization = function () {
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
        return def.promise();
    };
    Connect.prototype.onData = function (data) {
        this.encodeDecode.decode(data);
    };
    Connect.prototype.onOpen = function () {
        this._isConnected = true;
        this.onConnect();
        this.callbacksOnConnect.forEach(function (fn) { return fn(); });
        this.callbacksOnConnect = [];
    };
    Connect.prototype.sendGuaranteedCommand = function (payloadType, params) {
        return this.sendGuaranteedCommandWithPayloadtype(payloadType, params).then(function (msg) { return msg.payload; });
    };
    Connect.prototype.sendCommand = function (payloadType, params) {
        return this.sendCommandWithPayloadtype(payloadType, params).then(function (msg) { return msg.payload; });
    };
    Connect.prototype.send = function (data) {
        this.adapter.send(this.encodeDecode.encode(data));
    };
    Connect.prototype.onMessage = function (data) {
        data = this.protocol.decode(data);
        var msg = data.msg;
        var payloadType = data.payloadType;
        var clientMsgId = data.clientMsgId;
        if (clientMsgId) {
            this.processData(clientMsgId, payloadType, msg);
        }
        else {
            this.processPushEvent(msg, payloadType);
        }
    };
    Connect.prototype.processData = function (clientMsgId, payloadType, msg) {
        var isProcessed = false;
        var message = {
            clientMsgId: clientMsgId,
            payloadType: payloadType,
            payload: msg
        };
        this.incomingMessagesListeners.forEach(function (listener) {
            if (listener.shouldProcess(message)) {
                isProcessed = true;
                listener.handler(message);
            }
        });
        if (!isProcessed) {
            this.processPushEvent(msg, payloadType);
        }
    };
    Connect.prototype.isError = function (payloadType) {
        return false;
    };
    Connect.prototype.processMessage = function (command, msg, payloadType) {
        if (this.isError(payloadType)) {
            command.fail(msg);
        }
        else {
            command.done(msg);
        }
    };
    Connect.prototype.processPushEvent = function (msg, payloadType) {
        if (this.handlePushEvent) {
            this.handlePushEvent({ payload: msg, payloadType: payloadType });
        }
        this.emit(payloadType, msg);
    };
    Connect.prototype._onEnd = function (e) {
        this._isConnected = false;
        this.incomingMessagesListeners.forEach(function (listener) {
            listener.disconnectHandler();
        });
        this.incomingMessagesListeners = [];
        this.onEnd(e);
    };
    Connect.prototype.isDisconnected = function () {
        return !this._isConnected;
    };
    Connect.prototype.isConnected = function () {
        return this._isConnected;
    };
    Connect.prototype.addIncomingMessagesListener = function (fnToAdd) {
        this.incomingMessagesListeners.push(fnToAdd);
    };
    Connect.prototype.removeIncomingMesssagesListener = function (fnToRemove) {
        this.incomingMessagesListeners = this.incomingMessagesListeners.filter(function (fn) { return fn != fnToRemove; });
    };
    Connect.prototype.sendCommandWithoutResponse = function (payloadType, payload) {
        this.send(this.protocol.encode(payloadType, payload, hat()));
    };
    Connect.prototype.sendMultiresponseCommand = function (payloadType, payload, onMessage, onError) {
        var _this = this;
        var msgId = hat();
        var incomingMessagesListener = {
            handler: function (msg) {
                var shouldUnsubscribe = onMessage(msg);
                if (shouldUnsubscribe) {
                    _this.removeIncomingMesssagesListener(incomingMessagesListener);
                }
            },
            shouldProcess: function (msg) { return msg.clientMsgId == msgId; },
            disconnectHandler: function () {
                if (onError) {
                    _this.removeIncomingMesssagesListener(incomingMessagesListener);
                    onError();
                }
            }
        };
        this.addIncomingMessagesListener(incomingMessagesListener);
        if (this.isConnected()) {
            try {
                this.send(this.protocol.encode(payloadType, payload, msgId));
            }
            catch (e) {
                onError();
            }
        }
        else {
            onError();
        }
    };
    Connect.prototype.sendCommandWithPayloadtype = function (payloadType, payload) {
        var _this = this;
        var def = $.Deferred();
        this.sendMultiresponseCommand(payloadType, payload, function (result) {
            if (_this.isError(result.payloadType)) {
                def.reject(result);
            }
            else {
                def.resolve(result);
            }
            return true;
        }, function () {
            def.reject();
        });
        return def.promise();
    };
    Connect.prototype.sendGuaranteedCommandWithPayloadtype = function (payloadType, payload) {
        var _this = this;
        if (this.isConnected()) {
            return this.sendCommandWithPayloadtype(payloadType, payload);
        }
        else {
            var def = $.Deferred();
            this.callbacksOnConnect.push(function () {
                _this.sendCommandWithPayloadtype(payloadType, payload)
                    .then(def.resolve, def.reject);
            });
            return def;
        }
    };
    Connect.prototype.onConnect = function () { };
    Connect.prototype.onEnd = function (e) { };
    return Connect;
}(events_1.EventEmitter));
exports.Connect = Connect;
//# sourceMappingURL=connect.js.map