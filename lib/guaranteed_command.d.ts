export declare class GuaranteedCommand {
    clientMsgId: string;
    msg: any;
    promise: JQueryDeferred<any>;
    constructor(params: any);
    done(msg: any): void;
    fail(msg: any): void;
    private destroy();
}
