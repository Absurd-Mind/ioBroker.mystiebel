import WebSocket from 'ws';
import type { MyStiebelAuth } from './auth';
import {
	APP_NAME,
	APP_VERSION_ANDROID,
	MSG_ID_LONG_MAX,
	MSG_ID_LONG_MIN,
	MSG_ID_MAX,
	MSG_ID_MIN,
	USER_AGENT,
	WEBSOCKET_RECONNECT_INITIAL,
	WEBSOCKET_RECONNECT_MAX,
	WS_URL,
} from './const';

/**
 * WebSocket client for MyStiebel service. Handles connection, authentication, subscriptions, and message processing.
 */
export class MyStiebelWS {
	private ws: WebSocket | null = null;
	private auth: MyStiebelAuth;
	private installationId: string;
	private clientId: string;
	private fieldsToMonitor: number[];
	private reconnectDelay: number = WEBSOCKET_RECONNECT_INITIAL;
	private isRunning: boolean = false;
	private usedMessageIds: Set<number> = new Set();
	private log: ioBroker.Logger;
	private onDataUpdate: (data: any[]) => void;

	/**
	 * @param auth - Authenticated MyStiebelAuth instance
	 * @param installationId - Installation ID to connect to
	 * @param clientId - Client ID for identification
	 * @param fieldsToMonitor - List of field indexes to monitor
	 * @param log - Logger instance for logging messages
	 * @param onDataUpdate - Callback function for data updates
	 */
	constructor(
		auth: MyStiebelAuth,
		installationId: string,
		clientId: string,
		fieldsToMonitor: number[],
		log: ioBroker.Logger,
		onDataUpdate: (data: any[]) => void,
	) {
		this.auth = auth;
		this.installationId = installationId;
		this.clientId = clientId;
		this.fieldsToMonitor = fieldsToMonitor;
		this.log = log;
		this.onDataUpdate = onDataUpdate;
	}

	/**
	 * Starts the WebSocket connection.
	 */
	public start(): void {
		this.isRunning = true;
		void this.connect();
	}

	/**
	 * Stops the WebSocket connection.
	 */
	public stop(): void {
		this.isRunning = false;
		if (this.ws) {
			this.ws.close();
			this.ws = null;
		}
	}

	private async connect(): Promise<void> {
		if (!this.isRunning) {
			return;
		}

		try {
			await this.auth.ensureValidToken();
			const token = this.auth.getToken();

			if (!token) {
				throw new Error('No token available');
			}

			const headers = {
				Authorization: `Bearer ${token}`,
				'X-SC-ClientApp-Name': APP_NAME,
				'X-SC-ClientApp-Version': APP_VERSION_ANDROID,
				'User-Agent': USER_AGENT,
			};

			this.ws = new WebSocket(WS_URL, { headers });

			this.ws.on('open', () => {
				this.log.info('WebSocket connected');
				this.reconnectDelay = WEBSOCKET_RECONNECT_INITIAL;
				this.sendLogin(token);
			});

			this.ws.on('message', (data: WebSocket.Data) => {
				this.handleMessage(data);
			});

			this.ws.on('error', (error: Error) => {
				this.log.error(`WebSocket error: ${error.message}`);
			});

			this.ws.on('close', () => {
				this.log.info('WebSocket closed');
				this.handleReconnect();
			});
		} catch (error) {
			this.log.error(`Connection failed: ${error instanceof Error ? error.message : String(error)}`);
			this.handleReconnect();
		}
	}

	private handleReconnect(): void {
		if (!this.isRunning) {
			return;
		}

		this.log.info(`Reconnecting in ${this.reconnectDelay} seconds...`);
		setTimeout(() => {
			this.reconnectDelay = Math.min(this.reconnectDelay * 2, WEBSOCKET_RECONNECT_MAX);
			void this.connect();
		}, this.reconnectDelay * 1000);
	}

	private sendLogin(token: string): void {
		if (!this.ws) {
			return;
		}

		const msg = {
			jsonrpc: '2.0',
			id: 1,
			method: 'Login',
			params: {
				clientId: this.installationId,
				jwt: token,
			},
		};
		this.ws.send(JSON.stringify(msg));
	}

	private handleMessage(data: WebSocket.Data): void {
		try {
			// eslint-disable-next-line @typescript-eslint/no-base-to-string
			const text = Buffer.isBuffer(data) ? data.toString('utf-8') : String(data);
			const msg = JSON.parse(text);

			if (msg.id === 1 && msg.result === true) {
				this.log.debug('Login successful');
				this.requestInitialValues();
			} else if (msg.result && msg.result.fields) {
				this.log.debug(`Received initial data: ${msg.result.fields.length} fields`);
				this.onDataUpdate(msg.result.fields);
				this.subscribeToUpdates();
			} else if (msg.method === 'valuesChanged') {
				this.log.debug(`Value update: ${JSON.stringify(msg.params)}`);
				if (msg.params) {
					this.onDataUpdate([msg.params]);
				}
			}
		} catch (error) {
			this.log.error(`Error parsing message: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private requestInitialValues(): void {
		if (!this.ws) {
			return;
		}

		const msg = {
			jsonrpc: '2.0',
			id: this.generateMessageId(),
			method: 'getValues',
			params: {
				installationId: this.installationId,
				fields: this.fieldsToMonitor,
			},
		};
		this.ws.send(JSON.stringify(msg));
	}

	private subscribeToUpdates(): void {
		if (!this.ws) {
			return;
		}

		const msg = {
			jsonrpc: '2.0',
			id: this.generateMessageId(),
			method: 'Subscribe',
			params: {
				installationId: this.installationId,
				registerIndexes: this.fieldsToMonitor,
			},
		};
		this.ws.send(JSON.stringify(msg));
	}

	/**
	 * Sends a value update to the MyStiebel service.
	 *
	 * @param registerIndex - The register index to update
	 * @param value - The new value
	 */
	public setValue(registerIndex: number, value: any): void {
		if (!this.ws) {
			return;
		}

		const msg = {
			jsonrpc: '2.0',
			id: this.generateMessageId(true),
			method: 'setValues',
			params: {
				installationId: this.installationId,
				UUID: this.clientId,
				listenWithValuesChanged: true,
				fields: [{ registerIndex: registerIndex, displayValue: String(value) }],
			},
		};
		this.ws.send(JSON.stringify(msg));
	}

	private generateMessageId(longFormat: boolean = false): number {
		const min = longFormat ? MSG_ID_LONG_MIN : MSG_ID_MIN;
		const max = longFormat ? MSG_ID_LONG_MAX : MSG_ID_MAX;

		if (this.usedMessageIds.size > 1000) {
			this.usedMessageIds.clear();
		}

		let id: number;
		let attempts = 0;
		do {
			id = Math.floor(Math.random() * (max - min + 1)) + min;
			attempts++;
		} while (this.usedMessageIds.has(id) && attempts < 100);

		this.usedMessageIds.add(id);
		return id;
	}
}
