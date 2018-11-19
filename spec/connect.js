"use strict";
exports.__esModule = true;
var connect_1 = require("../src/connect");
describe('Connect ts API test', function () {
    var adapter;
    var encodeDecode = {
        encode: function (message) { return message; },
        decode: function (message) { return message; }
    };
    var connection;
    beforeEach(function () {
        adapter = {
            onOpen: function () { },
            onData: function (data) { },
            onError: function (err) { },
            onEnd: function (err) { },
            connect: function () { },
            send: function (message) { }
        };
        var connectionParams = {
            encodeDecode: encodeDecode,
            adapter: adapter
        };
        connection = new connect_1.Connect(connectionParams);
    });
    it('Should open an adapter connection and be connected', function (done) {
        adapter.connect = function () { adapter.onOpen(); };
        connection.start().then(function () {
            expect(connection.isConnected()).toBe(true);
            done();
        });
    });
    it('Should reject promise on Error and be disconnected', function (done) {
        adapter.connect = function () { adapter.onError('Test disconnect on error'); };
        connection.start().then(function () {
            throw new Error('Expected function to be rejected!');
        }, function (err) {
            expect(connection.isDisconnected()).toBe(true);
            done();
        });
    });
    it('sendCommand should encode message and use adapters send method', function (done) {
        adapter.connect = function () { adapter.onOpen(); };
        var testPayloadType = 12;
        var testPayload = { info: 'testInfo' };
        var receivedId;
        spyOn(encodeDecode, 'encode').and.callFake(function (_a) {
            var payloadType = _a.payloadType, payload = _a.payload, clientMsgId = _a.clientMsgId;
            receivedId = clientMsgId;
            expect(payloadType).toBe(testPayloadType);
            expect(payload).toEqual(testPayload);
            return { payloadTypeEncoded: payloadType, payloadEncoded: payload, clientMsgId: clientMsgId };
        });
        spyOn(adapter, 'send');
        connection.start().then(function () {
            connection.sendCommand(testPayloadType, testPayload);
            expect(adapter.send).toHaveBeenCalledWith({ payloadTypeEncoded: testPayloadType, payloadEncoded: testPayload, clientMsgId: receivedId });
            done();
        });
    });
    it('sends guaranteedCommand once the adapter reconnects', function (done) {
        adapter.connect = function () {
            adapter.onOpen();
        };
        var testPayloadType = 12;
        var testPayload = { info: 'testInfo' };
        var receivedId;
        spyOn(encodeDecode, 'encode').and.callFake(function (_a) {
            var payloadType = _a.payloadType, payload = _a.payload, clientMsgId = _a.clientMsgId;
            receivedId = clientMsgId;
            expect(payloadType).toBe(testPayloadType);
            expect(payload).toEqual(testPayload);
            return { payloadTypeEncoded: payloadType, payloadEncoded: payload, clientMsgId: clientMsgId };
        });
        spyOn(adapter, 'send');
        var connectCounter = 0;
        connection.onConnect = function () {
            connectCounter += 1;
            if (connectCounter === 2) {
                expect(adapter.send).toHaveBeenCalledWith({
                    payloadTypeEncoded: testPayloadType,
                    payloadEncoded: testPayload,
                    clientMsgId: receivedId
                });
                done();
            }
        };
        connection.start().then(function () {
            adapter.onEnd('Test end');
            connection.sendGuaranteedCommand(testPayloadType, testPayload);
            connection.start()["catch"](); // Reconenct after end
        });
    });
    it('Resolves guaranteedCommand after disconnect events', function (done) {
        adapter.connect = function () {
            adapter.onOpen();
        };
        var testPayloadType = 12;
        var testPayload = { info: 'testInfo' };
        var mockId = '123asd';
        spyOn(connection, 'generateClientMsgId').and.callFake(function () {
            return mockId;
        });
        connection.start().then(function () {
            connection.sendGuaranteedCommand(testPayloadType, testPayload).then(function (response) {
                done();
            })["catch"](function (err) {
                done();
            });
            adapter.onData({
                payloadType: testPayloadType,
                payload: 'Response Payload 12!',
                clientMsgId: mockId
            });
        });
    });
});
