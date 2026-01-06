/*
 * Created with @iobroker/create-adapter v3.1.2
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';
import { MyStiebelAuth } from './lib/auth';
import { CONTROL_DEFINITIONS, ESSENTIAL_CONTROLS, ESSENTIAL_SENSORS, SENSOR_DEFINITIONS } from './lib/const';
import { MyStiebelWS } from './lib/websocket';

// Load your modules here, e.g.:
// import * as fs from 'fs';

class Mystiebel extends utils.Adapter {
	private auth: MyStiebelAuth | undefined;
	private ws: MyStiebelWS | undefined;
	private activeInstallationId: string | undefined;

	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({
			...options,
			name: 'mystiebel',
		});
		this.on('ready', this.onReady.bind(this));
		this.on('stateChange', this.onStateChange.bind(this));
		// this.on('objectChange', this.onObjectChange.bind(this));
		// this.on('message', this.onMessage.bind(this));
		this.on('unload', this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	private async onReady(): Promise<void> {
		// Reset the connection indicator during startup
		await this.setState('info.connection', false, true);

		this.log.debug(`config username: ${this.config.username}`);
		this.log.debug(`config clientId: ${this.config.clientId}`);

		if (!this.config.username || !this.config.password || !this.config.clientId) {
			this.log.error('Please set username, password and clientId in the adapter configuration!');
			return;
		}

		this.auth = new MyStiebelAuth(this.log, this.config.username, this.config.password, this.config.clientId);

		try {
			// This will authenticate
			await this.auth.authenticate();
			await this.setState('info.connection', true, true);

			const installations = await this.auth.getInstallations();
			this.log.info(`Installations: ${JSON.stringify(installations)}`);

			if (installations && installations.items && installations.items.length > 0) {
				for (const installation of installations.items) {
					await this.createInstallationObjects(installation);
				}

				const installationId = installations.items[0].id;
				this.activeInstallationId = String(installationId);
				this.log.info(`Using installation ID: ${installationId}`);

				const fieldsToMonitor = [...ESSENTIAL_SENSORS, ...ESSENTIAL_CONTROLS];
				this.ws = new MyStiebelWS(
					this.auth,
					String(installationId),
					this.config.clientId,
					fieldsToMonitor,
					this.log,
					this.handleDataUpdate.bind(this),
				);
				this.ws.start();
			} else {
				this.log.warn('No installations found!');
			}
		} catch (error) {
			this.log.error(`Authentication failed: ${(error as Error).message}`);
			await this.setState('info.connection', false, true);
		}

		// Subscribe to all control states
		this.subscribeStates('*.controls.*');
	}

	/**
	 * Creates the ioBroker objects for an installation.
	 *
	 * @param installation - The installation data object
	 */
	private async createInstallationObjects(installation: any): Promise<void> {
		const id = String(installation.id);
		const name = installation.name || `Installation ${id}`;

		// Create device object
		await this.setObjectNotExistsAsync(id, {
			type: 'device',
			common: {
				name: name,
			},
			native: {},
		});

		// Create info channel
		await this.setObjectNotExistsAsync(`${id}.info`, {
			type: 'channel',
			common: {
				name: 'Information',
			},
			native: {},
		});

		// Create info states
		const infoStates = {
			name: { name: 'Name', type: 'string', val: installation.name },
			owner: {
				name: 'Owner',
				type: 'string',
				val: `${installation.owner?.firstName} ${installation.owner?.lastName}`.trim(),
			},
			model: { name: 'Model', type: 'string', val: installation.profile?.name },
			serialNumber: { name: 'Serial Number', type: 'string', val: installation.pid },
			macAddress: { name: 'MAC Address', type: 'string', val: installation.macAddress },
			firmwareVersion: {
				name: 'Firmware Version',
				type: 'string',
				val: installation.firmware?.firmwareVersion,
			},
			isOnline: { name: 'Is Online', type: 'boolean', val: installation.isOnline },
		};

		for (const [key, def] of Object.entries(infoStates)) {
			await this.setObjectNotExistsAsync(`${id}.info.${key}`, {
				type: 'state',
				common: {
					name: def.name,
					type: def.type as ioBroker.CommonType,
					role: 'info',
					read: true,
					write: false,
				},
				native: {},
			});
			await this.setState(`${id}.info.${key}`, { val: def.val, ack: true });
		}

		// Create sensor/control objects if profile matches (e.g., WWK with ID 34)
		// For now, we assume all supported devices have these essential fields
		// In a real scenario, we might want to check installation.profile.id
		if (installation.profile?.id === 34) {
			await this.createEssentialObjects(id);
		}
	}

	/**
	 * Creates the essential sensor and control objects for a device.
	 *
	 * @param deviceId - The device ID (installation ID)
	 */
	private async createEssentialObjects(deviceId: string): Promise<void> {
		// Create sensors channel
		await this.setObjectNotExistsAsync(`${deviceId}.sensors`, {
			type: 'channel',
			common: {
				name: 'Sensors',
			},
			native: {},
		});

		// Create controls channel
		await this.setObjectNotExistsAsync(`${deviceId}.controls`, {
			type: 'channel',
			common: {
				name: 'Controls',
			},
			native: {},
		});

		// We will create the actual states when we receive data, or we can pre-create them here
		// For now, let's pre-create placeholders based on IDs so we can see them
		for (const sensorId of ESSENTIAL_SENSORS) {
			const def = SENSOR_DEFINITIONS[sensorId];
			await this.setObjectNotExistsAsync(`${deviceId}.sensors.${def.id}`, {
				type: 'state',
				common: {
					name: def.name,
					type: def.type || 'number',
					role: def.role || 'value',
					unit: def.unit,
					read: true,
					write: false,
				},
				native: {
					registerIndex: sensorId,
				},
			});
		}

		for (const controlId of ESSENTIAL_CONTROLS) {
			const def = CONTROL_DEFINITIONS[controlId];
			await this.setObjectNotExistsAsync(`${deviceId}.controls.${def.id}`, {
				type: 'state',
				common: {
					name: def.name,
					type: def.type || 'number',
					role: def.role || 'value',
					unit: def.unit,
					read: true,
					write: true,
				},
				native: {
					registerIndex: controlId,
				},
			});
		}
	}

	/**
	 * Handles data updates from the WebSocket.
	 *
	 * @param data - Array of data objects containing registerIndex and value
	 */
	private async handleDataUpdate(data: any[]): Promise<void> {
		if (!data || !Array.isArray(data) || !this.activeInstallationId) {
			return;
		}

		for (const item of data) {
			const registerIndex = item.registerIndex;
			// The API might return 'value' or 'displayValue'
			let value = item.value !== undefined ? item.value : item.displayValue;

			if (value === undefined) {
				continue;
			}

			if (ESSENTIAL_SENSORS.includes(registerIndex)) {
				const def = SENSOR_DEFINITIONS[registerIndex];
				if (def) {
					if (def.type === 'number') {
						value = parseFloat(value);
					} else if (def.type === 'boolean') {
						value = value === '1' || value === 1 || value === 'true' || value === true;
					}
					await this.setState(`${this.activeInstallationId}.sensors.${def.id}`, {
						val: value,
						ack: true,
					});
				}
			} else if (ESSENTIAL_CONTROLS.includes(registerIndex)) {
				const def = CONTROL_DEFINITIONS[registerIndex];
				if (def) {
					if (def.type === 'number') {
						value = parseFloat(value);
					} else if (def.type === 'boolean') {
						value = value === '1' || value === 1 || value === 'true' || value === true;
					}
					await this.setState(`${this.activeInstallationId}.controls.${def.id}`, {
						val: value,
						ack: true,
					});
				}
			}
		}
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 *
	 * @param callback - Callback function
	 */
	private onUnload(callback: () => void): void {
		try {
			if (this.ws) {
				this.ws.stop();
			}
			// Here you must clear all timeouts or intervals that may still be active
			// clearTimeout(timeout1);
			// clearTimeout(timeout2);
			// ...
			// clearInterval(interval1);

			callback();
		} catch (error) {
			this.log.error(`Error during unloading: ${(error as Error).message}`);
			callback();
		}
	}

	// If you need to react to object changes, uncomment the following block and the corresponding line in the constructor.
	// You also need to subscribe to the objects with `this.subscribeObjects`, similar to `this.subscribeStates`.
	// /**
	//  * Is called if a subscribed object changes
	//  */
	// private onObjectChange(id: string, obj: ioBroker.Object | null | undefined): void {
	// 	if (obj) {
	// 		// The object was changed
	// 		this.log.info(`object ${id} changed: ${JSON.stringify(obj)}`);
	// 	} else {
	// 		// The object was deleted
	// 		this.log.info(`object ${id} deleted`);
	// 	}
	// }

	/**
	 * Is called if a subscribed state changes
	 *
	 * @param id - State ID
	 * @param state - State object
	 */
	private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
		if (!state) {
			// The object was deleted or the state value has expired
			this.log.info(`state ${id} deleted`);
			return;
		}

		if (state.ack !== false) {
			return;
		}

		this.log.info(`User command received for ${id}: ${state.val}`);

		if (!id.includes('.controls.') || !this.ws || !this.activeInstallationId) {
			return;
		}

		const parts = id.split('.');
		const controlName = parts[parts.length - 1];

		const registerIndex = this.extractRegisterIndex(controlName);
		if (registerIndex === undefined) {
			this.log.warn(`Could not find register index for control ${controlName}`);
			return;
		}

		let value = state.val;

		const def = CONTROL_DEFINITIONS[registerIndex];
		if (def && def.type === 'boolean') {
			// Convert boolean to string/number as expected by API
			// Based on Python code, it seems to send strings
			value = value ? '1' : '0';
		}

		this.ws.setValue(registerIndex, value);
	}

	private extractRegisterIndex(controlName: string): number | undefined {
		for (const [key, def] of Object.entries(CONTROL_DEFINITIONS)) {
			if (def.id === controlName) {
				return Number(key);
			}
		}
		return undefined;
	}

	// If you need to accept messages in your adapter, uncomment the following block and the corresponding line in the constructor.
	// /**
	//  * Some message was sent to this instance over message box. Used by email, pushover, text2speech, ...
	//  * Using this method requires "common.messagebox" property to be set to true in io-package.json
	//  */
	//
	// private onMessage(obj: ioBroker.Message): void {
	// 	if (typeof obj === 'object' && obj.message) {
	// 		if (obj.command === 'send') {
	// 			// e.g. send email or pushover or whatever
	// 			this.log.info('send command');
	// 			// Send response in callback if required
	// 			if (obj.callback) this.sendTo(obj.from, obj.command, 'Message received', obj.callback);
	// 		}
	// 	}
	// }
}
if (require.main !== module) {
	// Export the constructor in compact mode
	module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new Mystiebel(options);
} else {
	// otherwise start the instance directly
	(() => new Mystiebel())();
}
