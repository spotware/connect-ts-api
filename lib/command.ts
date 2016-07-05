export class Command {
    public clientMsgId: string;
    public promise: JQueryDeferred<any>;

    constructor(params) {
        this.clientMsgId = params.clientMsgId;
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
        delete this.clientMsgId;
    }
}
