export const DOMAIN = 'mystiebel';
export const WS_URL = 'wss://serviceapi.mystiebel.com/ws/v1';

// API Configuration
export const BASE_URL = 'https://auth.mystiebel.com';
export const SERVICE_URL = 'https://serviceapi.mystiebel.com';

// App Configuration
export const APP_NAME = 'MyStiebelApp';
export const APP_VERSION_ANDROID = 'Android_2.3.0';
export const USER_AGENT = `${APP_NAME}/2.3.0 Dalvik/2.1.0`;

// Timing Constants
export const WEBSOCKET_HEARTBEAT = 30; // seconds
export const WEBSOCKET_RECONNECT_INITIAL = 5; // seconds
export const WEBSOCKET_RECONNECT_MAX = 300; // 5 minutes
export const TOKEN_REFRESH_MARGIN = 300; // Refresh token 5 minutes before expiry
export const API_RATE_LIMIT_DELAY = 1; // Minimum seconds between API calls

// Message ID Range
export const MSG_ID_MIN = 1_000_000;
export const MSG_ID_MAX = 9_999_999;
export const MSG_ID_LONG_MIN = 1_000_000_000;
export const MSG_ID_LONG_MAX = 9_999_999_999;

// Sensor Definitions
export const SENSOR_DEFINITIONS: Record<
	number,
	{
		id: string;
		name: string;
		unit?: string;
		role: string;
		type: ioBroker.CommonType;
		write: boolean;
	}
> = {
	15: {
		id: 'dome_temperature',
		name: 'Dome Temperature',
		unit: '°C',
		role: 'value.temperature',
		type: 'number',
		write: false,
	},
	2378: {
		id: 'current_target_temperature',
		name: 'Current Target Temperature',
		unit: '°C',
		role: 'value.temperature',
		type: 'number',
		write: false,
	},
	2395: {
		id: 'mixed_water_volume',
		name: 'Mixed Water Volume',
		unit: 'l',
		role: 'value',
		type: 'number',
		write: false,
	},
	2758: { id: 'operating_mode', name: 'Operating Mode', role: 'text', type: 'string', write: false },
	2388: { id: 'sg_ready_state', name: 'SG-Ready State', role: 'value', type: 'number', write: false },
	1111: { id: 'compressor', name: 'Compressor', role: 'indicator.state', type: 'boolean', write: false },
	1116: { id: 'heating_element', name: 'Heating Element', role: 'indicator.state', type: 'boolean', write: false },
	1130: { id: 'defrosting', name: 'Defrosting', role: 'indicator.state', type: 'boolean', write: false },
};

// Control Definitions
export const CONTROL_DEFINITIONS: Record<
	number,
	{
		id: string;
		name: string;
		unit?: string;
		role: string;
		type: ioBroker.CommonType;
		write?: boolean;
	}
> = {
	13: {
		id: 'setpoint_temperature_comfort',
		name: 'Setpoint Temperature Comfort',
		unit: '°C',
		role: 'level.temperature',
		type: 'number',
		write: true,
	},
	14: {
		id: 'setpoint_temperature_eco',
		name: 'Setpoint Temperature Eco',
		unit: '°C',
		role: 'level.temperature',
		type: 'number',
		write: true,
	},
	2466: { id: 'eco_heating_mode', name: 'Eco heating mode', role: 'switch', type: 'boolean', write: true },
	2382: { id: 'boost_request', name: 'Boost Request', role: 'switch', type: 'boolean', write: true },
	2487: {
		id: 'hot_water_plus_requested',
		name: 'Hot Water Plus Requested',
		role: 'switch',
		type: 'boolean',
		write: true,
	},
};

// List of essential read-only sensors.
export const ESSENTIAL_SENSORS = Object.keys(SENSOR_DEFINITIONS).map(Number);

// List of essential control entities.
export const ESSENTIAL_CONTROLS = Object.keys(CONTROL_DEFINITIONS).map(Number);
