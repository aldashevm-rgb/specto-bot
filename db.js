import fs from "fs";

const DB_FILE = "./orders.json";

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

export function saveOrder(order) {
  const orders = getOrders();
  order.id = Date.now();
  orders.push(order);
  fs.writeFileSync(DB_FILE, JSON.stringify(orders, null, 2));
}

export function getOrders() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch {
    return [];
  }
}
