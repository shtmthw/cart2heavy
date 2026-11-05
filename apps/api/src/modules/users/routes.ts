import { Router } from 'express';
import { changePasswordSchema, LIMITS, updateProfileSchema } from '@cart2heavy/shared';
import type { AppContext } from '../../context';
import { toUserDTO } from '../../dto';
import { HttpError } from '../../errors';
import { currentUser, requireAuth } from '../../middleware/auth';
import { imageUpload, removeUpload, withUpload } from '../../middleware/upload';
import { User } from '../../models';
import { checkPassword, hashPassword } from '../auth/service';

/** The logged-in user's own account. There is no "user id" in these URLs on purpose. */
export function userRoutes({ config }: AppContext): Router {
  const router = Router();

  // JSON `{ name }` or multipart with `name` and/or an `avatar` file
  router.patch(
    '/',
    requireAuth,
    ...imageUpload(config, 'avatars', 'avatar', LIMITS.avatarMaxBytes),
    withUpload(async (req, res) => {
      const input = updateProfileSchema.partial().parse(req.body ?? {});
      if (input.name === undefined && !req.file) throw HttpError.badRequest('Nothing to update');

      const user = await User.findById(currentUser(req).id);
      if (!user) throw HttpError.unauthorized();
      const previousAvatar = user.avatar;
      if (input.name !== undefined) user.name = input.name;
      if (req.file) user.avatar = req.file.filename;
      await user.save();
      if (req.file) await removeUpload(config, 'avatars', previousAvatar);
      res.json(toUserDTO(user));
    }),
  );

  router.delete('/avatar', requireAuth, async (req, res) => {
    const user = await User.findById(currentUser(req).id);
    if (!user) throw HttpError.unauthorized();
    const previousAvatar = user.avatar;
    user.avatar = null;
    await user.save();
    await removeUpload(config, 'avatars', previousAvatar);
    res.json(toUserDTO(user));
  });

  router.patch('/password', requireAuth, async (req, res) => {
    const input = changePasswordSchema.parse(req.body);
    const user = await User.findById(currentUser(req).id).select('+passwordHash');
    if (!user) throw HttpError.unauthorized();
    if (!(await checkPassword(input.currentPassword, user.passwordHash))) {
      throw HttpError.badRequest('Your current password is incorrect', {
        currentPassword: ['Your current password is incorrect'],
      });
    }
    user.passwordHash = await hashPassword(config, input.newPassword);
    await user.save();
    res.status(204).end();
  });

  return router;
}
