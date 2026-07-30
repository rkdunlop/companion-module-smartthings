import type { TokenProvider } from './token-provider.js'

export class PatTokenProvider implements TokenProvider {
	public async getAccessToken(): Promise<string> {
		return 'undefined'
	}
}
