import { randomBytes, timingSafeEqual } from 'crypto'

import { OAuthClient } from './oauth-client.js'
import { OAuthTokenProvider } from './oauth-token-provider.js'

const AUTHORIZATION_TIMEOUT_MS = 10 * 60 * 1000

interface PendingAuthorization {
	state: string
	expiresAt: number
}

export class OAuthManager {
	private pendingAuthorization?: PendingAuthorization

	public constructor(
		private readonly oauthClient: OAuthClient,
		private readonly tokenProvider: OAuthTokenProvider,
	) {}

	public async beginAuthorization(): Promise<URL> {
		const state = randomBytes(32).toString('base64url')

		this.pendingAuthorization = {
			state,
			expiresAt: Date.now() + AUTHORIZATION_TIMEOUT_MS,
		}
		return this.oauthClient.buildAuthorizationUrl(state)
	}

	public async completeAuthorization(code: string, returnedState: string): Promise<void> {
		this.validateState(returnedState)

		this.pendingAuthorization = undefined
		const tokens = await this.oauthClient.exchangeAuthorizationCode(code)

		await this.tokenProvider.setTokens(tokens)
	}

	public cancelAuthorization(): void {
		this.pendingAuthorization = undefined
	}

	public hasPendingAuthorization(): boolean {
		return this.pendingAuthorization !== undefined && Date.now() < this.pendingAuthorization.expiresAt
	}

	private validateState(returnedState: string): void {
		const pending = this.pendingAuthorization

		if (!pending) {
			throw new Error('No SmartThings authorization request is pending.')
		}

		if (Date.now() >= pending.expiresAt) {
			this.pendingAuthorization = undefined

			throw new Error('The SmartThings authorization request has expired.')
		}

		if (!this.statesMatch(pending.state, returnedState)) {
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
