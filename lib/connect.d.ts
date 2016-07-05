import { EventEmitter } from 'events';
export interface IConnectionParams {
    encodeDecode: any;
    protocol: any;
}
export declare class Connect extends EventEmitter {
    private adapter;
    private encodeDecode;
    private protocol;
    private state;
    private guaranteedCommands;
    private commands;
    constructor(params: IConnectionParams);
    getAdapter(): any;
    setAdapter(adapter: any): void;
    private initialization();
    start(): JQueryPromise<void>;
    private onData(data);
    private onOpen();
    sendGuaranteedCommand(payloadType: number, params: any): JQueryDeferred<any>;
    sendCommand(payloadType: number, params: any): JQueryDeferred<any>;
    private send(data);
    private onMessage(data);
    private processData(clientMsgId, payloadType, msg);
    private extractCommand(clientMsgId);
    protected isError(payloadType: any): boolean;
    protected processMessage(command: any, msg: any, payloadType: any): void;
    protected processPushEvent(msg: any, payloadType: any): void;
    private _onEnd(e);
    isDisconnected(): boolean;
    isConnected(): boolean;
    onConnect(): void;
    onEnd(e: any): void;
}
