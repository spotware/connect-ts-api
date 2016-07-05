export class GuaranteedCommand {
    public clientMsgId: string;
    public msg: any;
    public promise: JQueryDeferred<any>;

    constructor(params) {
        this.clientMsgId = params.clientMsgId;
        this.msg = params.msg;
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
        delete this.clientMsgId;
        delete this.msg;
    }
}
