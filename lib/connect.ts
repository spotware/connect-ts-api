const hat = require('hat');
import {EventEmitter} from 'events';

interface IIncommingMessagesListener {
    handler: (payload: IMessage) => void;
    shouldProcess: (payload: IMessage) => boolean;
    disconnectHandler: () => void;
}

export interface IMessage {
    clientMsgId: string;
    payloadType: number;
    payload?: any;
}

export interface IMessageWOMsgId {
    payloadType: number;
    payload?: any;
}

export interface IAdapter {
    onOpen: (result?: any) => any;
    onData: (data?: any) => any;
    onError: (err?: any) => any;
    onEnd: (err?: any) => any;
    destroy?: () => void;
    connect: () => any;
    send: (message: any) => any;
}

export interface IConnectionParams {
    encodeDecode: IEncoderDecoder
    adapter: IAdapter;
}

export interface IMultiResponseParams {
    payloadType: number,
    payload: Object,
    onMessage: (data) => boolean,
    onError?: (err?: any) => void
}

export interface IEncoderDecoder {
    encode: (data: IDataToSend) => any;
    decode: (params?: any) => any;
}

export interface IDataToSend {
    payloadType: number,
    payload: any,
    msgId: number
}

export class Connect extends EventEmitter {

    private adapter: IAdapter;
    private encodeDecode: IEncoderDecoder;
    private connected = false;
    private incomingMessagesListeners: IIncommingMessagesListener[] = [];
    private callbacksOnConnect: (() => void)[] = [];

    constructor(params: IConnectionParams) {
        super();
        this.encodeDecode = params.encodeDecode;
        this.adapter = params.adapter;
    }

    public updateAdapter(adapter: any) {
        if (this.adapter) {
            this.destroyAdapter();
        }
        this.adapter = adapter;
    }

    public start(): PromiseLike<void> {
        return new Promise<void>((resolve, reject) => {
            const adapter = this.adapter;
            adapter.onOpen = () => {
                this.onOpen();
                resolve();
            };
            adapter.onData = this.onData.bind(this);
            adapter.onError = adapter.onEnd = (e) => {
                reject();
                this._onEnd(e);
            };

            adapter.connect();
        });
    }

    private onOpen() {
        this.connected = true;

        this.onConnect();

        this.callbacksOnConnect.forEach(fn => fn());

        this.callbacksOnConnect = [];
    }

    public sendGuaranteedCommand(payloadType: number, params) {
        return this.sendGuaranteedCommandWithPayloadtype(payloadType, params).then(msg => msg.payload);
    }

    public sendCommand(payloadType: number, params) {
        return this.sendCommandWithPayloadtype(payloadType, params).then(msg => msg.payload);
    }

    private send(data: IDataToSend) {
        console.assert(this.adapter, 'Fatal: Adapter must be defined, use updateAdapter');
        const encodedData = this.encodeDecode.encode(data);
        this.adapter.send(encodedData);
    }

    private onData(data) {
        data = this.encodeDecode.decode(data);
        const msg = data.msg;
        const payloadType = data.payloadType;
        const clientMsgId = data.clientMsgId;

        if (clientMsgId) {
            this.processData(clientMsgId, payloadType, msg);
        } else {
            this.processPushEvent(msg, payloadType);
        }
    }

    private processData(clientMsgId, payloadType, msg) {
        let isProcessed = false;

        const message = {
            clientMsgId: clientMsgId,
            payloadType: payloadType,
            payload: msg
        };

        this.incomingMessagesListeners.forEach(listener => {
            if (listener.shouldProcess(message)) {
                isProcessed = true;
                listener.handler(message);
            }
        });

        if (!isProcessed) {
            this.processPushEvent(msg, payloadType);
        }
    }

    public isError(payloadType): boolean {
        //Overwrite this method by your buisness logic
        return false;
    }

    public processPushEvent(msg, payloadType) {
        //Overwrite this method by your business logic
        return false;
    }

    private _onEnd(e) {
        this.connected = false;
        this.incomingMessagesListeners.forEach(listener => {
            listener.disconnectHandler();
        });
        this.incomingMessagesListeners = [];
        this.onEnd(e);
    }

    public isDisconnected() {
        return !this.connected;
    }

    public isConnected() {
        return this.connected;
    }

    private addIncomingMessagesListener (fnToAdd: IIncommingMessagesListener) {
        this.incomingMessagesListeners.push(fnToAdd);
    }

    private removeIncomingMesssagesListener(fnToRemove: IIncommingMessagesListener) {
        this.incomingMessagesListeners = this.incomingMessagesListeners.filter(fn => fn != fnToRemove);
    }

    public sendCommandWithoutResponse(payloadType: number, payload: Object) {
        this.send({payloadType, payload, msgId: hat()});
    }

    public sendMultiresponseCommand(multiResponseParams: IMultiResponseParams) {
        let {payloadType, payload, onMessage, onError} = multiResponseParams;
        const msgId = hat();

        const incomingMessagesListener = {
            handler: (msg) => {
                const shouldUnsubscribe = onMessage(msg);

                if (shouldUnsubscribe) {
                    this.removeIncomingMesssagesListener(incomingMessagesListener);
                }
            },
            shouldProcess: msg => msg.clientMsgId == msgId,
            disconnectHandler: () => {
                if (onError) {
                    this.removeIncomingMesssagesListener(incomingMessagesListener);
                    onError();
                }
            }
        }

        this.addIncomingMessagesListener(incomingMessagesListener);

        if (this.isConnected()) {
            try {
                this.send({payloadType, payload, msgId});
            } catch (err) {
                onError(err);
            }
        } else {
            onError('Adapter not connected');
        }
    }

    public sendCommandWithPayloadtype(payloadType: number, payload: Object): PromiseLike<IMessageWOMsgId> {
        return new Promise((resolve, reject) => {
            this.sendMultiresponseCommand({
                payloadType,
                payload,
                onMessage: result => {
                    if (this.isError(result.payloadType)) {
                        reject(result);
                    } else {
                        resolve(result);
                    }
                    return true;
                },
                onError: (err) => {
                    reject(err);
                }
            });
        });
    }

    public sendGuaranteedCommandWithPayloadtype(payloadType: number, payload: Object): PromiseLike<IMessageWOMsgId> {
        if (this.isConnected()) {
            return this.sendCommandWithPayloadtype(payloadType, payload);
        } else {
            return new Promise((resolve, reject) => {
                this.callbacksOnConnect.push(() => {
                    this.sendCommandWithPayloadtype(payloadType, payload)
                        .then(resolve, reject);
                });
            });
        }
    }

    public onConnect() {
        //Overwrite this method by your business logic
        return false
    }

    public onEnd(e: any) {
        //Overwrite this method by your business logic
        return false
    }

    public destroyAdapter(): void {
        if (!this.adapter) {
            return
        }
        this.adapter.onOpen = null;
        this.adapter.onData = null;
        this.adapter.onError = function () {};
        if (this.adapter.onEnd) {
            this.adapter.onEnd();
        }
        this.adapter.onEnd = function () {};
        if (this.adapter.destroy) {
            this.adapter.destroy()
        }
        this.adapter.destroy = function () {};
        this.adapter = null;
    }
}
