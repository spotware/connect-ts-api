'use strict';

import {EventEmitter} from 'events';

//import {State} from './state';
//import {GuaranteedCommands} from './guaranteed_commands';
//import {GuaranteedCommand} from './guaranteed_command';
//import {Commands} from './commands';
//import {Command} from './command';

export class State {

    private value: boolean;

    constructor() {
        this.disconnected();
    }

    public disconnected(): void {
        this.value = false;
    }

    public connected(): void {
        this.value = true;
    }

    public isConnected(): boolean {
        return this.value;
    }

}

export class GuaranteedCommand {

    private msg: any;
    public promise: JQueryDeferred<any>;

    constructor(msg: any) {
        this.msg = msg;
        this.promise = $.Deferred();
    }

    public done(msg: any) {
        this.promise.resolve(msg);
        this.destroy();
    }

    public fail(msg: any) {
        this.promise.reject(msg);
        this.destroy();
    }

    private destroy() {
        delete this.msg;
    }
}

export class GuaranteedCommands {

    private state: State;
    private send: any;
    private openCommands: any;

    constructor(params: any) {
        this.state = params.state;
        this.send = params.send;
        this.openCommands = [];
    }

    public create(msg: any): JQueryDeferred<any> {
        var command = new GuaranteedCommand(msg);

        this.openCommands.push(command);

        if (this.state.isConnected()) {
            this.send(msg);
        }
        return command.promise;
    }

    public resend() {
        this.openCommands
            .map(function (command) {
                return command.msg;
            })
            .forEach(this.send);
    }

    public extract(clientMsgId: string): any {
        var openCommands = this.openCommands;
        var openCommandsLength = openCommands.length;
        var command;
        var index = 0;
        while (index < openCommandsLength) {
            var command = openCommands[index];
            if (command.msg.clientMsgId === clientMsgId) {
                openCommands.splice(index, 1);
                return command;
            }
            index += 1;
        }
    }

}

export class Command {

    private msg: any;
    public promise: JQueryDeferred<any>;

    constructor(msg: any) {
        this.msg = msg;
        this.promise = $.Deferred();
    }

    public done(respond: any) {
        this.promise.resolve(respond);
        this.destroy();
    }

    public fail(respond: any) {
        this.promise.reject(respond);
        this.destroy();
    }

    private destroy() {
        delete this.msg;
    }
}

export class Commands {

    private state: State;
    private send: any;
    private openCommands: any;

    constructor(params: any) {
        this.state = params.state;
        this.send = params.send;
        this.openCommands = [];
    }

    public create(msg: any): JQueryDeferred<any> {
        var openCommands = this.openCommands;

        var command = new Command(msg);

        openCommands.push(command);

        if (this.state.isConnected()) {
            this.send(msg);
        } else {
            command.fail(<any>undefined);
            openCommands.splice(openCommands.indexOf(command), 1);
        }
        return command.promise;
    }

    public fail() {
        var openCommands = this.openCommands;
        var command;
        for (var i = 0; i < openCommands.length; i += 1) {
            command = openCommands.pop();
            command.fail();
        }
    }

    public extract(clientMsgId: string): any {
        var openCommands = this.openCommands;
        var openCommandsLength = openCommands.length;
        var command;
        var index = 0;
        while (index < openCommandsLength) {
            var command = openCommands[index];
            if (command.msg.clientMsgId === clientMsgId) {
                openCommands.splice(index, 1);
                return command;
            }
            index += 1;
        }
    }

}

export interface IConnectionParams {
    adapter: any
    encodeDecode: any
    protocol: any
}

export class Connect extends EventEmitter {

    private adapter: any;
    private encodeDecode: any;
    private protocol: any;
    private state: State;
    private guaranteedCommands: GuaranteedCommands;
    private commands: Commands;

    constructor(params: IConnectionParams) {
        super()

        this.adapter = params.adapter;
        this.encodeDecode = params.encodeDecode;
        this.protocol = params.protocol;

        this.initialization();
    }

    public setAdapter(adapter: any) {
        this.adapter = adapter;
    }

    private initialization() {
        this.state = new State();
        this.guaranteedCommands = new GuaranteedCommands({
            state: this.state,
            send: this.send.bind(this)
        });
        this.commands = new Commands({
            state: this.state,
            send: this.send.bind(this)
        });

        this.encodeDecode.registerDecodeHandler(
            this.onMessage.bind(this)
        );
    }

    public start() {
        var def = $.Deferred();

        var adapter = this.adapter;
        adapter.onOpen = () => {
            this.onOpen();
            def.resolve();
        };
        adapter.onData = this.onData.bind(this);
        adapter.onError = adapter.onEnd = (e) => {
            def.reject();
            this._onEnd(e);
        };

        adapter.connect();

        return def;
    }

    private onData(data) {
        this.encodeDecode.decode(data);
    }

    private onOpen() {
        this.state.connected();

        this.guaranteedCommands.resend();
        this.onConnect();
    }

    public sendGuaranteedCommand(payloadType, params): JQueryDeferred<any> {
        return this.guaranteedCommands.create(
            this.protocol.encode(payloadType, params)
        );
    }

    public sendCommand(payloadType, params): JQueryDeferred<any> {
        return this.commands.create(
            this.protocol.encode(payloadType, params)
        );
    }

    private send(msg) {
        var data = this.encodeDecode.encode(msg);
        this.adapter.send(data);
    }

    private onMessage(data) {
        data = this.protocol.decode(data);
        var msg = data.msg;
        var payloadType = data.payloadType;
        var clientMsgId = data.clientMsgId;

        if (clientMsgId) {
            var command = this.guaranteedCommands.extract(clientMsgId) || this.commands.extract(clientMsgId);
            if (command) {
                if (this.isError(payloadType)) {
                    command.fail(msg);
                } else {
                    command.done(msg);
                }
                return;
            }
        }
        this.processPushEvent(msg, payloadType);
    }

    protected isError(payloadType): boolean {
        //Overwrite this method by your buisness logic
        return false;
    }

    protected processMessage(msg: any, clientMsgId: string, payloadType: number) {

    }

    protected processPushEvent(msg, payloadType) {
        this.emit(payloadType, msg);
    }

    private _onEnd(e) {
        this.state.disconnected();
        this.commands.fail();
        this.onEnd(e);
    }

    public isDisconnected() {
        return !this.state.isConnected();
    }

    public isConnected() {
        return this.state.isConnected();
    }

    public onConnect() {}

    public onEnd(e: any) {}
}
