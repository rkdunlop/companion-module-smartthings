import type { TokenProvider } from './token-provider.js'

export class PatTokenProvider implements TokenProvider {
	public constructor(private readonly token: string) {}

	public async getAccessToken(): Promise<string> {
		return this.token
	}
}
