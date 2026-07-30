import type { TokenProvider } from './token-provider.js'

export class OAuthTokenProvider implements TokenProvider {
	private accessToken?: string
	private refreshToken?: string
	private expiresAt = 0

	public async getAccessToken(): Promise<string> {
		throw new Error('OAuth authentication has not been completed.')
	}
}
