import fs from 'node:fs/promises';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { slugify, type OrderStatus } from '@cart2heavy/shared';
import type { AppConfig } from '../config/env';
import type { Logger } from '../logger';
import { Category, MockPayment, Order, Product, User } from '../models';
import { priceCart } from '@cart2heavy/shared';
import { DEMO_PASSWORDS, OWNER_ACCOUNT, SEED_CATEGORIES, SEED_ORDERS, SEED_PRODUCTS } from './data';

const HOUR = 60 * 60 * 1000;

async function copySeedImages(config: AppConfig) {
  const target = path.join(config.uploadDir, 'products');
  await fs.mkdir(target, { recursive: true });
  const names = [...new Set(SEED_PRODUCTS.map((p) => p.image))];
  for (const name of names) {
    try {
      await fs.copyFile(path.join(config.seedImagesDir, name), path.join(target, name));
    } catch {
      throw new Error(
        `Seed image "${name}" was not found in ${config.seedImagesDir} (set SEED_IMAGES_DIR to the folder with the demo photos)`,
      );
    }
  }
}

export async function isDatabaseEmpty(): Promise<boolean> {
  const [users, products] = await Promise.all([
    User.estimatedDocumentCount(),
    Product.estimatedDocumentCount(),
  ]);
  return users === 0 && products === 0;
}

/**
 * Fills the database with demo data: categories, products (with photos), three accounts and a few
 * orders at different stages. Does nothing when there is already data, unless `reset` is true.
 * Returns true when it seeded.
 */
export async function seedDatabase(
  { config, logger }: { config: AppConfig; logger: Logger },
  { reset = false }: { reset?: boolean } = {},
): Promise<boolean> {
  if (!reset && !(await isDatabaseEmpty())) return false;
  if (reset) {
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Product.deleteMany({}),
      Order.deleteMany({}),
      MockPayment.deleteMany({}),
    ]);
  }

  await copySeedImages(config);

  const hash = (password: string) => bcrypt.hash(password, config.bcryptRounds);
  const createAccount = async (key: keyof typeof DEMO_PASSWORDS) => {
    const account = DEMO_PASSWORDS[key];
    return User.create({
      name: account.name,
      email: account.email,
      passwordHash: await hash(account.password),
      role: key === 'demo' ? 'customer' : key,
    });
  };
  const admin = await createAccount('admin');
  const logistics = await createAccount('logistics');
  const demo = await createAccount('demo');
  await User.create({
    name: OWNER_ACCOUNT.name,
    email: OWNER_ACCOUNT.email,
    passwordHash: await hash(OWNER_ACCOUNT.password),
    role: 'admin',
  });

  const categories = await Category.create(
    SEED_CATEGORIES.map((c) => ({ name: c.name, slug: slugify(c.name), weight: c.weight })),
  );
  const categoryByName = new Map(categories.map((c) => [c.name, c]));

  const products = await Product.create(
    SEED_PRODUCTS.map((p) => ({
      name: p.name,
      description: p.description,
      priceCents: p.priceCents,
      image: p.image,
      category: categoryByName.get(p.category)!._id,
    })),
  );
  const productByName = new Map(products.map((p) => [p.name, p]));

  const sold = new Map<string, number>();
  const now = Date.now();
  for (const [index, seed] of SEED_ORDERS.entries()) {
    const placedAt = new Date(now - seed.hoursAgo * HOUR);
    const items = seed.lines.map(([name, quantity]) => {
      const product = productByName.get(name)!;
      const category = categories.find((c) => c._id.equals(product.category))!;
      return {
        product: product._id,
        name: product.name,
        priceCents: product.priceCents,
        quantity,
        weight: category.weight,
        image: product.image,
      };
    });
    const totals = priceCart(
      items.map((i) => ({ ...i, isActive: true })),
      config,
    );

    const statuses: OrderStatus[] = ['processing', ...seed.steps];
    const statusHistory = statuses.map((status, i) => ({
      status,
      at: new Date(placedAt.getTime() + i * 6 * HOUR),
      by: i === 0 ? null : i === 1 ? admin._id : logistics._id,
    }));

    await Order.create({
      user: demo._id,
      email: demo.email,
      items,
      subtotalCents: totals.subtotalCents,
      deliveryCents: totals.deliveryCents,
      totalCents: totals.totalCents,
      address: {
        fullName: 'Demo Customer',
        line1: '221 Example Street',
        line2: '',
        city: 'Springfield',
        postalCode: '12345',
        country: 'United States',
        phone: '+1 555 010 0199',
      },
      status: statuses.at(-1),
      statusHistory,
      payment: {
        provider: 'mock',
        status: seed.paid ? 'paid' : 'pending',
        sessionId: seed.paid ? `seed_${index + 1}` : null,
        paidAt: seed.paid ? new Date(placedAt.getTime() + 5 * 60 * 1000) : null,
      },
      createdAt: placedAt,
    });

    if (seed.paid) {
      for (const item of items) {
        sold.set(item.name, (sold.get(item.name) ?? 0) + item.quantity);
      }
    }
  }

  await Product.bulkWrite(
    [...sold].map(([name, quantity]) => ({
      updateOne: {
        filter: { _id: productByName.get(name)!._id },
        update: { $set: { totalBought: quantity } },
      },
    })),
  );

  logger.info(
    { products: products.length, categories: categories.length, orders: SEED_ORDERS.length },
    'seeded demo data',
  );
  return true;
}
