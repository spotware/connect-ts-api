const hat = require('hat');
import {EventEmitter} from 'events';

interface IIncommingMessagesListener {
    message: IMessage;
    handler: (payload: IMessage) => void;
    shouldProcess: (payload: IMessage) => boolean;
    disconnectHandler: (err: ISendRequestError) => void;
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
    onError: (err: string) => any;
    onEnd: (err: string) => any;
    destroy?: () => void;
    connect: () => any;
    send: (message: any) => any;
}

export interface IConnectionParams {
    encodeDecode: IEncoderDecoder
    adapter: IAdapter;
}

export interface IMultiResponseParams {
    payloadType: number;
    payload: Object;
    onMessage: (data) => boolean;
    onError?: (err: ISendRequestError) => void;
}

export interface ISendRequestError {
    errorCode: SendRequestError,
    description: string
}

export enum SendRequestError {
    ADAPTER_DISCONNECTED = 1,
    ADAPTER_DROP = 2,
    ADAPTER_DISRUPTED = 3
}

export interface IEncoderDecoder {
    encode: (data: IDataToSend) => any;
    decode: (params?: any) => any;
}

export interface IDataToSend {
    payloadType: number,
    payload: any,
    clientMsgId: string
}

export class Connect {

    private adapter: IAdapter;
    private encodeDecode: IEncoderDecoder;
    private connected = false;
    private incomingMessagesListeners: IIncommingMessagesListener[] = [];
    private guaranteedIncomingMessagesListeners: IIncommingMessagesListener[] = [];
    private callbacksOnConnect: (() => void)[] = [];
    private destroyingAdapter = false;

    constructor(params: IConnectionParams) {
        this.encodeDecode = params.encodeDecode;
        this.adapter = params.adapter;
    }

    public updateAdapter(adapter: any) {
        if (this.adapter) {
            this.destroyAdapter();
        }
        this.adapter = adapter;
    }

    public start(): Promise<void> {
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

        this.callGuaranteedCommands();

        this.onConnect();
    }

    private callGuaranteedCommands(): void {
        this.guaranteedIncomingMessagesListeners.forEach(listener => {
            const {clientMsgId, payloadType, payload} = listener.message;
            this.send({payloadType, payload, clientMsgId: clientMsgId});
        });
    }

    /**
     * @deprecated Too consumer-specific. can be confusing. Just use sendGuaranteedCommandWithPayloadtype and handle the
     * response on consumer.
     */
    public sendGuaranteedCommand(payloadType: number, params) {
        return this.sendGuaranteedCommandWithPayloadtype(payloadType, params).then(msg => msg.payload);
    }

    /**
     * @deprecated Too consumer-specific. can be confusing. Just use sendCommandWithPayloadtype and handle the
     * response on consumer.
     */
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

