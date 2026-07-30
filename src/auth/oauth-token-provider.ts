import type { TokenProvider } from './token-provider.js'
import { OAuthClient, type OAuthTokens } from './oauth-client.js'

export class OAuthTokenProvider implements TokenProvider {
	private accessToken?: string
	private refreshToken?: string
	private expiresAt = 0

	public constructor(
		private readonly oauthclient: OAuthClient,
		tokens?: OAuthTokens,
	) {
		this.accessToken = tokens?.accessToken
		this.refreshToken = tokens?.refreshToken
		this.expiresAt = tokens?.expiresAt ?? 0
	}

	public async getAccessToken(): Promise<string> {
		if (!this.accessToken || !this.refreshToken) {
			throw Error('NO ACCESS TOKEN')
		}

		if (this.expiresAt <= Date.now()) {
			const tokens = await this.oauthclient.refreshAccessToken(this.refreshToken)

			this.accessToken = tokens.accessToken
			this.refreshToken = tokens.refreshToken
			this.expiresAt = tokens.expiresAt
		}
		return this.accessToken
	}
}
