import { Container } from '../../components/ui/page';

export function Footer() {
  const link = 'underline-offset-4 hover:underline hover:text-zinc-900 dark:hover:text-zinc-100';
  return (
    <footer className="mt-16 border-t border-zinc-200 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
      <Container className="flex flex-wrap items-center justify-between gap-2">
        <p>Made and founded by Matthew Baroi.</p>
        <p className="flex gap-4">
          <a className={link} href="https://github.com/shtmthw" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a
            className={link}
            href="https://www.instagram.com/sht_matthew/"
            target="_blank"
            rel="noreferrer"
          >
            Instagram
          </a>
        </p>
      </Container>
    </footer>
  );
}
