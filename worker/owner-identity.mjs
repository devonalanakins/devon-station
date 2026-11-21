/**
 * Keep the private owner subject stable during an explicitly configured
 * Cloudflare Access email/identity transition. Both identities must have been
 * verified by Access before this function is called; never trust a caller header.
 *
 * Existing records remain attached to the legacy subject. This function does
 * not move, rewrite or duplicate private data.
 */
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const email = value => nonempty(value) ? value.trim().toLowerCase() : null;

export function resolveOwnerIdentity(identity, env = {}) {
  if (!identity || !nonempty(identity.subject) || !nonempty(identity.email)) return null;
  const legacyEmail = email(env.OWNER_EMAIL);
  if (!legacyEmail) return null;
  const signedEmail = email(identity.email);
  const signedSubject = identity.subject.trim();

  // Backward-compatible path for the existing verified owner account.
  // When transition is armed, pin the existing subject too: never accept
  // another Access account merely because it reports the same email.
  if (signedEmail === legacyEmail) {
    if (env.OWNER_ALIAS_ENABLED === 'true' &&
        (!nonempty(env.OWNER_LEGACY_SUB) || signedSubject !== env.OWNER_LEGACY_SUB)) return null;
    if (nonempty(env.OWNER_LEGACY_SUB) && signedSubject !== env.OWNER_LEGACY_SUB) return null;
    return {subject:signedSubject, email:signedEmail};
  }

  // Disabled unless all three independently reviewed, exact-match bindings
  // are present. The new subject is never used for existing storage keys.
  if (env.OWNER_ALIAS_ENABLED !== 'true' ||
      !nonempty(env.OWNER_LEGACY_SUB) ||
      !nonempty(env.OWNER_CURRENT_SUB) ||
      !email(env.OWNER_CURRENT_EMAIL) ||
      env.OWNER_CURRENT_SUB === env.OWNER_LEGACY_SUB ||
      email(env.OWNER_CURRENT_EMAIL) === legacyEmail ||
      signedSubject !== env.OWNER_CURRENT_SUB ||
      signedEmail !== email(env.OWNER_CURRENT_EMAIL)) return null;

  return {subject:env.OWNER_LEGACY_SUB, email:signedEmail};
}
