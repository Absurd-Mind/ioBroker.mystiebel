import type { AxiosInstance } from 'axios';
import axios from 'axios';
import { APP_NAME, APP_VERSION_ANDROID, BASE_URL, SERVICE_URL, TOKEN_REFRESH_MARGIN, USER_AGENT } from './const';

/**
 * Authentication handler for MyStiebel service. Manages login, token storage, and token refresh.
 */
export class MyStiebelAuth {
	private log: ioBroker.Logger;
	private username: string;
	private password: string;
	private clientId: string;
	private token: string | null = null;
	private tokenExpiry: Date | null = null;
	private axiosInstance: AxiosInstance;

	/**
	 * @param log - Logger instance
	 * @param username - Username for authentication
	 * @param password - Password for authentication
	 * @param clientId - Client ID for authentication
	 * @param cachedToken - Optional cached token
	 * @param cachedTokenExpiry - Optional cached token expiry date as ISO string
	 */
	constructor(
		log: ioBroker.Logger,
		username: string,
		password: string,
		clientId: string,
		cachedToken?: string,
		cachedTokenExpiry?: string,
	) {
		this.log = log;
		this.username = username;
		this.password = password;
		this.clientId = clientId;
		this.axiosInstance = axios.create();
		if (cachedToken && cachedTokenExpiry) {
			this.token = cachedToken;
			this.tokenExpiry = new Date(cachedTokenExpiry);
		}
	}

	/**
	 * Authenticates with the MyStiebel service and retrieves an access token.
	 */
	public async authenticate(): Promise<void> {
		const headers = {
			'X-SC-ClientApp-Name': APP_NAME,
			'X-SC-ClientApp-Version': APP_VERSION_ANDROID,
			'User-Agent': USER_AGENT,
			'Content-Type': 'application/json; charset=utf-8',
			'Accept-Encoding': 'gzip',
		};

		const payload = {
			userName: this.username,
			password: this.password,
			clientId: this.clientId,
			rememberMe: true,
		};

		try {
			const response = await this.axiosInstance.post(`${BASE_URL}/api/v1/Jwt/login`, payload, { headers });
			const data = response.data;
			this.token = data.token;

			if (!this.token) {
				throw new Error('Authentication succeeded but no token was received ');
			}

			this.tokenExpiry = this.parseTokenExpiry(this.token);
			if (!this.tokenExpiry) {
				throw new Error(`Authentication succeeded but token expiry could not be determined`);
			}
			this.log.debug('Authentication successful');
		} catch (error) {
			throw new Error(`Authentication failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Retrieves the list of installations associated with the authenticated user.
	 */
	public async getInstallations(): Promise<any> {
		await this.ensureValidToken();

		const headers = {
			Authorization: `Bearer ${this.token}`,
			'X-SC-ClientApp-Name': APP_NAME,
			'X-SC-ClientApp-Version': APP_VERSION_ANDROID,
			'User-Agent': USER_AGENT,
			'Content-Type': 'application/json; charset=utf-8',
			'Accept-Encoding': 'gzip',
		};

		const payload = { includeWithPendingUserAccesses: true };

		try {
			const response = await this.axiosInstance.post(`${SERVICE_URL}/api/v1/InstallationsInfo/own`, payload, {
				headers,
			});
			return response.data;
		} catch (error) {
			throw new Error(`Failed to get installations: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Ensures that the token is valid, refreshing it if necessary.
	 */
	public async ensureValidToken(): Promise<void> {
		if (!this.token || !this.tokenExpiry) {
			this.log.debug('No token or token expiry found, authenticating...');
			await this.authenticate();
			return;
		}

		const timeUntilExpiry = (this.tokenExpiry.getTime() - Date.now()) / 1000;
		if (timeUntilExpiry <= TOKEN_REFRESH_MARGIN) {
			this.log.debug('Token is expiring soon, re-authenticating...');
			await this.authenticate();
		}
		this.log.debug('Token is valid');
	}

	/**
	 * Returns the current token.
	 */
	public getToken(): string | null {
		return this.token;
	}

	/**
	 * Returns the token expiry date.
	 */
	public getTokenExpiry(): Date | null {
		return this.tokenExpiry;
	}

	/**
	 * Parses the JWT token to extract the expiry date.
	 *
	 * @param token - The JWT token
	 */
	private parseTokenExpiry(token: string): Date | null {
		try {
			const payloadBase64 = token.split('.')[1];
			if (!payloadBase64) {
				return null;
			}

			const payloadJson = Buffer.from(payloadBase64, 'base64').toString();
			const payload = JSON.parse(payloadJson);
			if (!payload.exp) {
				return null;
			}

			return new Date(payload.exp * 1000);
		} catch {
			return null;
		}
	}
}
