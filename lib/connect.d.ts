import { ConnectionAdapter, IdMessage } from "connection-adapter";
export interface Message {
    payloadType: number;
    payload?: Object;
}
export interface IConnectionParams {
    adapter: ConnectionAdapter;
    instanceId: string;
}
export interface SendCommand {
    message: Message;
    guaranteed?: boolean;
    multiResponse?: boolean;
    onResponse?: (data?: Message) => void;
    onError?: (err: string) => void;
}
export declare class Connect {
    private instanceId;
    private adapter;
    private adapterConnected;
    private commandsAwaitingResponse;
    private guaranteedCommandsToBeSent;
    private pushEvents;
    constructor(params: IConnectionParams);
    private subscribeToAdapter();
    private onOpen();
    private callGuaranteedCommands();
    private onData(data);
    private processData(data);
    private removeCommandFromList(commandToRemove, listUsed);
    processPushEvent(message: IdMessage): void;
    private onEnd();
    sendCommand(command: SendCommand): void;
    private generateClientMsgId();
    setPushEventHandler(callback: (data: Message) => any): void;
}
