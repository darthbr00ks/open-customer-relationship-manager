/** Names shared by the sign-in routes and the route guard. */

/** Holds the in-flight sign-in (state, PKCE verifier, nonce) for one callback. */
export const AUTH_FLOW_COOKIE = 'open_rm_auth_flow';

/** Registered with the identity provider, so it is a constant rather than a guess. */
export const AUTH_CALLBACK_PATH = '/api/auth/callback';

/** Where an unauthenticated request is sent, and where sign-in starts. */
export const SIGN_IN_PATH = '/sign-in';
