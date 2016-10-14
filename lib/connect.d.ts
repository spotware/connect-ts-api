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
export interface IConnectionParams {
    encodeDecode: any;
    protocol: any;
    onPushEvent?: (message: IMessageWOMsgId) => void;
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
    getAdapter(): any;
    setAdapter(adapter: any): void;
    private initialization();
    start(): JQueryPromise<void>;
    private onData(data);
    private onOpen();
    sendGuaranteedCommand(payloadType: number, params: any): JQueryPromise<any>;
    sendCommand(payloadType: number, params: any): JQueryPromise<any>;
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
    sendMultiresponseCommand(payloadType: number, payload: Object, onMessage: (data) => boolean, onError?: () => void): void;
    sendCommandWithPayloadtype(payloadType: number, payload: Object): JQueryPromise<IMessageWOMsgId>;
    sendGuaranteedCommandWithPayloadtype(payloadType: number, payload: Object): JQueryPromise<IMessageWOMsgId>;
    onConnect(): void;
    onEnd(e: any): void;
}
