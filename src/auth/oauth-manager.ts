import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import { OAuthClient } from './oauth-client.js'
import { OAuthTokenProvider } from './oauth-token-provider.js'

const AUTHORIZATION_TIMEOUT_MS = 10 * 60 * 1000

export interface PendingOAuthAuthorization {
	authorizationUrl: URL
}

interface OAuthStatePayload {
	nonce: string
	expiresAt: number
}

export class OAuthManager {
	public constructor(
		private readonly oauthClient: OAuthClient,
		private readonly tokenProvider: OAuthTokenProvider,
		private readonly stateSigningSecret: string,
	) {}

	public beginAuthorization(): PendingOAuthAuthorization {
		const state = this.createSignedState()

		return { authorizationUrl: this.oauthClient.buildAuthorizationUrl(state) }
	}

	public async completeAuthorization(code: string, returnedState: string): Promise<void> {
		this.verifySignedState(returnedState)

		const tokens = await this.oauthClient.exchangeAuthorizationCode(code)

		await this.tokenProvider.setTokens(tokens)
	}

	private createSignedState(): string {
		const payload: OAuthStatePayload = {
			nonce: randomBytes(32).toString('base64url'),
			expiresAt: Date.now() + AUTHORIZATION_TIMEOUT_MS,
		}

		const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')

		const signature = createHmac('sha256', this.stateSigningSecret).update(encodedPayload).digest('base64url')

		return `${encodedPayload}.${signature}`
	}

	private verifySignedState(state: string): OAuthStatePayload {
		const parts = state.split('.')
		if (parts.length !== 2) {
			throw new Error('The SmartThings Oauth callback state is invalid')
		}

		const [encodedPayload, returnedSignature] = parts
		const expectedSignature = createHmac('sha256', this.stateSigningSecret).update(encodedPayload).digest('base64url')

		const expectedBuffer = Buffer.from(expectedSignature)
		const returnedBuffer = Buffer.from(returnedSignature)

		if (expectedBuffer.length !== returnedBuffer.length || !timingSafeEqual(expectedBuffer, returnedBuffer)) {
			throw new Error('The SmartThings OAuth callback state signature is invalid.')
		}

		let parsed: unknown

		try {
			const json = Buffer.from(encodedPayload, 'base64url').toString('utf8')

			parsed = JSON.parse(json)
		} catch {
			throw new Error('The SmartThings OAuth callback state is invalid.')
		}

		if (
			typeof parsed !== 'object' ||
			parsed === null ||
			!('nonce' in parsed) ||
			!('expiresAt' in parsed) ||
			typeof parsed.nonce !== 'string' ||
			typeof parsed.expiresAt !== 'number'
		) {
			throw new Error('The SmartThings OAuth callback state is invalid.')
		}

		if (Date.now() >= parsed.expiresAt) {
			throw new Error('The SmartThings authorization request has expired. ')
		}

		return parsed as OAuthStatePayload
	}
}
