import { Container } from '../../components/ui/page';

export function Footer() {
  const link =
    'underline-offset-4 transition-colors hover:text-zinc-900 hover:underline dark:hover:text-zinc-100';
  return (
    <footer className="mt-20 border-t border-zinc-200/70 py-8 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      <Container className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <p>Made and founded by Matthew Baroi.</p>
        <a className={link} href="https://github.com/shtmthw" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </Container>
    </footer>
  );
}
