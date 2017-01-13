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
    connect: () => any;
    send: (message: any) => any;
}
export interface IConnectionParams {
    encodeDecode: any;
    protocol: any;
    adapter: IAdapter;
    onPushEvent?: (message: IMessageWOMsgId) => void;
}
export interface IMultiResponseParams {
    payloadType: number;
    payload: Object;
    onMessage: (data) => boolean;
    onError?: () => void;
}
export declare class Connect extends EventEmitter {
    private adapter;
    private encodeDecode;
    private protocol;
    private _isConnected;
    private incomingMessagesListeners;
    private handlePushEvent;
    private callbacksOnConnect;
    constructor(params: IConnectionParams);
    getAdapter(): IAdapter;
    updateAdapter(adapter: any): void;
    private initialization();
    start(): PromiseLike<void>;
    private onData(data);
    private onOpen();
    sendGuaranteedCommand(payloadType: number, params: any): PromiseLike<any>;
    sendCommand(payloadType: number, params: any): PromiseLike<any>;
    private send(data);
    private onMessage(data);
    private processData(clientMsgId, payloadType, msg);
    protected isError(payloadType: any): boolean;
    protected processMessage(command: any, msg: any, payloadType: any): void;
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
}
