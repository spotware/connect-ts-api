"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ava_1 = require("ava");
var connection_adapter_1 = require("connection-adapter");
var connect_1 = require("../lib/connect");
var rxjs_1 = require("rxjs");
var util_1 = require("util");
ava_1.default.beforeEach(function (t) {
    var adapterDataEmitter = new rxjs_1.ReplaySubject(1);
    var adapterState = new rxjs_1.ReplaySubject(1);
    t.context.adapterDataEmitter = adapterDataEmitter;
    var adapter = {
        send: function (data) { },
        data$: adapterDataEmitter,
        state$: adapterState,
        connect: function (url) { }
    };
    t.context.mockAdapter = adapter;
    t.context.mockMessage = {
        payloadType: 1,
        payload: 'Hello message'
    };
    t.context.mockResponse = {
        payloadType: 2,
        payload: 'Hello response'
    };
    var connectParams = {
        adapter: adapter,
        instanceId: 'testConnection'
    };
    var connectApi = new connect_1.Connect(connectParams);
    var originalGenerateMsgId = connectApi.generateClientMsgId;
    connectApi.generateClientMsgId = function () {
        var generatedMsgId = originalGenerateMsgId();
        t.context.generatedMsgId = generatedMsgId;
        return generatedMsgId;
    };
    t.context.connectApi = connectApi;
    adapter.state$.next(connection_adapter_1.AdapterConnectionStates.CONNECTED);
});
ava_1.default('Should send and receive message in the expected format', function (t) {
    var adapter = t.context.mockAdapter;
    var dataEmitter = t.context.adapterDataEmitter;
    var connectApi = t.context.connectApi;
    t.plan(3);
    adapter.send = function (data) {
        t.is(t.context.mockMessage.payloadType, data.payloadType);
        t.is(t.context.mockMessage.payload, data.payload);
        dataEmitter.next({ payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: t.context.generatedMsgId });
    };
    var command = {
        message: t.context.mockMessage,
        onResponse: function (data) {
            t.deepEqual(t.context.mockResponse, data);
        }
    };
    connectApi.sendCommand(command);
});
ava_1.default('Should execute error handler on adapter error', function (t) {
    var adapter = t.context.mockAdapter;
    var connectApi = t.context.connectApi;
    t.plan(1);
    adapter.send = function () {
        throw ('Could not encode message');
    };
    var command = {
        message: t.context.mockMessage,
        onResponse: function (data) {
            t.fail('Should not get response');
        },
        onError: function (err) {
            t.pass();
        }
    };
    connectApi.sendCommand(command);
});
ava_1.default('Should execute error handler on adapter disconnected and unsubscribe functions', function (t) {
    var adapter = t.context.mockAdapter;
    var connectApi = t.context.connectApi;
    t.plan(1);
    var command = {
        message: t.context.mockMessage,
        onResponse: function (data) {
            t.fail('Should not get response');
        },
        onError: function (err) {
            t.pass();
        }
    };
    connectApi.sendCommand(command);
    adapter.state$.next(connection_adapter_1.AdapterConnectionStates.DISCONNECTED);
});
ava_1.default('Should execute error handler on adapter disconnected and get empty subscribable', function (t) {
    var adapter = t.context.mockAdapter;
    var connectApi = t.context.connectApi;
    adapter.state$.next(connection_adapter_1.AdapterConnectionStates.DISCONNECTED);
    t.plan(2);
    var command = {
        message: t.context.mockMessage,
        onResponse: function (data) {
            t.fail('Should not get response');
        },
        onError: function (err) {
            t.pass();
        }
    };
    var subscribable = connectApi.sendCommand(command);
    t.true(util_1.isNull(subscribable.unsubscribe()));
});
ava_1.default.cb('Should send multiresponse command and unsubscribe after three responses', function (t) {
    var adapter = t.context.mockAdapter;
    var dataEmitter = t.context.adapterDataEmitter;
    var connectApi = t.context.connectApi;
    t.plan(6);
    adapter.send = function (data) {
        t.is(t.context.mockMessage.payloadType, data.payloadType);
        t.is(t.context.mockMessage.payload, data.payload);
        setTimeout(function () {
            dataEmitter.next({ payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: t.context.generatedMsgId });
            dataEmitter.next({ payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: t.context.generatedMsgId });
            dataEmitter.next({ payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: t.context.generatedMsgId });
            dataEmitter.next({ payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: t.context.generatedMsgId });
        }, 15);
    };
    var responses = new rxjs_1.BehaviorSubject(0);
    var command = {
        message: t.context.mockMessage,
        onResponse: function (data) {
            t.deepEqual(t.context.mockResponse, data);
            responses.next(1);
        },
        multiResponse: true
    };
    var sentCommand = connectApi.sendCommand(command);
    responses.scan(function (prev, curr) { return prev + curr; }).subscribe(function (counter) {
        if (counter === 3) {
            t.true(util_1.isUndefined(sentCommand.unsubscribe()));
            t.end();
        }
    });
});
ava_1.default('Should send guaranteed command', function (t) {
    var adapter = t.context.mockAdapter;
    var dataEmitter = t.context.adapterDataEmitter;
    var connectApi = t.context.connectApi;
    t.plan(3);
    adapter.send = function (data) {
        t.is(t.context.mockMessage.payloadType, data.payloadType);
        t.is(t.context.mockMessage.payload, data.payload);
        dataEmitter.next({ payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: t.context.generatedMsgId });
    };
    var command = {
        message: t.context.mockMessage,
        onResponse: function (data) {
            t.deepEqual(t.context.mockResponse, data);
        },
        guaranteed: true
    };
    adapter.state$.next(connection_adapter_1.AdapterConnectionStates.DISCONNECTED);
    connectApi.sendCommand(command);
    adapter.state$.next(connection_adapter_1.AdapterConnectionStates.CONNECTED);
    connectApi.onOpen();
});
ava_1.default.cb('Should add guaranteed command to waiting commands if sent when adapter disconnected', function (t) {
    var adapter = t.context.mockAdapter;
    var dataEmitter = t.context.adapterDataEmitter;
    var connectApi = t.context.connectApi;
    var allowSendingData = false;
    t.plan(3);
    adapter.send = function (data) {
        if (allowSendingData === true) {
            t.is(t.context.mockMessage.payloadType, data.payloadType);
            t.is(t.context.mockMessage.payload, data.payload);
            dataEmitter.next({ payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: t.context.generatedMsgId });
        }
    };
    var command = {
        message: t.context.mockMessage,
        onResponse: function (data) {
            t.deepEqual(t.context.mockResponse, data);
            t.end();
        },
        guaranteed: true
    };
    connectApi.sendCommand(command);
    adapter.state$.next(connection_adapter_1.AdapterConnectionStates.DISCONNECTED);
    allowSendingData = true;
    adapter.state$.next(connection_adapter_1.AdapterConnectionStates.CONNECTED);
});
ava_1.default('Should handle push events', function (t) {
    var dataEmitter = t.context.adapterDataEmitter;
    var connectApi = t.context.connectApi;
    t.plan(1);
    connectApi.setPushEventHandler(function (pushEvent) {
        t.deepEqual(t.context.mockResponse, pushEvent);
    });
    dataEmitter.next(t.context.mockResponse);
});
