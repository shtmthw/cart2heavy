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
    name: 'MSI MAG B760 TOMAHAWK WIFI',
    category: 'Motherboards',
    priceCents: 21999,
    image: 'msi-mag.jpg',
    description:
      'ATX motherboard for 12th–14th gen Intel Core (LGA 1700) with DDR5 memory, PCIe 5.0 x16, Wi-Fi 6E and a solid heatsink design. A dependable base for a gaming build.',
  },
  {
    name: 'MSI MPG B650 CARBON WIFI',
    category: 'Motherboards',
    priceCents: 29999,
    image: 'msi-mpg.jpg',
    description:
      'ATX motherboard for AMD Ryzen 7000 and 8000 series (AM5) with DDR5, PCIe 5.0 M.2, Wi-Fi 6E and 2.5G LAN.',
  },
  {
    name: 'MSI MPG X670E CARBON WIFI',
    category: 'Motherboards',
    priceCents: 48999,
    image: 'msi-x670.jpg',
    description:
      'High-end AM5 board for Ryzen 7000 and 8000 series with PCIe 5.0 graphics and storage, DDR5, Wi-Fi 6E and 2.5G LAN.',
  },
  {
    name: 'MSI MEG Z790 ACE',
    category: 'Motherboards',
    priceCents: 69999,
    image: 'msi-meg-ace.jpg',
    description:
      'Enthusiast LGA 1700 board with a 24+1+1 phase power design, DDR5 overclocking support, 10G and 2.5G LAN and Wi-Fi 6E.',
  },
  {
    name: 'MSI MEG Z790 GODLIKE',
    category: 'Motherboards',
    priceCents: 109999,
    image: 'msi-meg-godlike.jpg',
    description:
      'Flagship E-ATX board for Intel LGA 1700: top-tier power delivery, 10G LAN, Wi-Fi 6E and PCIe 5.0 storage.',
  },
  {
    name: 'Apple iPhone 15 (128 GB)',
    category: 'Phones',
    priceCents: 79900,
    image: 'smartphone.jpg',
    description: '6.1-inch Super Retina XDR display, A16 Bionic chip, 48 MP main camera and USB-C.',
  },
  {
    name: 'Apple iPhone 15 Pro (256 GB)',
    category: 'Phones',
    priceCents: 109900,
    image: 'smartphone.jpg',
    description: 'Titanium design, A17 Pro chip, 48 MP main camera with 3x telephoto and USB-C.',
  },
  {
    name: 'Apple MacBook Air 13" (M3, 256 GB)',
    category: 'Laptops',
    priceCents: 109900,
    image: 'laptop.jpg',
    description:
      '13.6-inch Liquid Retina display, Apple M3 chip, 8 GB memory, fanless and up to 18 hours of battery life.',
  },
  {
    name: 'Apple MacBook Pro 14" (M3 Pro, 512 GB)',
    category: 'Laptops',
    priceCents: 199900,
    image: 'laptop.jpg',
    description:
      '14.2-inch Liquid Retina XDR display, Apple M3 Pro chip, 18 GB memory and a long-lasting battery.',
  },
  {
    name: 'Apple iMac 24" (M3, 256 GB)',
    category: 'Desktops',
    priceCents: 129900,
    image: 'desktop.jpg',
    description:
      '24-inch 4.5K Retina display, Apple M3 chip, 8 GB memory, 1080p camera and a six-speaker sound system.',
  },
  {
    name: 'Apple Mac mini (M2 Pro, 512 GB)',
    category: 'Desktops',
    priceCents: 129900,
    image: 'desktop.jpg',
    description:
      'Compact desktop with the Apple M2 Pro chip, 16 GB memory and Thunderbolt 4. Bring your own display.',
  },
  {
    name: 'Apple Mac Studio (M2 Max, 512 GB)',
    category: 'Desktops',
    priceCents: 199900,
    image: 'desktop.jpg',
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
      ['MSI MPG B650 CARBON WIFI', 1],
      ['Apple iPhone 15 (128 GB)', 2],
    ],
    paid: true,
    steps: ['confirmed', 'received', 'shipping', 'shipped', 'out_for_delivery', 'delivered'],
  },
  {
    hoursAgo: 9 * 24,
    lines: [['Apple MacBook Air 13" (M3, 256 GB)', 1]],
    paid: true,
    steps: ['confirmed', 'received', 'shipping', 'shipped', 'out_for_delivery', 'delivered'],
  },
  {
    hoursAgo: 4 * 24,
    lines: [
      ['MSI MEG Z790 ACE', 1],
      ['MSI MAG B760 TOMAHAWK WIFI', 1],
    ],
    paid: true,
    steps: ['confirmed', 'received', 'shipping', 'shipped'],
  },
  {
    hoursAgo: 2 * 24,
    lines: [['Apple iMac 24" (M3, 256 GB)', 1]],
    paid: true,
    steps: ['confirmed'],
  },
  {
    hoursAgo: 24,
    lines: [
      ['Apple iPhone 15 Pro (256 GB)', 1],
      ['MSI MAG B760 TOMAHAWK WIFI', 2],
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
