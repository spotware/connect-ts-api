import {IAdapter} from "./connect";
import {Connect} from "./connect";
import {IEncoderDecoder} from "./connect";

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
            instanceId: 'test'
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
});
