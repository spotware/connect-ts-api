import {IAdapter} from "../lib/connect";
import {Connect} from "../lib/connect";
import {IEncoderDecoder} from "../lib/connect";
import {IDataToSend} from "../lib/connect";

describe('Connect ts API test', function () {
    let adapter: IAdapter;

    const encodeDecode: IEncoderDecoder = {
        encode: (message) => {return message},
        decode: (message) => {return message}
    };

    let connection: Connect;
    beforeEach(function () {
        adapter = {
            onOpen: () => {},
            onData: (data?: any): any => {},
            onError: (err?: any): any => {},
            onEnd: (err?: any): any => {},
            connect: () => {},
            send: (message: any): any => {}
        };
        let connectionParams = {
            encodeDecode,
            adapter,
        };
        connection = new Connect(connectionParams);
    });

    it('Should open an adapter connection and be connected', function (done) {
        adapter.connect = () => {adapter.onOpen()};
        connection.start().then(() => {
            expect(connection.isConnected()).toBe(true);
            done();
        });
    });

    it('Should reject promise on Error and be disconnected', function (done) {
        adapter.connect = () => {adapter.onError('Test disconnect on error')};
        connection.start().then(() => {
            throw new Error('Expected function to be rejected!');
        }, err => {
            expect(connection.isDisconnected()).toBe(true);
            done();
        });
    });

    it('sendCommand should encode message and use adapters send method', function(done) {
        adapter.connect = () => {adapter.onOpen()};
        const testPayloadType = 12;
        const testPayload = {info: 'testInfo'};
        let receivedId;
        spyOn(encodeDecode, 'encode').and.callFake(({payloadType, payload, clientMsgId}: IDataToSend) => {
            receivedId = clientMsgId;
            expect(payloadType).toBe(testPayloadType);
            expect(payload).toEqual(testPayload);
            return {payloadTypeEncoded: payloadType, payloadEncoded: payload, clientMsgId}
        });

        spyOn(adapter, 'send');
        connection.start().then(() => {
            connection.sendCommand(testPayloadType, testPayload);
            expect(adapter.send).toHaveBeenCalledWith({payloadTypeEncoded: testPayloadType, payloadEncoded: testPayload, clientMsgId: receivedId});
            done();
        });
    });

    it('sends guaranteedCommand once the adapter reconnects', function(done) {
        adapter.connect = () => {
            adapter.onOpen()
        };
        const testPayloadType = 12;
        const testPayload = {info: 'testInfo'};
        let receivedId;
        spyOn(encodeDecode, 'encode').and.callFake(({payloadType, payload, clientMsgId}: IDataToSend) => {
            receivedId = clientMsgId;
            expect(payloadType).toBe(testPayloadType);
            expect(payload).toEqual(testPayload);
            return {payloadTypeEncoded: payloadType, payloadEncoded: payload, clientMsgId}
        });

        spyOn(adapter, 'send');
        let connectCounter: number = 0;
        connection.onConnect = () => {
            connectCounter += 1;
            if (connectCounter === 2) { //Call after first reconnection
                expect(adapter.send).toHaveBeenCalledWith({
                    payloadTypeEncoded: testPayloadType,
                    payloadEncoded: testPayload,
                    clientMsgId: receivedId
                });
                done();
            }
        };
        connection.start().then(() => {
            adapter.onEnd('Test end');
            connection.sendGuaranteedCommand(testPayloadType, testPayload);
            connection.start().catch() // Reconenct after end
        });
    });

    it('Resolves guaranteedCommand after disconnect events', function(done) {
        adapter.connect = () => {
            adapter.onOpen()
        };
        const testPayloadType = 12;
        const testPayload = {info: 'testInfo'};
        const mockId = '123asd';

        spyOn((<any> connection), 'generateClientMsgId').and.callFake(() => {
             return mockId
        });

        connection.start().then(() => {
            connection.sendGuaranteedCommand(testPayloadType, testPayload).then(response => {
                done();
            }).catch(err => {
                done()
            });

            adapter.onData({
                payloadType: testPayloadType,
                payload: 'Response Payload 12!',
                clientMsgId: mockId
            });
        });
    });
});
