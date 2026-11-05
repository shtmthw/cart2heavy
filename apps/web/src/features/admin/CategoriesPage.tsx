import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import {
  categoryInputSchema,
  WEIGHT_LABELS,
  WEIGHTS,
  type CategoryDTO,
  type CategoryInput,
} from '@cart2heavy/shared';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Dialog } from '../../components/ui/dialog';
import { EmptyState, ErrorState } from '../../components/ui/empty-state';
import { SelectField, TextField } from '../../components/ui/field';
import { Container, PageHeader } from '../../components/ui/page';
import { Skeleton } from '../../components/ui/skeleton';
import { Table, Td, Th } from '../../components/ui/table';
import { api, errorMessage } from '../../lib/api';
import { applyApiError } from '../../lib/forms';
import { useDocumentTitle } from '../../lib/hooks';
import { adminCategoriesQuery } from './queries';

function CategoryForm({ category, onDone }: { category?: CategoryDTO; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [formError, setFormError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState } = useForm<CategoryInput>({
    resolver: zodResolver(categoryInputSchema),
    defaultValues: { name: category?.name ?? '', weight: category?.weight ?? 'medium' },
  });

  const save = useMutation({
    mutationFn: (input: CategoryInput) =>
      category
        ? api.patch<CategoryDTO>(`/admin/categories/${category.id}`, input)
        : api.post<CategoryDTO>('/admin/categories', input),
  });

  const onSubmit = handleSubmit(async (input) => {
    setFormError(null);
    try {
      await save.mutateAsync(input);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(category ? 'Category saved' : 'Category added');
      onDone();
    } catch (error) {
      setFormError(applyApiError(error, setError, ['name', 'weight']));
    }
  });

  return (
    <form noValidate onSubmit={(e) => void onSubmit(e)} className="space-y-4">
      <TextField label="Name" error={formState.errors.name?.message} {...register('name')} />
      <SelectField
        label="Package size"
        hint="Tells the logistics team how big the parcels of this category are."
        error={formState.errors.weight?.message}
        {...register('weight')}
      >
        {WEIGHTS.map((w) => (
          <option key={w} value={w}>
            {WEIGHT_LABELS[w].code} · {WEIGHT_LABELS[w].label} – {WEIGHT_LABELS[w].hint}
          </option>
        ))}
      </SelectField>
      {formError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {formError}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending}>
          {category ? 'Save' : 'Add category'}
        </Button>
      </div>
    </form>
  );
}

export function CategoriesPage() {
  useDocumentTitle('Categories');
  const queryClient = useQueryClient();
  const { data: categories, isPending, error, refetch } = useQuery(adminCategoriesQuery);
  const [editing, setEditing] = useState<CategoryDTO | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CategoryDTO | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/categories/${id}`),
    onSuccess: async () => {
      toast.success('Category deleted');
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (e) => {
      toast.error(errorMessage(e));
      setDeleting(null);
    },
  });

  return (
    <Container>
      <PageHeader
        title="Categories"
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden /> New category
          </Button>
        }
      />

      {isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : error ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : categories.length === 0 ? (
        <EmptyState title="No categories yet">Add a category before you add products.</EmptyState>
      ) : (
        <>
          <ul className="space-y-3 md:hidden">
            {categories.map((category) => (
              <li key={category.id}>
                <Card className="flex items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{category.name}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Badge>
                        {WEIGHT_LABELS[category.weight].code} ·{' '}
                        {WEIGHT_LABELS[category.weight].label}
                      </Badge>
                      <span className="text-xs text-zinc-400">
                        {category.productCount ?? 0} products
                      </span>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Edit ${category.name}`}
                    onClick={() => setEditing(category)}
                  >
                    <Pencil className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    aria-label={`Delete ${category.name}`}
                    onClick={() => setDeleting(category)}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </Card>
              </li>
            ))}
          </ul>
          <div className="hidden md:block">
            <Table>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Package size</Th>
                  <Th className="text-right">Products</Th>
                  <Th className="text-right">
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <Td className="font-medium">{category.name}</Td>
                    <Td>
                      <Badge title={WEIGHT_LABELS[category.weight].hint}>
                        {WEIGHT_LABELS[category.weight].code} ·{' '}
                        {WEIGHT_LABELS[category.weight].label}
                      </Badge>
                    </Td>
                    <Td className="text-right tabular-nums">{category.productCount ?? 0}</Td>
                    <Td className="text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Edit ${category.name}`}
                        onClick={() => setEditing(category)}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Delete ${category.name}`}
                        onClick={() => setDeleting(category)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New category' : 'Edit category'}
      >
        <CategoryForm
          category={editing === 'new' ? undefined : (editing ?? undefined)}
          onDone={() => setEditing(null)}
        />
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete category"
        confirmLabel="Delete"
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      >
        Delete “{deleting?.name}”? A category that still has products cannot be deleted.
      </ConfirmDialog>
    </Container>
  );
}
