/// <reference types="node" />
/// <reference types="es6-promise" />
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
    private callbacksOnConnect;
    private destroyingAdapter;
    constructor(params: IConnectionParams);
    updateAdapter(adapter: any): void;
    start(): Promise<void>;
    private onOpen();
    sendGuaranteedCommand(payloadType: number, params: any): Promise<any>;
    sendCommand(payloadType: number, params: any): Promise<any>;
    private send(data);
    private onData(data);
    private processData(clientMsgId, payloadType, msg);
    isError(payloadType: any): boolean;
    processPushEvent(msg: any, payloadType: any): void;
    private _onEnd(e);
    isDisconnected(): boolean;
    isConnected(): boolean;
    private addIncomingMessagesListener(fnToAdd);
    private removeIncomingMesssagesListener(fnToRemove);
    sendCommandWithoutResponse(payloadType: number, payload: Object): void;
    sendMultiresponseCommand(multiResponseParams: IMultiResponseParams): void;
    sendCommandWithPayloadtype(payloadType: number, payload: Object): Promise<IMessageWOMsgId>;
    sendGuaranteedCommandWithPayloadtype(payloadType: number, payload: Object): Promise<IMessageWOMsgId>;
    onConnect(): void;
    onEnd(e: any): void;
    destroyAdapter(): void;
}
