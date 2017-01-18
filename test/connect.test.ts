import {IAdapter} from "../lib/connect";
import {Connect} from "../lib/connect";
import {IEncoderDecoder} from "../lib/connect";
import {IProtocol} from "../lib/connect";

describe('Connect ts API test', function () {
    let adapter: IAdapter;

    const encodeDecode: IEncoderDecoder = {
        encode: (message) => {return message},
        decode: (message) => {return message},
        registerDecodeHandler: (message) => {return message}
    };

    const protocol: IProtocol = {
        encode: (payloadType: number, payload: any, hatRes: any) => {
            console.log('protocol spy called.', payloadType);
            return {payloadType, payload, hatRes}
        },
        decode: (params?: any) => {
            return params
        }
    };

    let connection: Connect;
    beforeEach(function () {
        adapter ={
            onOpen: () => {},
            onData: (data?: any): any => {},
            onError: (err?: any): any => {},
            onEnd: (err?: any): any => {},
            connect: () => {},
            send: (message: any): any => {}
        };
        let connectionParams = {
            encodeDecode,
            protocol,
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
        adapter.connect = () => {adapter.onError()};
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
        const testPayload = {info:'testInfo'};
        let testSalt;
        spyOn(protocol, 'encode').and.callFake((payloadType: number, payload: Object, salt: string) => {
            testSalt = salt;
            expect(payloadType).toBe(testPayloadType);
            expect(payload).toEqual(testPayload);
            return {payloadType, payload, salt}
        });

        spyOn(adapter, 'send');
        connection.start().then(() => {
            connection.sendCommand(testPayloadType, testPayload);
            expect(adapter.send).toHaveBeenCalledWith({payloadType: testPayloadType, payload: testPayload, salt: testSalt});
            done();
        });
    });
});
