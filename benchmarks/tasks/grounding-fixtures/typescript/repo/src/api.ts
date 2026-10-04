import type { ClientOptions, User } from './types';

export interface Client {
  options: ClientOptions;
}

/** Create an API client bound to a base URL. */
export function createClient(options: ClientOptions): Client {
  return { options };
}

/** Fetch one user by id. */
export async function fetchUser(client: Client, id: string): Promise<User> {
  return { id, name: client.options.baseUrl };
}
