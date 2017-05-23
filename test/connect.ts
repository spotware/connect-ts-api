import test from 'ava';

import {IConnectionAdapter, AdapterConnectionStates, IMessageWithId} from "connection-adapter";

import { Connect,  IMessage, ISendCommand } from "../lib/connect";
import {BehaviorSubject, ReplaySubject} from "rxjs";
import {isNull, isUndefined} from "util";

test.beforeEach(t => {
    const adapterDataEmitter = new ReplaySubject<IMessageWithId>(1);
    const adapterState = new ReplaySubject<AdapterConnectionStates>(1);
    t.context.adapterDataEmitter = adapterDataEmitter;

    const adapter = <IConnectionAdapter> {
        send: (data: IMessageWithId) => {},
        data$: adapterDataEmitter,
        state$: adapterState,
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
    const originalGenerateMsgId = (<any> connectApi).generateClientMsgId;
    (<any> connectApi).generateClientMsgId = () => {
        const generatedMsgId = originalGenerateMsgId();
        t.context.generatedMsgId = generatedMsgId;
        return generatedMsgId
    };
    t.context.connectApi = connectApi;

    (<any> adapter).state$.next(AdapterConnectionStates.CONNECTED);
});

test('Should send and receive message in the expected format', (t) => {
    const adapter: IConnectionAdapter = t.context.mockAdapter;
    const dataEmitter = t.context.adapterDataEmitter;
    const connectApi = t.context.connectApi;

    t.plan(3);
    adapter.send = (data) => {
        t.is(t.context.mockMessage.payloadType, data.payloadType);
        t.is(t.context.mockMessage.payload, data.payload);
        dataEmitter.next({payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: t.context.generatedMsgId});
    };

    const command: ISendCommand = {
        message: t.context.mockMessage,
        onResponse : (data: IMessage) => {
            t.deepEqual(t.context.mockResponse, data)
        }
    };

    connectApi.sendCommand(command)
});

test('Should execute error handler on adapter error', (t) => {
    const adapter: IConnectionAdapter = t.context.mockAdapter;
    const connectApi = t.context.connectApi;

    t.plan(1);
    adapter.send = () => {
        throw('Could not encode message');
    };

    const command: ISendCommand = {
        message: t.context.mockMessage,
        onResponse : (data: IMessage) => {
            t.fail('Should not get response')
        },
        onError: err => {
            t.pass();
        }
    };

    connectApi.sendCommand(command)
});

test('Should execute error handler on adapter disconnected and unsubscribe functions', (t) => {
    const adapter: IConnectionAdapter = t.context.mockAdapter;
    const connectApi = t.context.connectApi;
    t.plan(1);

    const command: ISendCommand = {
        message: t.context.mockMessage,
        onResponse : (data: IMessage) => {
            t.fail('Should not get response')
        },
        onError: err => {
            t.pass();
        }
    };

    connectApi.sendCommand(command);
    (<any> adapter).state$.next(AdapterConnectionStates.DISCONNECTED);
});

test('Should execute error handler on adapter disconnected and get empty subscribable', (t) => {
    const adapter: IConnectionAdapter = t.context.mockAdapter;
    const connectApi = t.context.connectApi;
    (<any> adapter).state$.next(AdapterConnectionStates.DISCONNECTED);
    t.plan(2);

    const command: ISendCommand = {
        message: t.context.mockMessage,
        onResponse : (data: IMessage) => {
            t.fail('Should not get response')
        },
        onError: err => {
            t.pass();
        }
    };

    const subscribable = connectApi.sendCommand(command);
    t.true(isNull(subscribable.unsubscribe()));
});

test.cb('Should send multiresponse command and unsubscribe after three responses', (t) => {
    const adapter: IConnectionAdapter = t.context.mockAdapter;
    const dataEmitter = t.context.adapterDataEmitter;
    const connectApi = t.context.connectApi;

    t.plan(6);
    adapter.send = (data) => {
        t.is(t.context.mockMessage.payloadType, data.payloadType);
        t.is(t.context.mockMessage.payload, data.payload);
        setTimeout(() => {
            dataEmitter.next({payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: t.context.generatedMsgId});
            dataEmitter.next({payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: t.context.generatedMsgId});
            dataEmitter.next({payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: t.context.generatedMsgId});
            dataEmitter.next({payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: t.context.generatedMsgId});
        }, 15); //Mock a response delay from server
    };

    const responses = new BehaviorSubject(0);
    const command: ISendCommand = {
        message: t.context.mockMessage,
        onResponse : (data: IMessage) => {
            t.deepEqual(t.context.mockResponse, data);
            responses.next(1);
        },
        multiResponse: true
    };

    const sentCommand = connectApi.sendCommand(command);
    responses.scan((prev, curr) => prev + curr).subscribe(counter => {
        if (counter === 3) {
            t.true(isUndefined(sentCommand.unsubscribe()));
            t.end();
        }
    })
});

test('Should send guaranteed command', (t) => {
    const adapter: IConnectionAdapter = t.context.mockAdapter;
    const dataEmitter = t.context.adapterDataEmitter;
    const connectApi = t.context.connectApi;

    t.plan(3);
    adapter.send = (data) => {
        t.is(t.context.mockMessage.payloadType, data.payloadType);
        t.is(t.context.mockMessage.payload, data.payload);
        dataEmitter.next({payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: t.context.generatedMsgId})
    };

    const command: ISendCommand = {
        message: t.context.mockMessage,
        onResponse : (data: IMessage) => {
            t.deepEqual(t.context.mockResponse, data)
        },
        guaranteed: true
    };
    (<any> adapter).state$.next(AdapterConnectionStates.DISCONNECTED);
    connectApi.sendCommand(command);
    (<any> adapter).state$.next(AdapterConnectionStates.CONNECTED);
    connectApi.onOpen();
});

test.cb('Should add guaranteed command to waiting commands if sent when adapter disconnected', (t) => {
    const adapter: IConnectionAdapter = t.context.mockAdapter;
    const dataEmitter = t.context.adapterDataEmitter;
    const connectApi = t.context.connectApi;
    let allowSendingData = false; //First time we won't send data, mocking a delay before connection drops.

    t.plan(3);
    adapter.send = (data) => {
        if (allowSendingData === true) {
            t.is(t.context.mockMessage.payloadType, data.payloadType);
            t.is(t.context.mockMessage.payload, data.payload);
            dataEmitter.next({payloadType: t.context.mockResponse.payloadType, payload: t.context.mockResponse.payload, clientMsgId: t.context.generatedMsgId})
        }
    };

    const command: ISendCommand = {
        message: t.context.mockMessage,
        onResponse : (data: IMessage) => {
            t.deepEqual(t.context.mockResponse, data);
            t.end();
        },
        guaranteed: true
    };
    connectApi.sendCommand(command);
    (<any> adapter).state$.next(AdapterConnectionStates.DISCONNECTED);
    allowSendingData = true;// After the first disconnection we allow sending data, so the guaranteed subscriber will trigger and finish the test
    (<any> adapter).state$.next(AdapterConnectionStates.CONNECTED);
});

test('Should handle push events', (t) => {
    const dataEmitter = t.context.adapterDataEmitter;
    const connectApi = t.context.connectApi;

    t.plan(1);
    connectApi.setPushEventHandler((pushEvent) => {
        t.deepEqual(t.context.mockResponse, pushEvent);
    });

    dataEmitter.next(t.context.mockResponse);
});
