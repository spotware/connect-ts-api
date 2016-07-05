import {GuaranteedCommand} from './guaranteed_command';
import {State} from './state';

export class GuaranteedCommands {

    private state: State;
    private send: any;
    private openCommands: GuaranteedCommand[];

    constructor(params: any) {
        this.state = params.state;
        this.send = params.send;
        this.openCommands = [];
    }

    public create(params): JQueryDeferred<any> {
        var command = new GuaranteedCommand(params);

        this.openCommands.push(command);

        if (this.state.isConnected()) {
            this.send(command.msg);
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

    public extract(clientMsgId: string): GuaranteedCommand {
        var openCommands = this.openCommands;
        var openCommandsLength = openCommands.length;
        var command;
        for (var i = 0; i < openCommandsLength; i += 1) {
            command = openCommands[i];
            if (command.clientMsgId === clientMsgId) {
                openCommands.splice(i, 1);
                return command;
            }
        }
    }

}
