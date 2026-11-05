import type { OrderStatus, Weight } from '@cart2heavy/shared';

export const DEMO_PASSWORDS = {
  admin: { email: 'admin@cart2heavy.local', password: 'admin1234', name: 'Admin' },
  logistics: { email: 'logistics@cart2heavy.local', password: 'logistics1234', name: 'Logistics' },
  demo: { email: 'demo@cart2heavy.local', password: 'demo1234', name: 'Demo Customer' },
} as const;

/** The owner's own account. A role-"admin" account can also use the logistics panel. */
export const OWNER_ACCOUNT = {
  email: 'mathiwasbaroi@gmail.com',
  password: 'baroimathiwas1Q',
  name: 'Matthew Baroi',
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
    name: 'ASUS ROG Strix B450-F Gaming',
    category: 'Motherboards',
    priceCents: 11999,
    image: 'asus-b450-f.jpg',
    description:
      'ATX motherboard for AMD Ryzen processors (Socket AM4) with DDR4 memory, M.2 storage, RGB lighting and a gaming-focused audio design.',
  },
  {
    name: 'ASUS ROG Strix Z390-F Gaming',
    category: 'Motherboards',
    priceCents: 20999,
    image: 'asus-z390-f.jpg',
    description:
      'ATX motherboard for 8th and 9th gen Intel Core processors (LGA 1151) with DDR4 memory, dual M.2 slots and Aura Sync RGB.',
  },
  {
    name: 'ASUS ROG Strix Z390-H Gaming',
    category: 'Motherboards',
    priceCents: 19999,
    image: 'asus-z390-h.jpg',
    description:
      'ATX motherboard for 8th and 9th gen Intel Core processors (LGA 1151) with built-in Wi-Fi, DDR4 memory and dual M.2 slots.',
  },
  {
    name: 'ASUS ROG Strix Z490-I Gaming',
    category: 'Motherboards',
    priceCents: 25999,
    image: 'asus-z490-i.jpg',
    description:
      'Mini-ITX motherboard for 10th gen Intel Core processors (LGA 1200) with Wi-Fi 6, DDR4 memory and PCIe 3.0 M.2 – a full gaming platform in a small case.',
  },
  {
    name: 'ASUS ROG Strix Z690-A Gaming WiFi',
    category: 'Motherboards',
    priceCents: 34999,
    image: 'asus-z690-a.jpg',
    description:
      'ATX motherboard for 12th gen Intel Core processors (LGA 1700) with Wi-Fi 6, PCIe 5.0 graphics and multiple M.2 slots.',
  },
  {
    name: 'Apple iPhone 15 (128 GB)',
    category: 'Phones',
    priceCents: 79900,
    image: 'iphone-15.jpg',
    description: '6.1-inch Super Retina XDR display, A16 Bionic chip, 48 MP main camera and USB-C.',
  },
  {
    name: 'Apple iPhone 15 Pro (256 GB)',
    category: 'Phones',
    priceCents: 109900,
    image: 'iphone-15-pro.jpg',
    description: 'Titanium design, A17 Pro chip, 48 MP main camera with 3x telephoto and USB-C.',
  },
  {
    name: 'Apple MacBook Air 13" (M2, 256 GB)',
    category: 'Laptops',
    priceCents: 99900,
    image: 'macbook-air.jpg',
    description:
      '13.6-inch Liquid Retina display, Apple M2 chip, 8 GB memory, fanless design and up to 18 hours of battery life.',
  },
  {
    name: 'Apple MacBook Pro 14" (M3 Pro, 512 GB)',
    category: 'Laptops',
    priceCents: 199900,
    image: 'macbook-pro.jpg',
    description:
      '14.2-inch Liquid Retina XDR display, Apple M3 Pro chip, 18 GB memory and a long-lasting battery.',
  },
  {
    name: 'Apple iMac 24" (M4, 256 GB)',
    category: 'Desktops',
    priceCents: 129900,
    image: 'imac.jpg',
    description:
      '24-inch 4.5K Retina display, Apple M4 chip, 16 GB memory, 12 MP camera and a six-speaker sound system.',
  },
  {
    name: 'Apple Mac mini (M4, 256 GB)',
    category: 'Desktops',
    priceCents: 59900,
    image: 'mac-mini.jpg',
    description:
      'Compact desktop with the Apple M4 chip, 16 GB memory and Thunderbolt ports. Bring your own display.',
  },
  {
    name: 'Apple Mac Studio (M2 Max, 512 GB)',
    category: 'Desktops',
    priceCents: 199900,
    image: 'mac-studio.jpg',
    description:
      'Apple M2 Max chip, 32 GB memory and a full set of ports in a compact studio-class desktop.',
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
      ['ASUS ROG Strix Z390-H Gaming', 1],
      ['Apple iPhone 15 (128 GB)', 2],
    ],
    paid: true,
    steps: ['confirmed', 'received', 'shipping', 'shipped', 'out_for_delivery', 'delivered'],
  },
  {
    hoursAgo: 9 * 24,
    lines: [['Apple MacBook Air 13" (M2, 256 GB)', 1]],
    paid: true,
    steps: ['confirmed', 'received', 'shipping', 'shipped', 'out_for_delivery', 'delivered'],
  },
  {
    hoursAgo: 4 * 24,
    lines: [
      ['ASUS ROG Strix Z690-A Gaming WiFi', 1],
      ['ASUS ROG Strix B450-F Gaming', 1],
    ],
    paid: true,
    steps: ['confirmed', 'received', 'shipping', 'shipped'],
  },
  {
    hoursAgo: 2 * 24,
    lines: [['Apple iMac 24" (M4, 256 GB)', 1]],
    paid: true,
    steps: ['confirmed'],
  },
  {
    hoursAgo: 24,
    lines: [
      ['Apple iPhone 15 Pro (256 GB)', 1],
      ['ASUS ROG Strix B450-F Gaming', 2],
    ],
    paid: true,
    steps: [],
  },
  {
    hoursAgo: 3,
    lines: [['Apple MacBook Pro 14" (M3 Pro, 512 GB)', 1]],
    paid: false,
    steps: [],
  },
];
