import MockAdapter from 'axios-mock-adapter';
import { expect } from 'chai';
import { Mock } from 'ts-mockery';
import { MyStiebelAuth } from './auth';

describe('MyStiebelAuth API Error Handling', () => {
	let auth: MyStiebelAuth;
	let mockAxios: MockAdapter;
	let loggerMock: ioBroker.Logger;

	beforeEach(() => {
		// Mock Logger
		loggerMock = Mock.from<ioBroker.Logger>({
			debug: () => { },
			error: () => { },
			info: () => { },
			warn: () => { },
		});

		// Setup Auth instance with mocked axios via internal property access or by intercepting axios.create
		// Since axios.create is called in constructor, we need to mock axios BEFORE instantiation if we can't access instance.
		// However, axios-mock-adapter works on an axios instance.
		// Let's create the instance and then hijack the private axiosInstance if possible or expose it.
		// Or better: The class uses `this.axiosInstance = axios.create()`.
		// If we want to mock it strictly, we might need to rely on the fact that axios-mock-adapter can mock the default instance if used,
		// but since `axios.create()` returns a NEW instance, we need to attach the mock to THAT instance.

		// Workaround: We will use a small "spy" or simply trust that `axios-mock-adapter` logic
		// is tricky with `axios.create()`.
		// A common pattern is to allow passing the axios instance to the constructor or mocking the module.
		// But let's try to access the private property for testing purposes using (auth as any).
		auth = new MyStiebelAuth(loggerMock, 'testuser', 'testpass', 'testclientid');
		mockAxios = new MockAdapter((auth as any).axiosInstance);
	});

	afterEach(() => {
		mockAxios.restore();
	});

	it('should handle 401 Unauthorized during login', async () => {
		mockAxios.onPost().reply(401, { message: 'Unauthorized' });

		try {
			await auth.authenticate();
			expect.fail('Should have thrown an error');
		} catch (error) {
			expect((error as Error).message).to.contain('Authentication failed');
			expect((error as Error).message).to.contain('401');
		}
	});

	it('should handle 403 Forbidden', async () => {
		mockAxios.onPost().reply(403, { message: 'Forbidden' });

		try {
			await auth.authenticate();
			expect.fail('Should have thrown an error');
		} catch (error) {
			expect((error as Error).message).to.contain('Authentication failed');
			expect((error as Error).message).to.contain('403');
		}
	});

	it('should handle 500 Server Error', async () => {
		mockAxios.onPost().reply(500, { message: 'Internal Server Error' });

		try {
			await auth.authenticate();
			expect.fail('Should have thrown an error');
		} catch (error) {
			expect((error as Error).message).to.contain('Authentication failed');
			expect((error as Error).message).to.contain('500');
		}
	});

	it('should handle Network Error', async () => {
		mockAxios.onPost().networkError();

		try {
			await auth.authenticate();
			expect.fail('Should have thrown an error');
		} catch (error) {
			expect((error as Error).message).to.contain('Authentication failed');
			expect((error as Error).message).to.contain('Network Error');
		}
	});
});

describe('MyStiebelAuth Token Refresh', () => {
	let auth: MyStiebelAuth;
	let mockAxios: MockAdapter;

	/**
	 * Builds a JWT-like token with the given lifetime.
	 *
	 * @param issuedAt - Issue time in seconds since epoch
	 * @param expiresAt - Expiry time in seconds since epoch
	 */
	function createToken(issuedAt: number | undefined, expiresAt: number): string {
		const payload: Record<string, number> = { exp: expiresAt };
		if (issuedAt !== undefined) {
			payload.iat = issuedAt;
		}
		return `header.${Buffer.from(JSON.stringify(payload)).toString('base64')}.signature`;
	}

	beforeEach(() => {
		const loggerMock = Mock.from<ioBroker.Logger>({
			debug: () => { },
			error: () => { },
			info: () => { },
			warn: () => { },
		});
		auth = new MyStiebelAuth(loggerMock, 'testuser', 'testpass', 'testclientid');
		mockAxios = new MockAdapter((auth as any).axiosInstance);
	});

	afterEach(() => {
		mockAxios.restore();
	});

	it('should schedule the refresh after 80% of the token lifetime', async () => {
		const issuedAt = Math.floor(Date.now() / 1000);
		const expiresAt = issuedAt + 15 * 3600;
		mockAxios.onPost().reply(200, { token: createToken(issuedAt, expiresAt) });

		await auth.authenticate();

		const refreshAt = auth.getTokenRefreshAt();
		expect(refreshAt).to.not.be.null;
		expect(refreshAt!.getTime()).to.equal((issuedAt + 12 * 3600) * 1000);
		expect(auth.getTokenExpiry()!.getTime()).to.equal(expiresAt * 1000);
	});

	it('should never schedule the refresh closer than the safety margin to the expiry', async () => {
		const issuedAt = Math.floor(Date.now() / 1000);
		const expiresAt = issuedAt + 600; // 80% would be only 120s before expiry
		mockAxios.onPost().reply(200, { token: createToken(issuedAt, expiresAt) });

		await auth.authenticate();

		expect(auth.getTokenRefreshAt()!.getTime()).to.equal((expiresAt - 300) * 1000);
	});

	it('should fall back to the current time when the token has no iat claim', async () => {
		const expiresAt = Math.floor(Date.now() / 1000) + 15 * 3600;
		mockAxios.onPost().reply(200, { token: createToken(undefined, expiresAt) });

		await auth.authenticate();

		const expectedRefreshAt = Date.now() + 12 * 3600 * 1000;
		expect(auth.getTokenRefreshAt()!.getTime()).to.be.closeTo(expectedRefreshAt, 5000);
	});

	it('should not re-authenticate while the refresh time has not been reached', async () => {
		const issuedAt = Math.floor(Date.now() / 1000);
		mockAxios.onPost().reply(200, { token: createToken(issuedAt, issuedAt + 15 * 3600) });

		await auth.authenticate();
		const callsAfterLogin = mockAxios.history.post.length;

		await auth.ensureValidToken();

		expect(mockAxios.history.post.length).to.equal(callsAfterLogin);
	});

	it('should re-authenticate once the refresh time has passed', async () => {
		const issuedAt = Math.floor(Date.now() / 1000) - 13 * 3600;
		mockAxios.onPost().reply(200, { token: createToken(issuedAt, issuedAt + 15 * 3600) });

		await auth.authenticate();
		const callsAfterLogin = mockAxios.history.post.length;

		await auth.ensureValidToken();

		expect(mockAxios.history.post.length).to.equal(callsAfterLogin + 1);
	});
});
