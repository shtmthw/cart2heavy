import mongoose from 'mongoose';
import { Category, Order, Product, User } from './models';

export async function connectDb(uri: string): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  // make sure the unique indexes exist before the first request
  await Promise.all([User, Category, Product, Order].map((model) => model.init()));
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
}

export function isDbConnected(): boolean {
  return mongoose.connection.readyState === mongoose.ConnectionStates.connected;
}
