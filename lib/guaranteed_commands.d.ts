import { GuaranteedCommand } from './guaranteed_command';
export declare class GuaranteedCommands {
    private state;
    private send;
    private openCommands;
    constructor(params: any);
    create(params: any): JQueryDeferred<any>;
    resend(): void;
    extract(clientMsgId: string): GuaranteedCommand;
}
