export declare class Command {
    clientMsgId: string;
    promise: JQueryDeferred<any>;
    constructor(params: any);
    done(respond: any): void;
    fail(respond: any): void;
    private destroy();
}
