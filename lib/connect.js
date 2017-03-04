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
        this.callbacksOnConnect = [];
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
    /**
     * @deprecated Too consumer-specific. can be confusing. Just use sendGuaranteedCommandWithPayloadtype and handle the
     * response on consumer.
     */
    Connect.prototype.sendGuaranteedCommand = function (payloadType, params) {
        return this.sendGuaranteedCommandWithPayloadtype(payloadType, params).then(function (msg) { return msg.payload; });
    };
    /**
     * @deprecated Too consumer-specific. can be confusing. Just use sendCommandWithPayloadtype and handle the
     * response on consumer.
     */
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
        this.guaranteedIncomingMessagesListeners.forEach(function (guaranteedListener) {
            if (guaranteedListener.shouldProcess(message)) {
                isProcessed = true;
                guaranteedListener.handler(message);
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
                onError(err);
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
                    _this.removeIncomingMesssagesListener(incomingGuaranteedMessagesListener);
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
                onError(err);
            }
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
        return new Promise(function (resolve, reject) {
            _this.sendGuaranteedMultiresponseCommand({
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
