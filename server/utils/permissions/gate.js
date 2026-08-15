import { getSession, currentUserHasPermission } from 'kempo/server/sdk.js';

/*
  The own/others permission shape, in one place.

  Written out longhand in every route it appears in, this is the kind of check that eventually gets
  one clause wrong somewhere and nobody notices until the wrong person deletes something.

  `files:own:update` means "things you uploaded"; `files:others:update` means "anything". Holding
  the second does not require the first — an admin who owns nothing still manages everything.
*/

export const requireSession = async request => {
  const token = request.cookies?.session_token;
  if(!token) return [{ code: 401, msg: 'Authentication required' }, null];

  const [error, session] = await getSession({ token });
  if(error || !session?.user) return [{ code: 401, msg: 'Authentication required' }, null];

  return [null, { token, user: session.user }];
};

export const requirePermission = async (token, name) => {
  const [error, allowed] = await currentUserHasPermission(token, name);
  if(error) return [{ code: error.code, msg: error.msg }, null];
  if(!allowed) return [{ code: 403, msg: 'Insufficient permissions' }, null];
  return [null, true];
};

/*
  `resource` is 'files' or 'directories'; `action` is 'update' or 'delete'.
*/
export const requireOwnership = async ({ token, userId, resource, action, ownerId }) => {
  const isOwner = ownerId === userId;

  const [ownError, canOwn] = await currentUserHasPermission(token, `${resource}:own:${action}`);
  if(ownError) return [{ code: ownError.code, msg: ownError.msg }, null];

  const [othersError, canOthers] = await currentUserHasPermission(token, `${resource}:others:${action}`);
  if(othersError) return [{ code: othersError.code, msg: othersError.msg }, null];

  if(!((isOwner && canOwn) || canOthers)){
    return [{ code: 403, msg: 'Insufficient permissions' }, null];
  }

  return [null, true];
};
