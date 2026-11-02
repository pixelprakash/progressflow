import Constants from 'expo-constants';
import type { HealthResponse } from '@progressflow/shared';

const baseUrl =
  (Constants.expoConfig?.extra?.apiBaseUrl as string | undefined) ?? 'http://localhost:4000';

export class ApiClient {
  constructor(private readonly url = baseUrl) {}

  async health(signal?: AbortSignal): Promise<HealthResponse> {
    const res = await fetch(`${this.url}/healthz`, { signal });
    if (!res.ok) throw new Error(`health ${res.status}`);
    return (await res.json()) as HealthResponse;
  }
}

export const api = new ApiClient();
