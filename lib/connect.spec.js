"use strict";
var connect_1 = require("./connect");
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
});
