import type { TokenProvider } from './token-provider.js'

export class OAuthClient {
	public constructor(private readonly tokenProvider: TokenProvider) {}

	private buildAuthorizationUrl() {}

	private exchangeAuthorizaitonCode() {
		throw new Error('Not Implemented')
	}

	private refreshAccessToken() {
		throw new Error('Not Implemented')
	}
}
