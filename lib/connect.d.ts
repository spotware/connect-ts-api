import { IConnectionAdapter, IMessageWithId } from "connection-adapter";
export interface IMessage {
    payloadType: number;
    payload?: Object;
}
export interface IConnectionParams {
    adapter: IConnectionAdapter;
    instanceId: string;
}
export interface ISendCommand {
    message: IMessage;
    guaranteed?: boolean;
    multiResponse?: boolean;
    onResponse?: (data?: IMessage) => void;
    onError?: (err: string) => void;
}
export interface ISubscribableCommand {
    unsubscribe: () => void;
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
    processPushEvent(message: IMessageWithId): void;
    private onEnd();
    sendCommand(command: ISendCommand): ISubscribableCommand;
    private getSubscribableForList(cachedCommand, listUsed);
    private getEmptySubscribable();
    private generateClientMsgId();
    setPushEventHandler(callback: (data: IMessage) => any): void;
}
