import {ReplaySubject} from "rxjs";
import {IConnectionAdapter, AdapterConnectionStates, IMessageWithId} from "connection-adapter";

const hat = require('hat');

export interface IMessage {
    payloadType: number;
    payload?: Object;
}

export interface IConnectionParams {
    adapter: IConnectionAdapter;
    instanceId: string;
}

export interface ISendCommand {
    message: IMessage; //IMessage to be sent
    guaranteed?: boolean; //Will send the message as soon as the connection is established
    multiResponse?: boolean; //If true, will *not* unsubscribe handler. Consumer will have to unsubscribe manually
    onResponse?: (data?: IMessage) => void; //Handler. Data response received, will unsubscribe by default after first response as it is the most common use-case. If not present no handler will be subscribed.
    onError?: (err: string) => void; //Trigger if message couldn't be sent
}

interface CacheCommand {
    clientMsgId: string;
    command: ISendCommand;
}

export class Connect {
    //Set an instance ID, optional. Useful when you have multiple instances.
    private instanceId: string;
    private adapter: IConnectionAdapter;
    private adapterConnected = false;
    private commandsAwaitingResponse: CacheCommand[] = [];
    private guaranteedCommandsToBeSent: CacheCommand[] = [];
    private pushEvents = new ReplaySubject<IMessage>(null);

    constructor(params: IConnectionParams) {
        this.instanceId = params.instanceId || 'connect';
        this.adapter = params.adapter;
        this.subscribeToAdapter();
    }

    private subscribeToAdapter(): void {
        this.adapter.state
            .filter(state => state === AdapterConnectionStates.CONNECTED)
            .subscribe(this.onOpen.bind(this));
        this.adapter.state
            .filter(state => state === AdapterConnectionStates.DISCONNECTED)
            .subscribe(this.onEnd.bind(this));
        this.adapter.data.subscribe(this.onData.bind(this));
    }

    private onOpen() {
        this.adapterConnected = true;
        this.callGuaranteedCommands();
    }

    private callGuaranteedCommands(): void {
        this.guaranteedCommandsToBeSent.forEach(commandToBeSent => {
            const {payloadType, payload} = commandToBeSent.command.message;
            const clientMsgId = commandToBeSent.clientMsgId;
            this.commandsAwaitingResponse.push(commandToBeSent);
            this.adapter.send({payloadType, payload, clientMsgId});
            this.removeCommandFromList(commandToBeSent, this.guaranteedCommandsToBeSent);
        });
    }

    private onData(data: IMessageWithId) {
        if (data.clientMsgId) {
            this.processData(data);
        } else {
            this.processPushEvent(data);
        }
    }

    private processData(data: IMessageWithId) {
        this.commandsAwaitingResponse.forEach(sentCommand => {
            if (sentCommand.clientMsgId === data.clientMsgId) {
                sentCommand.command.onResponse({payload: data.payload, payloadType: data.payloadType});
                if (!sentCommand.command.multiResponse) {
                    this.removeCommandFromList(sentCommand, this.commandsAwaitingResponse);
                }
            }
        });
    }

    private removeCommandFromList(commandToRemove: CacheCommand, listUsed: CacheCommand []): void {
        const commandToRemoveIndex = listUsed.findIndex((command) => {
            return command.clientMsgId === commandToRemove.clientMsgId
        });
        if (commandToRemoveIndex >= 0) {
            listUsed.splice(commandToRemoveIndex, 1);
        }
    }

    public processPushEvent(message: IMessageWithId) {
        const {payload, payloadType} = message;
        this.pushEvents.next({payload, payloadType});
    }

    private onEnd() {
        this.adapterConnected = false;
        this.commandsAwaitingResponse.forEach(sentCommand => {
            if (!sentCommand.command.guaranteed) {
                if (Boolean(sentCommand.command.onError)) {
                    const errDescription = `Message with payladType:${sentCommand.command.message.payloadType} was not sent. Connection was closed before sending`;
                    sentCommand.command.onError(errDescription);
                }
                this.removeCommandFromList(sentCommand, this.commandsAwaitingResponse);
            } else {
                this.guaranteedCommandsToBeSent.push(sentCommand);
            }
        });
    }

    public sendCommand(command: ISendCommand): void {
        const clientMsgId = this.generateClientMsgId();
        const commandToCache = {
            clientMsgId,
            command
        };
        const messageToSend: IMessageWithId = {
            clientMsgId,
            payload: command.message.payload,
            payloadType: command.message.payloadType
        };
        if (this.adapterConnected) {
            this.commandsAwaitingResponse.push(commandToCache);
            this.adapter.send(messageToSend);
        } else {
            if (!command.guaranteed && Boolean(command.onError)) {
                const errDescription = `Message with payladType:${command.message.payloadType} was not sent. Connection is closed`;
                command.onError(errDescription);
            } else {
                this.guaranteedCommandsToBeSent.push(commandToCache);
            }
        }
    }

    private generateClientMsgId(): string {
        return hat();
    }

    public setPushEventHandler(callback: (data: IMessage) => any): void {
        this.pushEvents.subscribe(callback);
    }
}
