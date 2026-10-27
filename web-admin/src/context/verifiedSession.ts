import type { SessionIdentity } from './useAuth';

export interface VerifiedSession {
  subject: string | null;
  identity?: SessionIdentity;
}

interface SessionQuery {
  data?: SessionIdentity;
  error?: string;
  loading: boolean;
}

/** Retain only backend-verified identity while revalidating the same subject. */
export function updateVerifiedSession(previous: VerifiedSession, subject: string | null, query: SessionQuery): VerifiedSession {
  const sameSubject = previous.subject === subject;
  const rejected = !!query.error || (!!query.data && query.data.subject !== subject);
  const identity = !subject || rejected ? undefined
    : query.loading ? (sameSubject ? previous.identity : undefined) : query.data;
  return sameSubject && previous.identity === identity ? previous : { subject, identity };
}
