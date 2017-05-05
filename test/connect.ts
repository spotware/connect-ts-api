import test from 'ava';

import {IConnectionAdapter, AdapterConnectionStates, IMessageWithId} from "connection-adapter";

import {
    Connect,  IMessage,
    ISendCommand
} from "../lib/connect";
import {ReplaySubject} from "rxjs";
const MOCK_CLIENT_MSG_ID = '123asd';

test.beforeEach(t => {
    const adapterDataEmitter = new ReplaySubject<IMessageWithId>(1);
    const adapterState = new ReplaySubject<AdapterConnectionStates>(1);
    t.context.adapterDataEmitter = adapterDataEmitter;

    const adapter = <IConnectionAdapter> {
        send: (data: IMessageWithId) => {},
        data: adapterDataEmitter,
        state: adapterState,
        connect: (url: string) => {}
    };

    t.context.mockAdapter = adapter;

    t.context.mockMessage = <IMessage> {
        payloadType: 1,
        payload: 'Hello message'
    };

    t.context.mockResponse = <IMessage> {
        payloadType: 2,
        payload: 'Hello response'
    };

    const connectParams = {
        adapter,
        instanceId: 'testConnection'
    };

    const connectApi = new Connect(connectParams);
    (<any> connectApi).generateClientMsgId = () => {
        return MOCK_CLIENT_MSG_ID
    };
    t.context.connectApi = connectApi;

    (<any> adapter).state.next(AdapterConnectionStates.CONNECTED);
});

test('Should send and receive message in the expected format', (t) => {
    const adapter: IConnectionAdapter = t.context.mockAdapter;
    const dataEmitter = t.context.adapterDataEmitter;
    const connectApi = t.context.connectApi;

    t.plan(3);
    adapter.send = (data) => {
        t.is(t.context.mockMessage.payloadType, data.payloadType);
        t.is(t.context.mockMessage.payload, data.payload);
        dataEmitter.next({payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: MOCK_CLIENT_MSG_ID});
    };

    const command: ISendCommand = {
        message: t.context.mockMessage,
        onResponse : (data: IMessage) => {
            t.deepEqual(t.context.mockResponse, data)
        }
    };

    connectApi.sendCommand(command)
});

test('Should send multiresponse command', (t) => {
    const adapter: IConnectionAdapter = t.context.mockAdapter;
    const dataEmitter = t.context.adapterDataEmitter;
    const connectApi = t.context.connectApi;

    t.plan(5);
    adapter.send = (data) => {
        t.is(t.context.mockMessage.payloadType, data.payloadType);
        t.is(t.context.mockMessage.payload, data.payload);
        dataEmitter.next({payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: MOCK_CLIENT_MSG_ID});
        dataEmitter.next({payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: MOCK_CLIENT_MSG_ID});
        dataEmitter.next({payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: MOCK_CLIENT_MSG_ID});
    };

    const command: ISendCommand = {
        message: t.context.mockMessage,
        onResponse : (data: IMessage) => {
            t.deepEqual(t.context.mockResponse, data)
        },
        multiResponse: true
    };

    connectApi.sendCommand(command)
});

test('Should send guaranteed command', (t) => {
    const adapter: IConnectionAdapter = t.context.mockAdapter;
    const dataEmitter = t.context.adapterDataEmitter;
    const connectApi = t.context.connectApi;

    t.plan(3);
    adapter.send = (data) => {
        t.is(t.context.mockMessage.payloadType, data.payloadType);
        t.is(t.context.mockMessage.payload, data.payload);
        dataEmitter.next({payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: MOCK_CLIENT_MSG_ID})
    };

    const command: ISendCommand = {
        message: t.context.mockMessage,
        onResponse : (data: IMessage) => {
            t.deepEqual(t.context.mockResponse, data)
        },
        guaranteed: true
    };
    (<any> adapter).state.next(AdapterConnectionStates.DISCONNECTED);
    connectApi.sendCommand(command);
    (<any> adapter).state.next(AdapterConnectionStates.CONNECTED);
    connectApi.onOpen();
});
