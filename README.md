# connect-ts-api
[![Build Status](https://travis-ci.org/spotware/connect-ts-api.svg?branch=master)](https://travis-ci.org/spotware/connect-ts-api)

A connector SDK for [Spotware Connect Open API](https://connect.spotware.com/docs/api-reference) in TypeScript

## API v2.x.x
This api provides a layer to send and receive messages using Spotware Open API Protobuf protocol.
For a detailed messages structure description check [this link](https://connect.spotware.com/docs/api-reference/developer-library/protobuf-protocol-intro)

#### installation
```
npm i spotware/connect-ts-api
```
#### Usage
```
import {Connect} from 'connect-ts-api';
import {encoder} from 'my-encoder-module'; //For more information and Interfaces check the docs
import {adapter} from 'my-adapter-module'; //For more information and Interfaces check the docs

const connect = new Connect({
    encodeDecode: encoder,
    adapter: adapter
});

connect.start();

connect.sendCommand(990, {}) //Send Hello event
    .then(res => { 
        //Work with response
    }).catch(err => {
        //Handle error
    });
```

#### Low level API: Communication layer structure
The main interfaces for subscribing callbacks that will be handled after sending a certain request to the server
through an open connection and handling errors.
```
interface IMultiResponseParams {
    payloadType: number;
    payload: Object;
    onMessage: (data) => boolean;
    onError?: (err: ISendRequestError) => void;
}

interface ISendRequestError {
    errorCode: SendRequestError,
    description: string
}

enum SendRequestError {
    ADAPTER_DISCONNECTED = 1,
    ADAPTER_DROP = 2,
    ADAPTER_ERROR = 3
}
```
##### payloadType
* The message ID that will identify on the server the type of serialized message.
##### payload
* The serialized message to be sent.
##### onMessage
* Callback that will handle all received responses that match the request. Must return boolean
to indicate that the message was successfully handled
##### onError
* [optional] Callback that will be executed if the request could not be sent. Called with
error code and description as parameters.

---
##### sendMultiresponseCommand
```
sendMultiresponseCommand(multiResponseParams: IMultiResponseParams): void
```
Sends one single command to server. Subscribes onMessage to incoming responses and push events
and unsubscribes as soon as onMessage returns true. 
If onError is executed before onMessage can handle any incoming message, the onMessage
 callback will be unsubscribed.
 
---
##### sendGuaranteedMultiresponseCommand
```
sendGuaranteedMultiresponseCommand(multiResponseParams: IMultiResponseParams): void;
```
The same as `sendMultiresponseCommand` but onError will be handled only with errorCode 3. 
If the Error is due to codes 1 or 2 before onMessage can handle any incoming message, the request 
will be cached and re-sent as soon as a new connection is open, and no onError will be called.

## Contributions
Pull requests must address at least one open issue.
