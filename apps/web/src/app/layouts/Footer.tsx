import { Container } from '../../components/ui/page';

export function Footer() {
  const link =
    'underline-offset-4 transition-colors hover:text-zinc-900 hover:underline dark:hover:text-zinc-100';
  return (
    <footer className="mt-16 border-t border-zinc-800/80 py-6 text-xs text-zinc-500">
      <Container className="flex flex-col items-center justify-between gap-2 sm:flex-row">
        <p>Made and founded by Matthew Baroi.</p>
        <a className={link} href="https://github.com/shtmthw" target="_blank" rel="noreferrer">
          GitHub
        </a>
      </Container>
    </footer>
  );
}