        this.guaranteedIncomingMessagesListeners.forEach(guaranteedListener => {
            if (guaranteedListener.shouldProcess(message)) {
                isProcessed = true;
                guaranteedListener.handler(message);
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
    }

    private _onEnd(e: string) {
        this.connected = false;
        this.incomingMessagesListeners.forEach(listener => {
            const error = {
                errorCode: SendRequestError.ADAPTER_DROP,
                description: `Message with payladType:${listener.message.payloadType} was not sent. Adapter ended with reason: ${e}`
            };
            listener.disconnectHandler(error);
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

    private addIncomingMessagesListener(fnToAdd: IIncommingMessagesListener) {
        this.incomingMessagesListeners.push(fnToAdd);
    }

    private addGuaranteedIncomingMessagesListener(fnToAdd: IIncommingMessagesListener) {
        this.guaranteedIncomingMessagesListeners.push(fnToAdd);
    }

    private removeIncomingMesssagesListener(fnToRemove: IIncommingMessagesListener) {
        this.incomingMessagesListeners = this.incomingMessagesListeners.filter(fn => fn != fnToRemove);
    }

    private removeIncomingGuaranteedMesssagesListener(fnToRemove: IIncommingMessagesListener) {
        this.guaranteedIncomingMessagesListeners = this.guaranteedIncomingMessagesListeners.filter(fn => fn != fnToRemove);
    }

    public sendCommandWithoutResponse(payloadType: number, payload: Object) {
        this.send({payloadType, payload, clientMsgId: this.generateClientMsgId()});
    }

    public sendMultiresponseCommand(multiResponseParams: IMultiResponseParams): void {
        const {payloadType, payload, onMessage, onError} = multiResponseParams;
        if (this.isConnected()) {
            const clientMsgId = this.generateClientMsgId();
            const message = {
                clientMsgId: clientMsgId,
                payloadType,
                payload
            };
            const incomingMessagesListener: IIncommingMessagesListener = {
                message,
                handler: (msg) => {
                    const shouldUnsubscribe = onMessage(msg);

                    if (shouldUnsubscribe) {
                        this.removeIncomingMesssagesListener(incomingMessagesListener);
                    }
                },
                shouldProcess: msg => msg.clientMsgId == clientMsgId,
                disconnectHandler: (err) => {
                    if (onError) {
                        this.removeIncomingMesssagesListener(incomingMessagesListener);
                        onError(err);
                    }
                }
            };

            this.addIncomingMessagesListener(incomingMessagesListener);

            try {
                this.send({payloadType, payload, clientMsgId});
            } catch (err) {
                const description = (typeof err === 'string') ? err : 'Message could not be sent due to a problem with the adapter';
                const error = {
                    errorCode: SendRequestError.ADAPTER_DISRUPTED,
                    description
                };
                onError(error);
            }
        } else {
            const error = {
                errorCode: SendRequestError.ADAPTER_DISCONNECTED,
                description: 'Adapter is not connected'
            };
            onError(error);
        }
    }

    private generateClientMsgId(): string {
        return hat();
    }

    public sendGuaranteedMultiresponseCommand(multiResponseParams: IMultiResponseParams): void {
        const {payloadType, payload, onMessage, onError} = multiResponseParams;
        const clientMsgId = this.generateClientMsgId();
        const message = {
            clientMsgId: clientMsgId,
            payloadType,
            payload
        };
        const incomingGuaranteedMessagesListener: IIncommingMessagesListener = {
            message,
            handler: (msg) => {
                const shouldUnsubscribe = onMessage(msg);

                if (shouldUnsubscribe) {
                    this.removeIncomingGuaranteedMesssagesListener(incomingGuaranteedMessagesListener);
                }
            },
            shouldProcess: msg => {
                return msg.clientMsgId == clientMsgId
            },//Should be common, the matching parameters must always be clientMsgId
            disconnectHandler: (err) => {
                //Nothing to do for guaranteed commands
            }
        };

        this.addGuaranteedIncomingMessagesListener(incomingGuaranteedMessagesListener);

        if (this.isConnected()) {
            try {
                this.send({payloadType, payload, clientMsgId});
            } catch (err) {
                const description = (typeof err === 'string') ? err : 'Message could not be sent due to a problem with the adapter';
                const error = {
                    errorCode: SendRequestError.ADAPTER_DISRUPTED,
                    description
                };
                onError(error);
            }
        }
    }

    public sendCommandWithPayloadtype(payloadType: number, payload: Object): Promise<IMessageWOMsgId> {
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

    public sendGuaranteedCommandWithPayloadtype(payloadType: number, payload: Object): Promise<IMessageWOMsgId> {
        return new Promise((resolve, reject) => {
            this.sendGuaranteedMultiresponseCommand({
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

    public onConnect() {
        //Overwrite this method by your business logic
    }

    public onEnd(e: any) {
        //Overwrite this method by your business logic
    }

    public destroyAdapter(): void {
        if (!this.adapter || this.destroyingAdapter) {
            return
        }
        this.destroyingAdapter = true;
        this.adapter.onOpen = null;
        this.adapter.onData = null;
        this.adapter.onError = function () {
        };
        if (this.adapter.onEnd) {
            this.adapter.onEnd('Adapter being destroyed. Ending connection');
        }
        this.adapter.onEnd = function () {
        };
        if (this.adapter.destroy) {
            this.adapter.destroy()
        }
        this.adapter.destroy = function () {
        };
        this.adapter = null;
        this.destroyingAdapter = false;
    }
}
