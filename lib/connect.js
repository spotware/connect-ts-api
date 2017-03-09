"use strict";
var hat = require('hat');
var SendRequestError;
(function (SendRequestError) {
    SendRequestError[SendRequestError["ADAPTER_DISCONNECTED"] = 1] = "ADAPTER_DISCONNECTED";
    SendRequestError[SendRequestError["ADAPTER_DROP"] = 2] = "ADAPTER_DROP";
    SendRequestError[SendRequestError["ADAPTER_DISRUPTED"] = 3] = "ADAPTER_DISRUPTED";
})(SendRequestError = exports.SendRequestError || (exports.SendRequestError = {}));
var Connect = (function () {
    function Connect(params) {
        this.connected = false;
        this.incomingMessagesListeners = [];
        this.guaranteedIncomingMessagesListeners = [];
        this.destroyingAdapter = false;
        this.encodeDecode = params.encodeDecode;
        this.adapter = params.adapter;
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
        this.callGuaranteedCommands();
        this.onConnect();
    };
    Connect.prototype.callGuaranteedCommands = function () {
        var _this = this;
        this.guaranteedIncomingMessagesListeners.forEach(function (listener) {
            var _a = listener.message, clientMsgId = _a.clientMsgId, payloadType = _a.payloadType, payload = _a.payload;
            _this.send({ payloadType: payloadType, payload: payload, clientMsgId: clientMsgId });
        });
    };
    Connect.prototype.send = function (data) {
        console.assert(this.adapter, 'Fatal: Adapter must be defined, use updateAdapter');
        var encodedData = this.encodeDecode.encode(data);
        this.adapter.send(encodedData);
    };
    Connect.prototype.onData = function (data) {
        var decodedData = this.encodeDecode.decode(data);
        var payload = decodedData.payload, payloadType = decodedData.payloadType, clientMsgId = decodedData.clientMsgId;
        if (clientMsgId) {
            this.processData(clientMsgId, payloadType, payload);
        }
        else {
            this.processPushEvent(payload, payloadType);
        }
    };
    Connect.prototype.processData = function (clientMsgId, payloadType, payload) {
        var isProcessed = false;
        var message = {
            clientMsgId: clientMsgId,
            payloadType: payloadType,
            payload: payload
        };
        this.incomingMessagesListeners.forEach(function (listener) {
            if (listener.shouldProcess(message)) {
                isProcessed = true;
                listener.handler(message);
            }
        });
        this.guaranteedIncomingMessagesListeners.forEach(function (guaranteedListener) {
            if (guaranteedListener.shouldProcess(message)) {
                isProcessed = true;
                guaranteedListener.handler(message);
            }
        });
        if (!isProcessed) {
            this.processPushEvent(payload, payloadType);
        }
    };
    Connect.prototype.isError = function (messageToCheck) {
        //Overwrite this method by your buisness logic
        return false;
    };
    Connect.prototype.processPushEvent = function (msg, payloadType) {
        //Overwrite this method by your business logic
    };
    Connect.prototype._onEnd = function (e) {
        this.connected = false;
        this.incomingMessagesListeners.forEach(function (listener) {
            var error = {
                errorCode: SendRequestError.ADAPTER_DROP,
                description: "Message with payladType:" + listener.message.payloadType + " was not sent. Adapter ended with reason: " + e
            };
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
    Connect.prototype.addGuaranteedIncomingMessagesListener = function (fnToAdd) {
        this.guaranteedIncomingMessagesListeners.push(fnToAdd);
    };
    Connect.prototype.removeIncomingMesssagesListener = function (fnToRemove) {
        this.incomingMessagesListeners = this.incomingMessagesListeners.filter(function (fn) { return fn != fnToRemove; });
    };
    Connect.prototype.removeIncomingGuaranteedMesssagesListener = function (fnToRemove) {
        this.guaranteedIncomingMessagesListeners = this.guaranteedIncomingMessagesListeners.filter(function (fn) { return fn != fnToRemove; });
    };
    Connect.prototype.sendCommandWithoutResponse = function (payloadType, payload) {
        this.send({ payloadType: payloadType, payload: payload, clientMsgId: this.generateClientMsgId() });
    };
    Connect.prototype.sendMultiresponseCommand = function (multiResponseParams) {
        var _this = this;
        var payloadType = multiResponseParams.payloadType, payload = multiResponseParams.payload, onMessage = multiResponseParams.onMessage, onError = multiResponseParams.onError;
        if (this.isConnected()) {
            var clientMsgId_1 = this.generateClientMsgId();
            var message = {
                clientMsgId: clientMsgId_1,
                payloadType: payloadType,
                payload: payload
            };
            var incomingMessagesListener_1 = {
                message: message,
                handler: function (msg) {
                    var shouldUnsubscribe = onMessage(msg);
                    if (shouldUnsubscribe) {
                        _this.removeIncomingMesssagesListener(incomingMessagesListener_1);
                    }
                },
                shouldProcess: function (msg) { return msg.clientMsgId == clientMsgId_1; },
                disconnectHandler: function (err) {
                    if (onError) {
                        _this.removeIncomingMesssagesListener(incomingMessagesListener_1);
                        onError(err);
                    }
                }
            };
            this.addIncomingMessagesListener(incomingMessagesListener_1);
            try {
                this.send({ payloadType: payloadType, payload: payload, clientMsgId: clientMsgId_1 });
            }
            catch (err) {
                var description = (typeof err === 'string') ? err : 'Message could not be sent due to a problem with the adapter';
                var error = {
                    errorCode: SendRequestError.ADAPTER_DISRUPTED,
                    description: description
                };
                onError(error);
            }
        }
        else {
            var error = {
                errorCode: SendRequestError.ADAPTER_DISCONNECTED,
                description: 'Adapter is not connected'
            };
            onError(error);
        }
    };
    Connect.prototype.generateClientMsgId = function () {
        return hat();
    };
    Connect.prototype.sendGuaranteedMultiresponseCommand = function (multiResponseParams) {
        var _this = this;
        var payloadType = multiResponseParams.payloadType, payload = multiResponseParams.payload, onMessage = multiResponseParams.onMessage, onError = multiResponseParams.onError;
        var clientMsgId = this.generateClientMsgId();
        var message = {
            clientMsgId: clientMsgId,
            payloadType: payloadType,
            payload: payload
        };
        var incomingGuaranteedMessagesListener = {
            message: message,
            handler: function (msg) {
                var shouldUnsubscribe = onMessage(msg);
                if (shouldUnsubscribe) {
                    _this.removeIncomingGuaranteedMesssagesListener(incomingGuaranteedMessagesListener);
                }
            },
            shouldProcess: function (msg) {
                return msg.clientMsgId == clientMsgId;
            },
            disconnectHandler: function (err) {
                //Nothing to do for guaranteed commands
            }
        };
        this.addGuaranteedIncomingMessagesListener(incomingGuaranteedMessagesListener);
        if (this.isConnected()) {
            try {
                this.send({ payloadType: payloadType, payload: payload, clientMsgId: clientMsgId });
            }
            catch (err) {
                var description = (typeof err === 'string') ? err : 'Message could not be sent due to a problem with the adapter';
                var error = {
                    errorCode: SendRequestError.ADAPTER_DISRUPTED,
                    description: description
                };
                onError(error);
            }
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
            this.adapter.onEnd('Adapter being destroyed. Ending connection');
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
}());
exports.Connect = Connect;
