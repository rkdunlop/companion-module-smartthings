import type { TokenProvider } from './token-provider.js'
import { OAuthClient, type OAuthTokens } from './oauth-client.js'

export type TokenUpdateHandler = (tokens: OAuthTokens) => Promise<void> | void

export class OAuthTokenProvider implements TokenProvider {
	private tokens?: OAuthTokens

	public constructor(
		private readonly oauthclient: OAuthClient,
		tokens?: OAuthTokens,
		private readonly onTokensUpdated?: TokenUpdateHandler,
	) {
		this.tokens = tokens ?? {
			accessToken: '',
			refreshToken: '',
			expiresAt: 0,
			installedAppId: '',
			grantedScopes: [],
		}
	}

	public async getAccessToken(): Promise<string> {
		if (!this.tokens) {
			throw Error('NO ACCESS TOKEN')
		}

		if (this.tokens.expiresAt <= Date.now()) {
			this.tokens = await this.oauthclient.refreshAccessToken(this.tokens.refreshToken)

			await this.onTokensUpdated?.(this.tokens)
		}
		return this.tokens.accessToken
	}

	public setTokens(tokens: OAuthTokens): void {
		this.tokens = tokens
	}
}
