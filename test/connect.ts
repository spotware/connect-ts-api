import {AdapterConnectionStates, IConnectionAdapter, IMessageWithId} from "connection-adapter";

import {Connect, IMessage, ISendCommand} from "../lib/connect";
import {BehaviorSubject, ReplaySubject} from "rxjs";
import {isNull, isUndefined} from "util";

let context;
beforeEach(() => {
    context = {};
    const adapterDataEmitter = new ReplaySubject<IMessageWithId>(1);
    const adapterState = new ReplaySubject<AdapterConnectionStates>(1);
    context.adapterDataEmitter = adapterDataEmitter;

    const adapter = <IConnectionAdapter> {
        send: (data: IMessageWithId) => {
        },
        data$: adapterDataEmitter,
        state$: adapterState,
        connect: (url: string) => {
        }
    };

    context.mockAdapter = adapter;

    context.mockMessage = {
        payloadType: 1,
        payload: 'Hello message'
    };

    context.mockResponse = {
        payloadType: 2,
        payload: 'Hello response'
    };

    const connectParams = {
        adapter,
        instanceId: 'testConnection'
    };

    const connectApi: any = new Connect(connectParams);
    const originalGenerateMsgId = connectApi.generateClientMsgId;
    connectApi.generateClientMsgId = () => {
        const generatedMsgId = originalGenerateMsgId();
        context.generatedMsgId = generatedMsgId;
        return generatedMsgId
    };
    context.connectApi = connectApi;

    (<any> adapter).state$.next(AdapterConnectionStates.CONNECTED);
});

test('Should send and receive message in the expected format', () => {
    const adapter: IConnectionAdapter = context.mockAdapter;
    const dataEmitter = context.adapterDataEmitter;
    const connectApi = context.connectApi;

    expect.assertions(3);
    adapter.send = (data) => {
        expect(context.mockMessage.payloadType).toBe(data.payloadType);
        expect(context.mockMessage.payload).toBe(data.payload);
        dataEmitter.next({
            payloadType: context.mockResponse.payloadType,
            payload: context.mockResponse.payload,
            clientMsgId: context.generatedMsgId
        });
    };

    const command: ISendCommand = {
        message: context.mockMessage,
        onResponse: (data: IMessage) => {
            expect(context.mockResponse).toEqual(data)
        }
    };

    connectApi.sendCommand(command)
});

test('Should execute error handler on adapter error', done => {
    const adapter: IConnectionAdapter = context.mockAdapter;
    const connectApi = context.connectApi;

    expect.assertions(0);
    adapter.send = () => {
        throw('Could not encode message');
    };

    const command: ISendCommand = {
        message: context.mockMessage,
        onResponse: (data: IMessage) => {
            done.fail('Should not get response')
        },
        onError: err => {
            done();
        }
    };

    connectApi.sendCommand(command)
});

test('Should execute error handler on adapter disconnected and unsubscribe functions', done => {
    const adapter: IConnectionAdapter = context.mockAdapter;
    const connectApi = context.connectApi;

    const command: ISendCommand = {
        message: context.mockMessage,
        onResponse: (data: IMessage) => {
            done.fail('Should not get response')
        },
        onError: err => {
            done();
        }
    };

    connectApi.sendCommand(command);
    (<any> adapter).state$.next(AdapterConnectionStates.DISCONNECTED);
});

test('Should execute error handler on adapter disconnected and get empty subscribable', () => {
    const adapter: IConnectionAdapter = context.mockAdapter;
    const connectApi = context.connectApi;
    (<any> adapter).state$.next(AdapterConnectionStates.DISCONNECTED);
    expect.assertions(2);

    const command: ISendCommand = {
        message: context.mockMessage,
        onResponse: (data: IMessage) => {
            fail('Should not get response')
        },
        onError: err => {
        }
    };

    const spy = jest.spyOn(command, 'onError');

    const subscribable = connectApi.sendCommand(command);
    expect(isNull(subscribable.unsubscribe())).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
});

