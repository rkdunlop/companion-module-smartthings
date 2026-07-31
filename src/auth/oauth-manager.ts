import { randomBytes, timingSafeEqual } from 'node:crypto'

import { OAuthClient } from './oauth-client.js'
import { OAuthTokenProvider } from './oauth-token-provider.js'

const AUTHORIZATION_TIMEOUT_MS = 10 * 60 * 1000

export interface PendingOAuthAuthorization {
	authorizationUrl: URL
	state: string
	expiresAt: number
}

export class OAuthManager {
	public constructor(
		private readonly oauthClient: OAuthClient,
		private readonly tokenProvider: OAuthTokenProvider,
	) {}

	public beginAuthorization(): PendingOAuthAuthorization {
		const state = randomBytes(32).toString('base64url')
		const expiresAt = Date.now() + AUTHORIZATION_TIMEOUT_MS

		return { authorizationUrl: this.oauthClient.buildAuthorizationUrl(state), state, expiresAt }
	}

	public async completeAuthorization(
		code: string,
		returnedState: string,
		expectedState: string,
		expiresAt: number,
	): Promise<void> {
		if (Date.now() >= expiresAt) {
			throw new Error('The SmartThings authorization request has expired.')
		}
		this.validateState(returnedState, expectedState)

		const tokens = await this.oauthClient.exchangeAuthorizationCode(code)

		await this.tokenProvider.setTokens(tokens)
	}

	private validateState(returnedState: string, expectedState: string): void {
		if (!expectedState) {
			throw new Error('No SmartThings authorization request is pending.')
		}

		if (!this.statesMatch(expectedState, returnedState)) {
			throw new Error('The SmartThings OAuth callback state did not match.')
		}
	}

	private statesMatch(expected: string, actual: string): boolean {
		const expectedBuffer = Buffer.from(expected)
		const actualBuffer = Buffer.from(actual)

		if (expectedBuffer.length !== actualBuffer.length) {
			return false
		}

		return timingSafeEqual(expectedBuffer, actualBuffer)
	}
}
