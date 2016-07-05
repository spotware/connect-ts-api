'use strict';

var hat = require('hat');
import {EventEmitter} from 'events';
import {State} from './state';
import {GuaranteedCommands} from './guaranteed_commands';
import {GuaranteedCommand} from './guaranteed_command';
import {Commands} from './commands';
import {Command} from './command';

export interface IConnectionParams {
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
        super();

        this.encodeDecode = params.encodeDecode;
        this.protocol = params.protocol;

        this.initialization();
    }

    public getAdapter() {
        return this.adapter;
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

    public start(): JQueryPromise<void> {
        var def = $.Deferred<void>();

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

        return def.promise();
    }

    private onData(data) {
        this.encodeDecode.decode(data);
    }

    private onOpen() {
        this.state.connected();

        this.guaranteedCommands.resend();
        this.onConnect();
    }

    public sendGuaranteedCommand(payloadType: number, params): JQueryDeferred<any> {
        var clientMsgId: string = hat();
        var msg = this.protocol.encode(payloadType, params, clientMsgId);

        return this.guaranteedCommands.create({
            clientMsgId: clientMsgId,
            msg: msg
        });
    }

    public sendCommand(payloadType: number, params): JQueryDeferred<any> {
        var clientMsgId: string = hat();
        var msg = this.protocol.encode(payloadType, params, clientMsgId);

        return this.commands.create({
            clientMsgId: clientMsgId,
            msg: msg
        });
    }

    private send(data) {
        this.adapter.send(
            this.encodeDecode.encode(data)
        );
    }

    private onMessage(data) {
        data = this.protocol.decode(data);
        var msg = data.msg;
        var payloadType = data.payloadType;
        var clientMsgId = data.clientMsgId;

        if (clientMsgId) {
            this.processData(clientMsgId, payloadType, msg);
        } else {
            this.processPushEvent(msg, payloadType);
        }
    }

    private processData(clientMsgId, payloadType, msg) {
        var command = this.extractCommand(clientMsgId);
        if (command) {
            this.processMessage(command, msg, payloadType);
        } else {
            this.processPushEvent(msg, payloadType);
        }
    }

    private extractCommand(clientMsgId) {
        return this.guaranteedCommands.extract(clientMsgId) || this.commands.extract(clientMsgId);
    }

    protected isError(payloadType): boolean {
        //Overwrite this method by your buisness logic
        return false;
    }

    protected processMessage(command, msg, payloadType) {
        if (this.isError(payloadType)) {
            command.fail(msg);
        } else {
            command.done(msg);
        }
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
