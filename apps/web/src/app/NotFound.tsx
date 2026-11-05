import { isRouteErrorResponse, useRouteError } from 'react-router';
import { ButtonLink } from '../components/ui/button';
import { EmptyState } from '../components/ui/empty-state';
import { Container } from '../components/ui/page';

export function NotFoundPage() {
  return (
    <Container>
      <EmptyState title="Page not found" action={<ButtonLink to="/">Back to the shop</ButtonLink>}>
        The page you are looking for does not exist.
      </EmptyState>
    </Container>
  );
}

/** Shown when something in a page crashes – instead of a blank screen. */
export function RouteError() {
  const error = useRouteError();
  const notFound = isRouteErrorResponse(error) && error.status === 404;
  return (
    <Container className="py-16">
      <EmptyState
        title={notFound ? 'Page not found' : 'Something went wrong'}
        action={<ButtonLink to="/">Back to the shop</ButtonLink>}
      >
        {notFound
          ? 'The page you are looking for does not exist.'
          : 'Please reload the page. If it keeps happening, try again later.'}
      </EmptyState>
    </Container>
  );
}
