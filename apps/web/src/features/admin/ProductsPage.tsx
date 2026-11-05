import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImagePlus, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  centsToDecimal,
  formatCents,
  LIMITS,
  toCents,
  type CategoryDTO,
  type ProductDTO,
} from '@cart2heavy/shared';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { ConfirmDialog } from '../../components/ui/confirm-dialog';
import { Dialog } from '../../components/ui/dialog';
import { EmptyState, ErrorState } from '../../components/ui/empty-state';
import { SelectField, TextArea, TextField } from '../../components/ui/field';
import { Container, PageHeader } from '../../components/ui/page';
import { Pagination } from '../../components/ui/pagination';
import { Skeleton } from '../../components/ui/skeleton';
import { Table, Td, Th } from '../../components/ui/table';
import { api, errorMessage } from '../../lib/api';
import { applyApiError } from '../../lib/forms';
import { useDebounced, useDocumentTitle } from '../../lib/hooks';
import { adminCategoriesQuery, adminProductsQuery } from './queries';

/** The form edits the price in dollars ("249.99"); the API gets whole cents. */
const productForm = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  description: z.string().trim().min(1, 'Description is required').max(2000),
  price: z
    .string()
    .trim()
    .refine((v) => {
      const cents = toCents(v);
      return cents !== null && cents >= 1 && cents <= LIMITS.maxPriceCents;
    }, 'Enter a price like 249.99'),
  category: z.string().min(1, 'Choose a category'),
  isActive: z.boolean(),
});
type ProductForm = z.infer<typeof productForm>;
const FIELDS = ['name', 'description', 'category', 'image'] as const;

