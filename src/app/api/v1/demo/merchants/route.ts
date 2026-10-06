import { NextResponse } from 'next/server';

export async function GET() {
  const merchants = [
    { name: 'Swiggy', category: 'Food Delivery', defaultAmount: 34000, icon: 'Utensils' },
    { name: 'Zomato', category: 'Food Delivery', defaultAmount: 48500, icon: 'Utensils' },
    { name: 'BigBasket', category: 'Groceries', defaultAmount: 245000, icon: 'ShoppingBag' },
    { name: 'Blinkit', category: 'Groceries', defaultAmount: 56000, icon: 'ShoppingBag' },
    { name: 'DMart', category: 'Groceries', defaultAmount: 389000, icon: 'ShoppingBag' },
    { name: 'Amazon', category: 'Shopping', defaultAmount: 189900, icon: 'ShoppingCart' },
    { name: 'Flipkart', category: 'Shopping', defaultAmount: 125000, icon: 'ShoppingCart' },
    { name: 'Myntra', category: 'Shopping', defaultAmount: 220000, icon: 'ShoppingCart' },
    { name: 'Uber', category: 'Transport', defaultAmount: 18500, icon: 'Car' },
    { name: 'Ola', category: 'Transport', defaultAmount: 12000, icon: 'Car' },
    { name: 'IRCTC', category: 'Travel', defaultAmount: 84000, icon: 'Plane' },
    { name: 'Starbucks India', category: 'Dining Out', defaultAmount: 42000, icon: 'Coffee' },
    { name: 'Blue Tokai', category: 'Dining Out', defaultAmount: 28000, icon: 'Coffee' },
    { name: 'Third Wave Coffee', category: 'Dining Out', defaultAmount: 31000, icon: 'Coffee' },
    { name: 'Croma', category: 'Electronics', defaultAmount: 450000, icon: 'Tv' },
    { name: 'Apollo Pharmacy', category: 'Health', defaultAmount: 65000, icon: 'Activity' },
    { name: 'BookMyShow', category: 'Entertainment', defaultAmount: 70000, icon: 'Film' },
    { name: 'PVR Inox', category: 'Entertainment', defaultAmount: 95000, icon: 'Film' },
    { name: 'Jio Prepaid', category: 'Mobile & Internet', defaultAmount: 29900, icon: 'Smartphone' },
    { name: 'Airtel Fiber', category: 'Mobile & Internet', defaultAmount: 99900, icon: 'Smartphone' },
  ];

  return NextResponse.json({ merchants });
}
