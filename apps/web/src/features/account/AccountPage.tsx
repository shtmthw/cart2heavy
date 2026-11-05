import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  changePasswordSchema,
  LIMITS,
  updateProfileSchema,
  type UpdateProfileInput,
  type UserDTO,
} from '@cart2heavy/shared';
import { Avatar } from '../../components/ui/avatar';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { TextField } from '../../components/ui/field';
import { Container, PageHeader } from '../../components/ui/page';
import { api, errorMessage } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { applyApiError } from '../../lib/forms';
import { useDocumentTitle } from '../../lib/hooks';
import { meQuery } from '../../lib/queries';

const passwordForm = changePasswordSchema
  .extend({ confirm: z.string() })
  .refine((v) => v.newPassword === v.confirm, {
    path: ['confirm'],
    message: 'Passwords do not match',
  });
type PasswordForm = z.input<typeof passwordForm>;

function ProfileCard({ user }: { user: UserDTO }) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { name: user.name },
  });

  const upload = (form: FormData) => api.upload<UserDTO>('PATCH', '/me', form);
  const saveName = useMutation({
    mutationFn: upload,
    onSuccess: (updated) => queryClient.setQueryData(meQuery.queryKey, updated),
  });
  const saveAvatar = useMutation({
    mutationFn: upload,
    onSuccess: (updated) => queryClient.setQueryData(meQuery.queryKey, updated),
  });
  const removeAvatar = useMutation({
    mutationFn: () => api.delete<UserDTO>('/me/avatar'),
    onSuccess: (updated) => {
      queryClient.setQueryData(meQuery.queryKey, updated);
      toast.success('Photo removed');
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Choose a JPG, PNG or WebP image');
      return;
    }
    if (file.size > LIMITS.avatarMaxBytes) {
      toast.error('That image is larger than 5 MB');
      return;
    }
    const form = new FormData();
    form.append('avatar', file);
    saveAvatar.mutate(form, {
      onSuccess: () => toast.success('Photo updated'),
      onError: (e) => toast.error(errorMessage(e)),
    });
  };

  const onSubmit = handleSubmit((input) => {
    setFormError(null);
    const form = new FormData();
    form.append('name', input.name);
    saveName.mutate(form, {
      onSuccess: () => toast.success('Profile saved'),
      onError: (e) => setFormError(applyApiError(e, setError, ['name'])),
    });
  });

  return (
    <Card className="p-5">
      <h2 className="mb-4 font-semibold">Profile</h2>
      <div className="mb-5 flex items-center gap-4">
        <Avatar name={user.name} src={user.avatarUrl} className="size-16 text-xl" />
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            id="avatar-input"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = ''; // allow choosing the same file again
            }}
          />
          <Button
            variant="secondary"
            size="sm"
            loading={saveAvatar.isPending}
            onClick={() => fileRef.current?.click()}
          >
            {user.avatarUrl ? 'Change photo' : 'Upload photo'}
          </Button>
          {user.avatarUrl && (
            <Button
              variant="ghost"
              size="sm"
              loading={removeAvatar.isPending}
              onClick={() => removeAvatar.mutate()}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <TextField
          label="Name"
          autoComplete="name"
          error={formState.errors.name?.message}
          {...register('name')}
        />
        <TextField
          label="Email"
          value={user.email}
          readOnly
          disabled
          hint="Your email cannot be changed."
        />
        {formError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {formError}
          </p>
        )}
        <Button type="submit" loading={saveName.isPending}>
          Save
        </Button>
      </form>
    </Card>
  );
}

function PasswordCard() {
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, reset, formState } = useForm<
    PasswordForm,
    unknown,
    z.output<typeof passwordForm>
  >({
    resolver: zodResolver(passwordForm),
    defaultValues: { currentPassword: '', newPassword: '', confirm: '' },
  });
  const change = useMutation({
    mutationFn: (input: { currentPassword: string; newPassword: string }) =>
      api.patch('/me/password', input),
  });

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setFormError(null);
    try {
      await change.mutateAsync({ currentPassword, newPassword });
      toast.success('Password changed');
      reset();
    } catch (error) {
      setFormError(applyApiError(error, setError, ['currentPassword', 'newPassword']));
    }
  });

  const { errors } = formState;
  return (
    <Card className="p-5">
      <h2 className="mb-4 font-semibold">Password</h2>
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <TextField
          label="Repeat new password"
          type="password"
          autoComplete="new-password"
          error={errors.confirm?.message}
          {...register('confirm')}
        />
        {formError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {formError}
          </p>
        )}
        <Button type="submit" loading={change.isPending}>
          Change password
        </Button>
      </form>
    </Card>
  );
}

export function AccountPage() {
  useDocumentTitle('Account');
  const { user } = useAuth();
  if (!user) return null; // the route guard guarantees a user
  return (
    <Container className="max-w-xl">
      <PageHeader title="Account" />
      <div className="space-y-6">
        <ProfileCard user={user} />
        <PasswordCard />
      </div>
    </Container>
  );
}
