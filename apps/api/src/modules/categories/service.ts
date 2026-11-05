import type { CategoryInput } from '@cart2heavy/shared';
import { slugify } from '@cart2heavy/shared';
import { mongo, type Types } from 'mongoose';
import { HttpError } from '../../errors';
import { Category, Product } from '../../models';
import { toCategoryDTO } from '../../dto';

/** Categories with the number of products in each (`activeOnly` = what a shopper can see). */
export async function listCategories(activeOnly: boolean) {
  const [categories, counts] = await Promise.all([
    Category.find().sort({ name: 1 }).collation({ locale: 'en', strength: 2 }).lean(),
    Product.aggregate<{ _id: Types.ObjectId; count: number }>([
      ...(activeOnly ? [{ $match: { isActive: true } }] : []),
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]),
  ]);
  const byId = new Map(counts.map((c) => [c._id.toString(), c.count]));
  return categories.map((c) => toCategoryDTO(c, byId.get(c._id.toString()) ?? 0));
}

function slugFor(name: string): string {
  const slug = slugify(name);
  if (!slug)
    throw HttpError.badRequest('Name must contain letters or numbers', {
      name: ['Use letters or numbers'],
    });
  return slug;
}

function duplicateAsConflict(err: unknown): never {
  if (err instanceof mongo.MongoServerError && err.code === 11000) {
    throw HttpError.conflict('A category with this name already exists');
  }
  throw err;
}

export async function createCategory(input: CategoryInput) {
  try {
    const category = await Category.create({ ...input, slug: slugFor(input.name) });
    return toCategoryDTO(category.toObject(), 0);
  } catch (err) {
    return duplicateAsConflict(err);
  }
}

export async function updateCategory(id: string, input: CategoryInput) {
  try {
    const category = await Category.findByIdAndUpdate(
      id,
      { ...input, slug: slugFor(input.name) },
      { returnDocument: 'after', runValidators: true },
    ).lean();
    if (!category) throw HttpError.notFound('Category');
    return toCategoryDTO(category, await Product.countDocuments({ category: category._id }));
  } catch (err) {
    return duplicateAsConflict(err);
  }
}

export async function deleteCategory(id: string) {
  const category = await Category.findById(id);
  if (!category) throw HttpError.notFound('Category');
  const inUse = await Product.countDocuments({ category: category._id });
  if (inUse > 0) {
    throw HttpError.conflict(
      `${inUse} product${inUse === 1 ? ' is' : 's are'} still in this category. Move or delete them first.`,
    );
  }
  await category.deleteOne();
}
