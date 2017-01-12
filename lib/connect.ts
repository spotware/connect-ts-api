var hat = require('hat');
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
    connect: () => any;
    send: (message: any) => any;
}

export interface IConnectionParams {
    encodeDecode: any
    protocol: any;
    adapter: IAdapter;
    onPushEvent?: (message: IMessageWOMsgId) => void;
}

export interface IMultiResponseParams {
    payloadType: number,
    payload: Object,
    onMessage: (data) => boolean,
    onError?: () => void
}

export class Connect extends EventEmitter {

    private adapter: IAdapter;
    private encodeDecode: any;
    private protocol: any;
    private _isConnected = false;
    private incomingMessagesListeners: IIncommingMessagesListener[] = [];
    private handlePushEvent: (message: IMessageWOMsgId) => void;
    private callbacksOnConnect: (() => void)[] = [];

    constructor(params: IConnectionParams) {
        super();

        this.encodeDecode = params.encodeDecode;
        this.protocol = params.protocol;

        this.handlePushEvent = params.onPushEvent;
        this.adapter = params.adapter;

        this.initialization();
    }

    public getAdapter() {
        return this.adapter;
    }

    public updateAdapter(adapter: any) {
        this.adapter = adapter;
    }

    private initialization() {
        this.encodeDecode.registerDecodeHandler(
            this.onMessage.bind(this)
        );
    }

    public start(): JQueryPromise<void> {
        const def = $.Deferred<void>();

        const adapter = this.adapter;
        adapter.onOpen = () => {
            this.onOpen();
            def.resolve();
        };
        adapter.onData = this.onData.bind(this);
        adapter.onError = adapter.onEnd = (e) => {
            def.reject();
            this._onEnd(e);
        };

        adapter.connect();

        return def.promise();
    }

    private onData(data) {
        this.encodeDecode.decode(data);
    }

    private onOpen() {
        this._isConnected = true;

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

    private send(data) {
        this.adapter.send(
            this.encodeDecode.encode(data)
        );
    }

    private onMessage(data) {
        data = this.protocol.decode(data);
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

    protected isError(payloadType): boolean {
        //Overwrite this method by your buisness logic
        return false;
    }

    protected processMessage(command, msg, payloadType) {
        if (this.isError(payloadType)) {
            command.fail(msg);
        } else {
            command.done(msg);
        }
    }

    protected processPushEvent(msg, payloadType) {
        if (this.handlePushEvent) {
            this.handlePushEvent({payload: msg, payloadType});
        }

        this.emit(payloadType, msg);
    }

    private _onEnd(e) {
        this._isConnected = false;
        this.incomingMessagesListeners.forEach(listener => {
            listener.disconnectHandler();
        });
        this.incomingMessagesListeners = [];
        this.onEnd(e);
    }

    public isDisconnected() {
        return !this._isConnected;
    }

    public isConnected() {
        return this._isConnected;
    }

    private addIncomingMessagesListener (fnToAdd: IIncommingMessagesListener) {
        this.incomingMessagesListeners.push(fnToAdd);
    }

    private removeIncomingMesssagesListener(fnToRemove: IIncommingMessagesListener) {
        this.incomingMessagesListeners = this.incomingMessagesListeners.filter(fn => fn != fnToRemove);
    }

    public sendCommandWithoutResponse(payloadType: number, payload: Object) {
        this.send(this.protocol.encode(payloadType, payload, hat()));
    }

    public sendMultiresponseCommand(multiResponseParams: IMultiResponseParams) {
        let {payloadType, payload, onMessage, onError} = multiResponseParams;
        const msgId = hat();

        const incomingMessagesListener = {
            handler: (msg) => {
                var shouldUnsubscribe = onMessage(msg);

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
                this.send(this.protocol.encode(payloadType, payload, msgId));
            } catch (e) {
                onError();
            }
        } else {
            onError();
        }
    }

    public sendCommandWithPayloadtype (payloadType: number, payload: Object): JQueryPromise<IMessageWOMsgId> {
        const def = $.Deferred<IMessageWOMsgId>();

        this.sendMultiresponseCommand({
            payloadType,
            payload,
            onMessage: result => {
                if (this.isError(result.payloadType)) {
                    def.reject(result);
                } else {
                    def.resolve(result);
                }
                return true;
            },
            onError: () => {
                def.reject();
            }
        });

        return def.promise();
    }

    public sendGuaranteedCommandWithPayloadtype (payloadType: number, payload: Object): JQueryPromise<IMessageWOMsgId> {
        if (this.isConnected()) {
            return this.sendCommandWithPayloadtype(payloadType, payload);
        } else {
            const def = $.Deferred();

            this.callbacksOnConnect.push(() => {
                this.sendCommandWithPayloadtype(payloadType, payload)
                    .then(def.resolve, def.reject);
            });

            return def;
        }
    }

    public onConnect() {}

    public onEnd(e: any) {}
}
