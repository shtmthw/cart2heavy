import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import {
  loginSchema,
  registerSchema,
  type LoginInput,
  type RegisterInput,
} from '@cart2heavy/shared';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { TextField } from '../../components/ui/field';
import { Container } from '../../components/ui/page';
import { homeFor, useAuth } from '../../lib/auth';
import { applyApiError } from '../../lib/forms';
import { useDocumentTitle } from '../../lib/hooks';
import { safeNext } from '../../lib/redirect';

function AuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <Container className="max-w-sm">
      <Card className="p-6">
        <h1 className="text-xl font-semibold">{title}</h1>
        <p className="mt-1 mb-5 text-sm text-zinc-500">{subtitle}</p>
        {children}
      </Card>
    </Container>
  );
}

export function LoginPage() {
  useDocumentTitle('Log in');
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // already logged in (or just logged in): go on
  if (user && !login.isPending) return <Navigate to={next ?? homeFor(user.role)} replace />;

  const onSubmit = handleSubmit(async (input) => {
    setFormError(null);
    try {
      const loggedIn = await login.mutateAsync(input);
      toast.success(`Welcome back, ${loggedIn.name}`);
      void navigate(next ?? homeFor(loggedIn.role), { replace: true });
    } catch (error) {
      setFormError(applyApiError(error, setError, ['email', 'password']));
    }
  });

  return (
    <AuthCard title="Log in" subtitle="Welcome back.">
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={formState.errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="current-password"
          error={formState.errors.password?.message}
          {...register('password')}
        />
        {formError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {formError}
          </p>
        )}
        <Button type="submit" className="w-full" loading={login.isPending}>
          Log in
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-zinc-500">
        New here?{' '}
        <Link
          to={next ? `/register?next=${encodeURIComponent(next)}` : '/register'}
          className="text-accent hover:underline"
        >
          Create an account
        </Link>
      </p>
    </AuthCard>
  );
}

export function RegisterPage() {
  useDocumentTitle('Sign up');
  const { user, register: signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  if (user && !signUp.isPending) return <Navigate to={next ?? '/'} replace />;

  const onSubmit = handleSubmit(async (input) => {
    setFormError(null);
    try {
      const created = await signUp.mutateAsync(input);
      toast.success(`Welcome, ${created.name}`);
      void navigate(next ?? '/', { replace: true });
    } catch (error) {
      setFormError(applyApiError(error, setError, ['name', 'email', 'password']));
    }
  });

  return (
    <AuthCard title="Create your account" subtitle="It takes a few seconds.">
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="space-y-4">
        <TextField
          label="Name"
          autoComplete="name"
          error={formState.errors.name?.message}
          {...register('name')}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          error={formState.errors.email?.message}
          {...register('email')}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters"
          error={formState.errors.password?.message}
          {...register('password')}
        />
        {formError && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {formError}
          </p>
        )}
        <Button type="submit" className="w-full" loading={signUp.isPending}>
          Sign up
        </Button>
      </form>
      <p className="mt-4 text-center text-sm text-zinc-500">
        Already have an account?{' '}
        <Link
          to={next ? `/login?next=${encodeURIComponent(next)}` : '/login'}
          className="text-accent hover:underline"
        >
          Log in
        </Link>
      </p>
    </AuthCard>
  );
}
