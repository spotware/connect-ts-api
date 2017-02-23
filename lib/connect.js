"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
var hat = require('hat');
var events_1 = require("events");
var Connect = (function (_super) {
    __extends(Connect, _super);
    function Connect(params) {
        var _this = _super.call(this) || this;
        _this.connected = false;
        _this.incomingMessagesListeners = [];
        _this.callbacksOnConnect = [];
        _this.destroyingAdapter = false;
        _this.encodeDecode = params.encodeDecode;
        _this.adapter = params.adapter;
        return _this;
    }
    Connect.prototype.updateAdapter = function (adapter) {
        if (this.adapter) {
            this.destroyAdapter();
        }
        this.adapter = adapter;
    };
    Connect.prototype.start = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var adapter = _this.adapter;
            adapter.onOpen = function () {
                _this.onOpen();
                resolve();
            };
            adapter.onData = _this.onData.bind(_this);
            adapter.onError = adapter.onEnd = function (e) {
                reject();
                _this._onEnd(e);
            };
            adapter.connect();
        });
    };
    Connect.prototype.onOpen = function () {
        this.connected = true;
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
        console.assert(this.adapter, 'Fatal: Adapter must be defined, use updateAdapter');
        var encodedData = this.encodeDecode.encode(data);
        this.adapter.send(encodedData);
    };
    Connect.prototype.onData = function (data) {
        data = this.encodeDecode.decode(data);
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
        //Overwrite this method by your buisness logic
        return false;
    };
    Connect.prototype.processPushEvent = function (msg, payloadType) {
        //Overwrite this method by your business logic
    };
    Connect.prototype._onEnd = function (e) {
        this.connected = false;
        this.incomingMessagesListeners.forEach(function (listener) {
            var error = e || "Message {payladType: " + listener.message.payloadType + "} was not sent. Adapter ended";
            listener.disconnectHandler(error);
        });
        this.incomingMessagesListeners = [];
        this.onEnd(e);
    };
    Connect.prototype.isDisconnected = function () {
        return !this.connected;
    };
    Connect.prototype.isConnected = function () {
        return this.connected;
    };
    Connect.prototype.addIncomingMessagesListener = function (fnToAdd) {
        this.incomingMessagesListeners.push(fnToAdd);
    };
    Connect.prototype.removeIncomingMesssagesListener = function (fnToRemove) {
        this.incomingMessagesListeners = this.incomingMessagesListeners.filter(function (fn) { return fn != fnToRemove; });
    };
    Connect.prototype.sendCommandWithoutResponse = function (payloadType, payload) {
        this.send({ payloadType: payloadType, payload: payload, msgId: hat() });
    };
    Connect.prototype.sendMultiresponseCommand = function (multiResponseParams) {
        var _this = this;
        var payloadType = multiResponseParams.payloadType, payload = multiResponseParams.payload, onMessage = multiResponseParams.onMessage, onError = multiResponseParams.onError;
        if (this.isConnected()) {
            var msgId_1 = hat();
            var message = {
                clientMsgId: msgId_1,
                payloadType: payloadType
            };
            var incomingMessagesListener_1 = {
                message: message,
                handler: function (msg) {
                    var shouldUnsubscribe = onMessage(msg);
                    if (shouldUnsubscribe) {
                        _this.removeIncomingMesssagesListener(incomingMessagesListener_1);
                    }
                },
                shouldProcess: function (msg) { return msg.clientMsgId == msgId_1; },
                disconnectHandler: function (err) {
                    if (onError) {
                        _this.removeIncomingMesssagesListener(incomingMessagesListener_1);
                        onError(err);
                    }
                }
            };
            this.addIncomingMessagesListener(incomingMessagesListener_1);
            try {
                this.send({ payloadType: payloadType, payload: payload, msgId: msgId_1 });
            }
            catch (err) {
                onError(err);
            }
        }
        else {
            onError('Adapter not connected');
        }
    };
    Connect.prototype.sendCommandWithPayloadtype = function (payloadType, payload) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.sendMultiresponseCommand({
                payloadType: payloadType,
                payload: payload,
                onMessage: function (result) {
                    if (_this.isError(result.payloadType)) {
                        reject(result);
                    }
                    else {
                        resolve(result);
                    }
                    return true;
                },
                onError: function (err) {
                    reject(err);
                }
            });
        });
    };
    Connect.prototype.sendGuaranteedCommandWithPayloadtype = function (payloadType, payload) {
        var _this = this;
        if (this.isConnected()) {
            return this.sendCommandWithPayloadtype(payloadType, payload);
        }
        else {
            return new Promise(function (resolve, reject) {
                _this.callbacksOnConnect.push(function () {
                    _this.sendCommandWithPayloadtype(payloadType, payload)
                        .then(resolve, reject);
                });
            });
        }
    };
    Connect.prototype.onConnect = function () {
        //Overwrite this method by your business logic
    };
    Connect.prototype.onEnd = function (e) {
        //Overwrite this method by your business logic
    };
    Connect.prototype.destroyAdapter = function () {
        if (!this.adapter || this.destroyingAdapter) {
            return;
        }
        this.destroyingAdapter = true;
        this.adapter.onOpen = null;
        this.adapter.onData = null;
        this.adapter.onError = function () {
        };
        if (this.adapter.onEnd) {
            this.adapter.onEnd();
        }
        this.adapter.onEnd = function () {
        };
        if (this.adapter.destroy) {
            this.adapter.destroy();
        }
        this.adapter.destroy = function () {
        };
        this.adapter = null;
        this.destroyingAdapter = false;
    };
    return Connect;
}(events_1.EventEmitter));
exports.Connect = Connect;
