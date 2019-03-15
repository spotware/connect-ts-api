import {ReplaySubject} from 'rxjs';
import {filter} from 'rxjs/operators';

import {AdapterConnectionStates, IConnectionAdapter, IMessageWithId} from 'connection-adapter';

import * as hat from 'hat';

export interface IMessage {
    payloadType: number;
    payload?: Object;
}

export interface IConnectionParams {
    adapter: IConnectionAdapter;
    instanceId: string;
    payloadTypesNotAwaitingResponse?: number[];
    generateClientMsgId?(): string;
}

export interface ISendCommand {
    message: IMessage; //IMessage to be sent
    guaranteed?: boolean; //Will send the message as soon as the connection is established
    multiResponse?: boolean; //If true, will *not* unsubscribe handler. Consumer will have to unsubscribe manually
    onResponse?: (data?: IMessage) => void; //Handler. Data response received, will unsubscribe by default after first response as it is the most common use-case. If not present no handler will be subscribed.
    onError?: (err: string) => void; //Trigger if message couldn't be sent
}

export interface ISubscribableCommand {
    unsubscribe: () => void;
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
    private pushEvents = new ReplaySubject<IMessage>(1);
    private payloadTypesNotAwaitingResponse: number[];
    private readonly generateClientMsgId: () => string;

    constructor(params: IConnectionParams) {
        this.instanceId = params.instanceId || 'connect';
        this.adapter = params.adapter;
        this.payloadTypesNotAwaitingResponse = params.payloadTypesNotAwaitingResponse || [];
        this.generateClientMsgId = params.generateClientMsgId || hat;
        this.subscribeToAdapter();
    }

    private subscribeToAdapter(): void {
        this.adapter.state$.pipe(
            filter(state => state === AdapterConnectionStates.CONNECTED)
        ).subscribe(this.onOpen.bind(this));

        this.adapter.state$.pipe(
            filter(state => state === AdapterConnectionStates.DISCONNECTED)
        ).subscribe(this.onEnd.bind(this));

        this.adapter.data$.subscribe(this.onData.bind(this));
    }

    private onOpen() {
        this.adapterConnected = true;
        this.callGuaranteedCommands();
    }

    private callGuaranteedCommands(): void {
        this.guaranteedCommandsToBeSent.forEach(commandToBeSent => {
            const {payloadType, payload} = commandToBeSent.command.message;
            const clientMsgId = commandToBeSent.clientMsgId;
            this.addCommandToList(commandToBeSent, this.commandsAwaitingResponse);
            this.adapter.send({payloadType, payload, clientMsgId});
            this.removeCommandFromList(commandToBeSent, this.guaranteedCommandsToBeSent);
        });
    }

    private onData(data: IMessageWithId) {
        if (this.commandsAwaitingResponse.some(item => item.clientMsgId === data.clientMsgId)) {
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

    private addCommandToList(commandToAdd: CacheCommand, listUsed: CacheCommand []): void {
        if (listUsed.findIndex(command => command.clientMsgId === commandToAdd.clientMsgId) === -1) {
            listUsed.push(commandToAdd);
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
                this.addCommandToList(sentCommand, this.guaranteedCommandsToBeSent);
            }
        });
    }

    public sendCommand(command: ISendCommand): ISubscribableCommand {
        const clientMsgId = this.generateClientMsgId();
        const commandToCache: CacheCommand = {
            clientMsgId,
            command
        };
        const messageToSend: IMessageWithId = {
            clientMsgId,
            payload: command.message.payload,
            payloadType: command.message.payloadType
        };
        if (this.adapterConnected) {
            if (this.payloadTypesNotAwaitingResponse.indexOf(command.message.payloadType) === -1) {
                this.addCommandToList(commandToCache, this.commandsAwaitingResponse);
            }
            try {
                this.adapter.send(messageToSend);
            } catch (e) {
                const errDescription = `Message with payladType:${command.message.payloadType} was not sent. 
                Adapter could not send command. Reason: ${e}`;
                command.onError(errDescription);
            }
            return this.getSubscribableForList(commandToCache, this.commandsAwaitingResponse);
        } else {
            if (!command.guaranteed && Boolean(command.onError)) {
                const errDescription = `Message with payladType:${command.message.payloadType} was not sent. Connection is closed`;
                command.onError(errDescription);
                return this.getEmptySubscribable();
            } else {
                this.addCommandToList(commandToCache, this.guaranteedCommandsToBeSent);
                return this.getSubscribableForList(commandToCache, this.guaranteedCommandsToBeSent);
            }
        }

    }

    private getSubscribableForList(cachedCommand: CacheCommand, listUsed: CacheCommand []): ISubscribableCommand {
        return {
            unsubscribe: () => {
                this.removeCommandFromList(cachedCommand, listUsed);
            }
        }
    }

    private getEmptySubscribable(): ISubscribableCommand {
        return {
            unsubscribe: () => {
                return null;
            }
        }
    }

    public setPushEventHandler(callback: (data: IMessage) => void): void {
        this.pushEvents.subscribe(callback);
    }
}
