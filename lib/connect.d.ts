/// <reference types="node" />
import { EventEmitter } from 'events';
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
    encodeDecode: IEncoderDecoder;
    adapter: IAdapter;
    onPushEvent?: (message: IMessageWOMsgId) => void;
}
export interface IMultiResponseParams {
    payloadType: number;
    payload: Object;
    onMessage: (data) => boolean;
    onError?: (err?: any) => void;
}
export interface IEncoderDecoder {
    encode: (data: IDataToSend) => any;
    decode: (params?: any) => any;
}
export interface IDataToSend {
    payloadType: number;
    payload: any;
    msgId: number;
}
export declare class Connect extends EventEmitter {
    private adapter;
    private encodeDecode;
    private connected;
    private incomingMessagesListeners;
    private handlePushEvent;
    private callbacksOnConnect;
    constructor(params: IConnectionParams);
    updateAdapter(adapter: any): void;
    start(): PromiseLike<void>;
    private onOpen();
    sendGuaranteedCommand(payloadType: number, params: any): PromiseLike<any>;
    sendCommand(payloadType: number, params: any): PromiseLike<any>;
    private send(data);
    private onData(data);
    private processData(clientMsgId, payloadType, msg);
    protected isError(payloadType: any): boolean;
    protected processPushEvent(msg: any, payloadType: any): void;
    private _onEnd(e);
    isDisconnected(): boolean;
    isConnected(): boolean;
    private addIncomingMessagesListener(fnToAdd);
    private removeIncomingMesssagesListener(fnToRemove);
    sendCommandWithoutResponse(payloadType: number, payload: Object): void;
    sendMultiresponseCommand(multiResponseParams: IMultiResponseParams): void;
    sendCommandWithPayloadtype(payloadType: number, payload: Object): PromiseLike<IMessageWOMsgId>;
    sendGuaranteedCommandWithPayloadtype(payloadType: number, payload: Object): PromiseLike<IMessageWOMsgId>;
    onConnect(): void;
    onEnd(e: any): void;
    destroyAdapter(): void;
}
