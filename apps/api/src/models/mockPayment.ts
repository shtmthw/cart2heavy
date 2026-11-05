import { model, Schema, type Types } from 'mongoose';

/** What a payment company would remember on its side – only used by the "mock" payment provider. */
export interface MockPaymentDoc {
  sessionId: string;
  order: Types.ObjectId;
  amountCents: number;
  status: 'open' | 'paid' | 'cancelled';
  createdAt: Date;
}

const mockPaymentSchema = new Schema<MockPaymentDoc>(
  {
    sessionId: { type: String, required: true, unique: true },
    order: { type: Schema.Types.ObjectId, ref: 'Order', required: true },
    amountCents: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['open', 'paid', 'cancelled'], default: 'open' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const MockPayment = model<MockPaymentDoc>('MockPayment', mockPaymentSchema);
