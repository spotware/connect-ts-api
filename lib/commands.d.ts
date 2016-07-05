import { Command } from './command';
export declare class Commands {
    private state;
    private send;
    private openCommands;
    constructor(params: any);
    create(params: any): JQueryDeferred<any>;
    fail(): void;
    extract(clientMsgId: string): Command;
}
