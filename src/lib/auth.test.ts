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