test('Should send multiresponse command and unsubscribe after three responses',
    done => {
        const adapter: IConnectionAdapter = context.mockAdapter;
        const dataEmitter = context.adapterDataEmitter;
        const connectApi = context.connectApi;

        expect.assertions(6);
        adapter.send = (data) => {
            expect(context.mockMessage.payloadType).toBe(data.payloadType);
            expect(context.mockMessage.payload).toBe(data.payload);
            setTimeout(() => {
                dataEmitter.next({
                    payloadType: context.mockResponse.payloadType,
                    payload: context.mockResponse.payload,
                    clientMsgId: context.generatedMsgId
                });
                dataEmitter.next({
                    payloadType: context.mockResponse.payloadType,
                    payload: context.mockResponse.payload,
                    clientMsgId: context.generatedMsgId
                });
                dataEmitter.next({
                    payloadType: context.mockResponse.payloadType,
                    payload: context.mockResponse.payload,
                    clientMsgId: context.generatedMsgId
                });
                dataEmitter.next({
                    payloadType: context.mockResponse.payloadType,
                    payload: context.mockResponse.payload,
                    clientMsgId: context.generatedMsgId
                });
            }, 15); //Mock a response delay from server
        };

        const responses = new BehaviorSubject(0);
        const command: ISendCommand = {
            message: context.mockMessage,
            onResponse: (data: IMessage) => {
                expect(context.mockResponse).toEqual(data);
                responses.next(1);
            },
            multiResponse: true
        };

        const sentCommand = connectApi.sendCommand(command);
        responses.scan((prev, curr) => prev + curr).subscribe(counter => {
            if (counter === 3) {
                expect(isUndefined(sentCommand.unsubscribe())).toBe(true);
                done();
            }
        })
    }
);

test('Should send guaranteed command', () => {
    const adapter: IConnectionAdapter = context.mockAdapter;
    const dataEmitter = context.adapterDataEmitter;
    const connectApi = context.connectApi;

    expect.assertions(3);
    adapter.send = (data) => {
        expect(context.mockMessage.payloadType).toBe(data.payloadType);
        expect(context.mockMessage.payload).toBe(data.payload);
        dataEmitter.next({
            payloadType: context.mockResponse.payloadType,
            payload: context.mockResponse.payload,
            clientMsgId: context.generatedMsgId
        })
    };

    const command: ISendCommand = {
        message: context.mockMessage,
        onResponse: (data: IMessage) => {
            expect(context.mockResponse).toEqual(data)
        },
        guaranteed: true
    };
    (<any> adapter).state$.next(AdapterConnectionStates.DISCONNECTED);
    connectApi.sendCommand(command);
    (<any> adapter).state$.next(AdapterConnectionStates.CONNECTED);
    connectApi.onOpen();
});

test(
    'Should add guaranteed command to waiting commands if sent when adapter disconnected',
    done => {
        const adapter: IConnectionAdapter = context.mockAdapter;
        const dataEmitter = context.adapterDataEmitter;
        const connectApi = context.connectApi;
        let allowSendingData = false; //First time we won't send data, mocking a delay before connection drops.

        expect.assertions(3);
        adapter.send = (data) => {
            if (allowSendingData === true) {
                expect(context.mockMessage.payloadType).toBe(data.payloadType);
                expect(context.mockMessage.payload).toBe(data.payload);
                dataEmitter.next({
                    payloadType: context.mockResponse.payloadType,
                    payload: context.mockResponse.payload,
                    clientMsgId: context.generatedMsgId
                })
            }
        };

        const command: ISendCommand = {
            message: context.mockMessage,
            onResponse: (data: IMessage) => {
                expect(context.mockResponse).toEqual(data);
                done();
            },
            guaranteed: true
        };
        connectApi.sendCommand(command);
        (<any> adapter).state$.next(AdapterConnectionStates.DISCONNECTED);
        allowSendingData = true;// After the first disconnection we allow sending data, so the guaranteed subscriber will trigger and finish the test
        (<any> adapter).state$.next(AdapterConnectionStates.CONNECTED);
    }
);

test('Should handle push events', () => {
    const dataEmitter = context.adapterDataEmitter;
    const connectApi = context.connectApi;

    expect.assertions(1);
    connectApi.setPushEventHandler((pushEvent) => {
        expect(context.mockResponse).toEqual(pushEvent);
    });

    dataEmitter.next(context.mockResponse);
});
