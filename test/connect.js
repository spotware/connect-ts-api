"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var ava_1 = require("ava");
var connection_adapter_1 = require("connection-adapter");
var connect_1 = require("../lib/connect");
var rxjs_1 = require("rxjs");
var MOCK_CLIENT_MSG_ID = '123asd';
ava_1.default.beforeEach(function (t) {
    var adapterDataEmitter = new rxjs_1.ReplaySubject(1);
    var adapterState = new rxjs_1.ReplaySubject(1);
    t.context.adapterDataEmitter = adapterDataEmitter;
    var adapter = {
        send: function (data) { },
        data: adapterDataEmitter,
        state: adapterState,
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
    connectApi.generateClientMsgId = function () {
        return MOCK_CLIENT_MSG_ID;
    };
    t.context.connectApi = connectApi;
    adapter.state.next(connection_adapter_1.AdapterConnectionStates.CONNECTED);
});
ava_1.default('Should send and receive message in the expected format', function (t) {
    var adapter = t.context.mockAdapter;
    var dataEmitter = t.context.adapterDataEmitter;
    var connectApi = t.context.connectApi;
    t.plan(3);
    adapter.send = function (data) {
        t.is(t.context.mockMessage.payloadType, data.payloadType);
        t.is(t.context.mockMessage.payload, data.payload);
        dataEmitter.next({ payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: MOCK_CLIENT_MSG_ID });
    };
    var command = {
        message: t.context.mockMessage,
        onResponse: function (data) {
            t.deepEqual(t.context.mockResponse, data);
        }
    };
    connectApi.sendCommand(command);
});
ava_1.default.cb('Should send multiresponse command and unsubscribe after three responses', function (t) {
    var adapter = t.context.mockAdapter;
    var dataEmitter = t.context.adapterDataEmitter;
    var connectApi = t.context.connectApi;
    t.plan(5);
    adapter.send = function (data) {
        t.is(t.context.mockMessage.payloadType, data.payloadType);
        t.is(t.context.mockMessage.payload, data.payload);
        setTimeout(function () {
            dataEmitter.next({ payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: MOCK_CLIENT_MSG_ID });
            dataEmitter.next({ payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: MOCK_CLIENT_MSG_ID });
            dataEmitter.next({ payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: MOCK_CLIENT_MSG_ID });
            dataEmitter.next({ payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: MOCK_CLIENT_MSG_ID });
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
            sentCommand.unsubscribe();
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
        dataEmitter.next({ payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: MOCK_CLIENT_MSG_ID });
    };
    var command = {
        message: t.context.mockMessage,
        onResponse: function (data) {
            t.deepEqual(t.context.mockResponse, data);
        },
        guaranteed: true
    };
    adapter.state.next(connection_adapter_1.AdapterConnectionStates.DISCONNECTED);
    connectApi.sendCommand(command);
    adapter.state.next(connection_adapter_1.AdapterConnectionStates.CONNECTED);
    connectApi.onOpen();
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
