import {EventEmitter} from 'events';

import {encode} from '@msgpack/msgpack/dist';

import {pluginId} from './manifest';
import {getWSConnectionURL} from './utils';

export default class WebSocketClient extends EventEmitter {
    private ws: WebSocket | null;
    private seqNo = 0;
    private connID = '';
    private eventPrefix: string = 'custom_' + pluginId;

    constructor() {
        super();
        this.ws = new WebSocket(getWSConnectionURL());

        this.ws.onerror = (err) => {
            this.emit('error', err);
            this.ws = null;
            this.close();
        };

        this.ws.onclose = ({code}) => {
            this.ws = null;
            this.close(code);
        };

        this.ws.onmessage = ({data}) => {
            if (!data) {
                return;
            }
            let msg;
            try {
                msg = JSON.parse(data);
            } catch (err) {
                console.log(err);
            }

            if (!msg || !msg.event || !msg.data) {
                return;
            }

            if (msg.event === 'hello') {
                this.connID = msg.data.connection_id;
                this.emit('open');
                return;
            } else if (!this.connID) {
                console.log('ws message received while waiting for hello');
                return;
            }

            if (msg.data.connID !== this.connID) {
                return;
            }

            if (msg.event === this.eventPrefix + '_join') {
                this.emit('join');
            }

            if (msg.event === this.eventPrefix + '_error') {
                this.emit('error', msg.data);
            }

            if (msg.event === this.eventPrefix + '_signal') {
                this.emit('message', msg.data);
            }
        };
    }

    send(action: string, data?: Object, binary?: boolean) {
        const msg = {
            action: `${this.eventPrefix}_${action}`,
            seq: this.seqNo++,
            data,
        };
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            if (binary) {
                this.ws.send(encode(msg));
            } else {
                this.ws.send(JSON.stringify(msg));
            }
        }
    }

    close(code?: number) {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        } else {
            this.emit('close', code);
        }
        this.seqNo = 0;
        this.connID = '';
    }
}
