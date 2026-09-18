import type { AxiosInstance } from 'axios';
import axios from 'axios';
import {
	APP_NAME,
	APP_VERSION_ANDROID,
	BASE_URL,
	SERVICE_URL,
	TOKEN_REFRESH_MARGIN,
	TOKEN_REFRESH_RATIO,
	USER_AGENT,
} from './const';

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
	private tokenRefreshAt: Date | null = null;
	private axiosInstance: AxiosInstance;

	/**
	 * @param log - Logger instance
	 * @param username - Username for authentication
	 * @param password - Password for authentication
	 * @param clientId - Client ID for authentication
	 */
	constructor(log: ioBroker.Logger, username: string, password: string, clientId: string) {
		this.log = log;
		this.username = username;
		this.password = password;
		this.clientId = clientId;
		this.axiosInstance = axios.create();
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

			const claims = this.parseTokenClaims(this.token);
			if (!claims) {
				throw new Error(`Authentication succeeded but token expiry could not be determined`);
			}

			this.tokenExpiry = claims.expiry;
			this.tokenRefreshAt = this.calculateRefreshTime(claims.issuedAt, claims.expiry);
			this.log.debug(
				`Authentication successful, token expires at ${this.tokenExpiry.toISOString()}, refresh due at ${this.tokenRefreshAt.toISOString()}`,
			);
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
		if (!this.token || !this.tokenRefreshAt) {
			this.log.debug('No token or token expiry found, authenticating...');
			await this.authenticate();
			return;
		}

		if (Date.now() >= this.tokenRefreshAt.getTime()) {
			this.log.debug('Token reached its refresh time, re-authenticating...');
			await this.authenticate();
			return;
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
	 * Returns the point in time at which the current token should be renewed.
	 */
	public getTokenRefreshAt(): Date | null {
		return this.tokenRefreshAt;
	}

	/**
	 * Determines when a token has to be renewed: after 80% of its lifetime, but never later than
	 * TOKEN_REFRESH_MARGIN seconds before the actual expiry.
	 *
	 * @param issuedAt - Time the token was issued
	 * @param expiry - Time the token expires
	 */
	private calculateRefreshTime(issuedAt: Date, expiry: Date): Date {
		const lifetime = expiry.getTime() - issuedAt.getTime();
		const latestRefresh = expiry.getTime() - TOKEN_REFRESH_MARGIN * 1000;
		const refreshAt = issuedAt.getTime() + lifetime * TOKEN_REFRESH_RATIO;

		return new Date(Math.min(refreshAt, latestRefresh));
	}

	/**
	 * Parses the JWT token to extract the issue and expiry dates.
	 *
	 * @param token - The JWT token
	 */
	private parseTokenClaims(token: string): { issuedAt: Date; expiry: Date } | null {
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

			// Tokens without an `iat` claim are treated as if they had just been issued
			const issuedAt = payload.iat ? new Date(payload.iat * 1000) : new Date();
			return { issuedAt, expiry: new Date(payload.exp * 1000) };
		} catch {
			return null;
		}
	}
}
