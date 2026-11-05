import type { OrderStatus, Weight } from '@cart2heavy/shared';

export const DEMO_PASSWORDS = {
  admin: { email: 'admin@cart2heavy.local', password: 'admin1234', name: 'Admin' },
  logistics: { email: 'logistics@cart2heavy.local', password: 'logistics1234', name: 'Logistics' },
  demo: { email: 'demo@cart2heavy.local', password: 'demo1234', name: 'Demo Customer' },
} as const;

export const SEED_CATEGORIES: { name: string; weight: Weight }[] = [
  { name: 'Motherboards', weight: 'medium' },
  { name: 'Phones', weight: 'small' },
  { name: 'Laptops', weight: 'big' },
  { name: 'Desktops', weight: 'large' },
];

export interface SeedProduct {
  name: string;
  category: string;
  priceCents: number;
  /** file inside src/seed/images */
  image: string;
  description: string;
}

export const SEED_PRODUCTS: SeedProduct[] = [
  {
    name: 'MSI MPG Gaming Motherboard',
    category: 'Motherboards',
    priceCents: 32900,
    image: 'msi-mpg.jpg',
    description:
      'A performance gaming board with a strong power design, fast memory support and room for the latest PCIe graphics cards and NVMe drives.',
  },
  {
    name: 'MSI MAG Gaming Motherboard',
    category: 'Motherboards',
    priceCents: 19900,
    image: 'msi-mag.jpg',
    description:
      'The sensible gamer’s choice: a solid, well cooled board with everything you need and nothing you do not.',
  },
  {
    name: 'MSI MEG ACE Motherboard',
    category: 'Motherboards',
    priceCents: 68900,
    image: 'msi-meg-ace.jpg',
    description:
      'Enthusiast grade board built for overclocking, with a heavy-duty VRM, premium audio and the fastest connectivity available.',
  },
  {
    name: 'MSI MEG GODLIKE Motherboard',
    category: 'Motherboards',
    priceCents: 109900,
    image: 'msi-meg-godlike.jpg',
    description:
      'The flagship. Every feature the platform offers, extreme power delivery and a build that looks as good as it performs.',
  },
  {
    name: 'MSI X670 Motherboard for AMD Ryzen',
    category: 'Motherboards',
    priceCents: 44900,
    image: 'msi-x670.jpg',
    description:
      'A modern AM5 board for the newest Ryzen processors, with DDR5 memory and PCIe 5.0 storage support.',
  },
  {
    name: 'Smartphone 128 GB',
    category: 'Phones',
    priceCents: 34900,
    image: 'smartphone.jpg',
    description:
      'A slim all-day phone with a crisp display, a great camera and a battery that lasts.',
  },
  {
    name: 'Smartphone Pro 256 GB',
    category: 'Phones',
    priceCents: 64900,
    image: 'smartphone.jpg',
    description:
      'More storage, a brighter screen and a pro camera system for people who live on their phone.',
  },
  {
    name: 'Ultrabook 13"',
    category: 'Laptops',
    priceCents: 89900,
    image: 'laptop.jpg',
    description:
      'Light, quiet and fast enough for everything you throw at it. An aluminium body that fits any bag.',
  },
  {
    name: 'Ultrabook Pro 15"',
    category: 'Laptops',
    priceCents: 139900,
    image: 'laptop.jpg',
    description:
      'A bigger screen, a faster processor and more memory for creative work and long days away from the desk.',
  },
  {
    name: 'All-in-One Desktop 24"',
    category: 'Desktops',
    priceCents: 119900,
    image: 'desktop.jpg',
    description: 'Computer and display in one tidy package. Plug it in and start working.',
  },
  {
    name: 'All-in-One Desktop 27"',
    category: 'Desktops',
    priceCents: 179900,
    image: 'desktop.jpg',
    description: 'A big, sharp 27 inch screen with a powerful machine built into the stand.',
  },
  {
    name: 'Developer Workstation',
    category: 'Desktops',
    priceCents: 249900,
    image: 'desktop.jpg',
    description:
      'Many cores, lots of memory and fast storage for compiling, rendering and everything heavy.',
  },
];

export interface SeedOrder {
  /** how long ago the order was placed */
  hoursAgo: number;
  lines: [productName: string, quantity: number][];
  paid: boolean;
  /** statuses after "processing", in order; the last one is the current status */
  steps: OrderStatus[];
}

/** One order per stage, so the admin and logistics screens have something to show. */
export const SEED_ORDERS: SeedOrder[] = [
  {
    hoursAgo: 14 * 24,
    lines: [
      ['MSI MPG Gaming Motherboard', 1],
      ['Smartphone 128 GB', 2],
    ],
    paid: true,
    steps: ['confirmed', 'received', 'shipping', 'shipped', 'out_for_delivery', 'delivered'],
  },
  {
    hoursAgo: 9 * 24,
    lines: [['Ultrabook 13"', 1]],
    paid: true,
    steps: ['confirmed', 'received', 'shipping', 'shipped', 'out_for_delivery', 'delivered'],
  },
  {
    hoursAgo: 4 * 24,
    lines: [
      ['MSI MEG ACE Motherboard', 1],
      ['MSI MAG Gaming Motherboard', 1],
    ],
    paid: true,
    steps: ['confirmed', 'received', 'shipping', 'shipped'],
  },
  {
    hoursAgo: 2 * 24,
    lines: [['All-in-One Desktop 24"', 1]],
    paid: true,
    steps: ['confirmed'],
  },
  {
    hoursAgo: 24,
    lines: [
      ['Smartphone Pro 256 GB', 1],
      ['MSI MAG Gaming Motherboard', 2],
    ],
    paid: true,
    steps: [],
  },
  {
    hoursAgo: 3,
    lines: [['Ultrabook Pro 15"', 1]],
    paid: false,
    steps: [],
  },
];
