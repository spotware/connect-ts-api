import {Command} from './command';
import {State} from './state';

export class Commands {

    private state: State;
    private send: any;
    private openCommands: Command[];

    constructor(params: any) {
        this.state = params.state;
        this.send = params.send;
        this.openCommands = [];
    }

    public create(params): JQueryDeferred<any> {
        var clientMsgId = params.clientMsgId;
        var msg = params.msg;

        var openCommands = this.openCommands;

        var command = new Command({
            clientMsgId: clientMsgId
        });

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

    public extract(clientMsgId: string): Command {
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
