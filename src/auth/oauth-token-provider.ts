import type { TokenProvider } from './token-provider.js'
import { OAuthClient, type OAuthTokens } from './oauth-client.js'

export type TokenUpdateHandler = (tokens: OAuthTokens) => Promise<void> | void

export class OAuthTokenProvider implements TokenProvider {
	public constructor(
		private readonly oauthclient: OAuthClient,
		private tokens?: OAuthTokens,
		private readonly onTokensUpdated?: TokenUpdateHandler,
	) {}

	public async getAccessToken(): Promise<string> {
		if (!this.tokens) {
			throw Error('SmartThings OAuth authorization has not been completed.')
		}

		if (this.tokens.expiresAt <= Date.now()) {
			const refreshedToken = await this.oauthclient.refreshAccessToken(this.tokens.refreshToken)
			await this.setTokens(refreshedToken)
		}
		return this.tokens.accessToken
	}

	public async setTokens(tokens: OAuthTokens): Promise<void> {
		this.tokens = tokens
		await this.onTokensUpdated?.(tokens)
	}

	public clearTokens(): void {
		this.tokens = undefined
	}

	public isAuthenticated(): boolean {
		return this.tokens !== undefined
	}
}
