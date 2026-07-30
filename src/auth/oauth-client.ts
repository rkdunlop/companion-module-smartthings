export interface OAuthTokens {
	accessToken: string
	refreshToken: string
	expiresAt: number
}

export class OAuthClient {
	public buildAuthorizationUrl(): string {}

	public async exchangeAuthorizationCode(_code: string): Promise<OAuthTokens> {
		throw new Error('Not Implemented')
	}

	public async refreshAccessToken(_refreshToken: string): Promise<OAuthTokens> {
		throw new Error('Not Implemented')
	}
}