function ProductFormDialogBody({
  product,
  categories,
  onDone,
}: {
  product?: ProductDTO;
  categories: CategoryDTO[];
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    },
    [previewUrl],
  );

  const { register, handleSubmit, setError, formState } = useForm<ProductForm>({
    resolver: zodResolver(productForm),
    defaultValues: {
      name: product?.name ?? '',
      description: product?.description ?? '',
      price: product ? centsToDecimal(product.priceCents) : '',
      category: product?.category?.id ?? '',
      isActive: product?.isActive ?? true,
    },
  });

  const save = useMutation({
    mutationFn: (form: FormData) =>
      api.upload<ProductDTO>(product ? 'PATCH' : 'POST', product ? `/admin/products/${product.id}` : '/admin/products', form),
  });

  const onFile = (chosen: File | undefined) => {
    setImageError(null);
    if (!chosen) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(chosen.type)) {
      setImageError('Choose a JPG, PNG or WebP image');
    } else if (chosen.size > LIMITS.productImageMaxBytes) {
      setImageError('The image is larger than 5 MB');
    } else {
      setFile(chosen);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    if (!product && !file) return; // the missing photo was reported before validation ran
    const form = new FormData();
    form.set('name', values.name);
    form.set('description', values.description);
    form.set('priceCents', String(toCents(values.price)));
    form.set('category', values.category);
    form.set('isActive', String(values.isActive));
    if (file) form.set('image', file);

    try {
      await save.mutateAsync(form);
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(product ? 'Product saved' : 'Product added');
      onDone();
    } catch (error) {
      const message = applyApiError(error, setError, FIELDS);
      if (message && /photo|image/i.test(message)) setImageError(message);
      else setFormError(message);
    }
  });

  const { errors } = formState;
  const shownImage = previewUrl ?? product?.imageUrl ?? null;
  return (
    <form
      noValidate
      onSubmit={(e) => {
        // the photo lives outside the form library, so it is checked here, next to the other fields
        if (!product && !file) setImageError('Choose a photo');
        void onSubmit(e);
      }}
      className="space-y-4"
    >
      <div className="flex items-center gap-4">
        <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-md border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800">
          {shownImage ? (
            <img src={shownImage} alt="Product preview" className="size-full object-cover" />
          ) : (
            <ImagePlus className="size-6 text-zinc-400" aria-hidden />
          )}
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Product photo"
            className="sr-only"
            onChange={(e) => {
              onFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            {shownImage ? 'Change photo' : 'Choose photo'}
          </Button>
          <p className="mt-1 text-xs text-zinc-500">JPG, PNG or WebP, up to 5 MB.</p>
          {imageError && (
            <p role="alert" className="mt-1 text-xs text-red-600 dark:text-red-400">
              {imageError}
            </p>
          )}
        </div>
      </div>

      <TextField label="Name" error={errors.name?.message} {...register('name')} />
      <TextArea label="Description" error={errors.description?.message} {...register('description')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Price (USD)"
          inputMode="decimal"
          placeholder="249.99"
          error={errors.price?.message}
          {...register('price')}
        />
        <SelectField label="Category" error={errors.category?.message} {...register('category')}>
          <option value="">Choose…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </SelectField>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-[var(--color-accent)]" {...register('isActive')} />
        Visible in the shop
      </label>

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
          {product ? 'Save' : 'Add product'}
        </Button>
      </div>
    </form>
  );
}

export function ProductsPage() {
  useDocumentTitle('Products');
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounced(search.trim(), 300);
  const products = useQuery(adminProductsQuery({ q, page, limit: 10 }));
  const categories = useQuery(adminCategoriesQuery);
  const [editing, setEditing] = useState<ProductDTO | 'new' | null>(null);
  const [deleting, setDeleting] = useState<ProductDTO | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => api.delete<{ result: 'deleted' | 'hidden' }>(`/admin/products/${id}`),
    onSuccess: async ({ result }) => {
      toast.success(result === 'deleted' ? 'Product deleted' : 'Product hidden (it was ordered before)');
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: ['admin'] });
      await queryClient.invalidateQueries({ queryKey: ['products'] });
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
        title="Products"
        actions={
          <Button onClick={() => setEditing('new')} disabled={!categories.data?.length}>
            <Plus className="size-4" aria-hidden /> New product
          </Button>
        }
      />
      {categories.data?.length === 0 && (
        <p className="mb-4 rounded-md bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
          Add a category first – every product belongs to one.
        </p>
      )}

      <div className="relative mb-4 max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
        <input
          type="search"
          aria-label="Search products"
          placeholder="Search products"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="h-10 w-full rounded-md border border-zinc-300 bg-white pr-3 pl-9 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      {products.isPending ? (
        <Skeleton className="h-64 w-full" />
      ) : products.error ? (
        <ErrorState message={errorMessage(products.error)} onRetry={() => void products.refetch()} />
      ) : products.data.items.length === 0 ? (
        <EmptyState title={q ? 'No products match' : 'No products yet'}>
          {q ? 'Try another word.' : 'Add your first product to start selling.'}
        </EmptyState>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Category</Th>
                <Th className="text-right">Price</Th>
                <Th className="text-right">Bought</Th>
                <Th>Status</Th>
                <Th className="text-right">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {products.data.items.map((product) => (
                <tr key={product.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <img src={product.imageUrl} alt="" className="size-10 shrink-0 rounded object-cover" />
                      <span className="max-w-64 truncate font-medium">{product.name}</span>
                    </div>
                  </Td>
                  <Td>{product.category?.name ?? '—'}</Td>
                  <Td className="text-right tabular-nums">{formatCents(product.priceCents)}</Td>
                  <Td className="text-right tabular-nums">{product.totalBought}</Td>
                  <Td>{product.isActive ? <Badge tone="success">Visible</Badge> : <Badge>Hidden</Badge>}</Td>
                  <Td className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="sm" aria-label={`Edit ${product.name}`} onClick={() => setEditing(product)}>
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button variant="ghost" size="sm" aria-label={`Delete ${product.name}`} onClick={() => setDeleting(product)}>
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={products.data.page} totalPages={products.data.totalPages} onPageChange={setPage} />
        </>
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'New product' : 'Edit product'}
      >
        <ProductFormDialogBody
          product={editing === 'new' ? undefined : (editing ?? undefined)}
          categories={categories.data ?? []}
          onDone={() => setEditing(null)}
        />
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete product"
        confirmLabel="Delete"
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
      >
        Delete “{deleting?.name}”? If customers have ordered it before, it is only hidden from the shop so their
        orders stay intact.
      </ConfirmDialog>
    </Container>
  );
}
