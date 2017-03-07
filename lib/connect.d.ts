/// <reference types="es6-promise" />
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
    encodeDecode: IEncoderDecoder;
    adapter: IAdapter;
}
export interface IMultiResponseParams {
    payloadType: number;
    payload: Object;
    onMessage: (data) => boolean;
    onError?: (err: ISendRequestError) => void;
}
export interface ISendRequestError {
    errorCode: SendRequestError;
    description: string;
}
export declare enum SendRequestError {
    ADAPTER_DISCONNECTED = 1,
    ADAPTER_DROP = 2,
    ADAPTER_DISRUPTED = 3,
}
export interface IEncoderDecoder {
    encode: (data: IDataToSend) => any;
    decode: (params?: any) => any;
}
export interface IDataToSend {
    payloadType: number;
    payload: any;
    clientMsgId: string;
}
export declare class Connect {
    private adapter;
    private encodeDecode;
    private connected;
    private incomingMessagesListeners;
    private guaranteedIncomingMessagesListeners;
    private callbacksOnConnect;
    private destroyingAdapter;
    constructor(params: IConnectionParams);
    updateAdapter(adapter: any): void;
    start(): Promise<void>;
    private onOpen();
    private callGuaranteedCommands();
    /**
     * @deprecated Too consumer-specific. can be confusing. Just use sendGuaranteedCommandWithPayloadtype and handle the
     * response on consumer.
     */
    sendGuaranteedCommand(payloadType: number, params: any): Promise<any>;
    /**
     * @deprecated Too consumer-specific. can be confusing. Just use sendCommandWithPayloadtype and handle the
     * response on consumer.
     */
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
    private addGuaranteedIncomingMessagesListener(fnToAdd);
    private removeIncomingMesssagesListener(fnToRemove);
    private removeIncomingGuaranteedMesssagesListener(fnToRemove);
    sendCommandWithoutResponse(payloadType: number, payload: Object): void;
    sendMultiresponseCommand(multiResponseParams: IMultiResponseParams): void;
    private generateClientMsgId();
    sendGuaranteedMultiresponseCommand(multiResponseParams: IMultiResponseParams): void;
    sendCommandWithPayloadtype(payloadType: number, payload: Object): Promise<IMessageWOMsgId>;
    sendGuaranteedCommandWithPayloadtype(payloadType: number, payload: Object): Promise<IMessageWOMsgId>;
    onConnect(): void;
    onEnd(e: any): void;
    destroyAdapter(): void;
}
