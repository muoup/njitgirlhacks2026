export interface SessionUser {
  name: string;
  email: string;
}

export type SessionState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; user: SessionUser };

/** Sign-in actions reject with an Error whose message can be shown to the person as is. */
export interface AuthSource {
  useSession(): SessionState;
  signIn(email: string, password: string): Promise<void>;
  signUp(name: string, email: string, password: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  /** The ways to sign in besides email and password that the server has been set up for. */
  methods(): Promise<{ google: boolean }>;
  signOut(): Promise<void>;
}
