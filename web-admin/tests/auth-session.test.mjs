import test from 'node:test';
import assert from 'node:assert/strict';
import { updateVerifiedSession } from '../src/context/verifiedSession.ts';

const loading = { loading: true };
const alice = { subject: 'alice', roles: [{ authority: 'ROLE_ADMIN' }], driverId: 11 };
const bob = { subject: 'bob', roles: ['DRIVER'], driverId: 22 };
const empty = () => ({ subject: null });
const verify = (previous, identity) => updateVerifiedSession(previous, identity.subject, { loading: false, data: identity });

test('first login requires backend identity; loading alone grants no user or roles', () => {
  const pending = updateVerifiedSession(empty(), 'alice', loading);
  assert.equal(pending.identity, undefined);
  assert.equal(verify(pending, alice).identity, alice);
});

test('same-subject JWT refresh retains the verified user, so ProtectedRoute need not replace Outlet', () => {
  const accepted = verify(empty(), alice);
  const refreshing = updateVerifiedSession(accepted, 'alice', loading);
  assert.equal(refreshing, accepted);
  assert.equal(loading.loading && !refreshing.identity, false);
  assert.equal(refreshing.identity, alice);
  assert.equal(updateVerifiedSession(refreshing, 'alice', loading), accepted);
});

test('fresh backend roles replace cached roles even when subject is unchanged', () => {
  const accepted = verify(empty(), alice);
  const downgraded = { subject: 'alice', roles: ['DRIVER'], driverId: 11 };
  const fresh = verify(updateVerifiedSession(accepted, 'alice', loading), downgraded);
  assert.equal(fresh.identity, downgraded);
  assert.deepEqual(fresh.identity.roles, ['DRIVER']);
});

test('changing subject removes authorization immediately and never restores Alice on A to B to A', () => {
  const accepted = verify(empty(), alice);
  const switching = updateVerifiedSession(accepted, 'bob', loading);
  assert.equal(switching.identity, undefined);
  assert.equal(switching.subject, 'bob');
  const backToAlice = updateVerifiedSession(switching, 'alice', loading);
  assert.equal(backToAlice.identity, undefined);
  assert.equal(loading.loading && !backToAlice.identity, true);
  assert.equal(verify(switching, bob).identity, bob);
});

for (const error of ['HTTP 403: acceso denegado', 'HTTP 401: sesión revocada', 'No se pudo validar la sesión']) {
  test(`validation failure strictly invalidates identity and retry cannot resurrect it: ${error}`, () => {
    const accepted = verify(empty(), alice);
    const rejected = updateVerifiedSession(accepted, 'alice', { loading: false, error, data: alice });
    assert.equal(rejected.identity, undefined);
    const retry = updateVerifiedSession(rejected, 'alice', loading);
    assert.equal(retry.identity, undefined);
    assert.equal(verify(retry, alice).identity, alice);
  });
}

test('a backend identity with a different subject is rejected, including while loading', () => {
  const accepted = verify(empty(), alice);
  for (const pending of [false, true]) {
    const rejected = updateVerifiedSession(accepted, 'alice', { loading: pending, data: bob });
    assert.equal(rejected.identity, undefined);
  }
});

test('logout or malformed token clears identity; logging back in requires fresh validation', () => {
  const accepted = verify(empty(), alice);
  const cleared = updateVerifiedSession(accepted, null, { loading: false });
  assert.equal(cleared.identity, undefined);
  assert.equal(updateVerifiedSession(cleared, 'alice', loading).identity, undefined);
});
