import type {
  Branch,
  GstRate,
  Product,
  ProductCategory,
  RawMaterial,
  RawMaterialUnit,
  Recipe,
  Supplier,
  User,
} from '@/types/domain'

// ---------------------------------------------------------------- branches
export interface BranchSeed extends Branch {
  /** average daily revenue (₹) */
  avgDaily: number
}

export const BRANCH_SEEDS: BranchSeed[] = [
  {
    id: 'b-edp', code: 'EDP', name: 'Edappally', area: 'Edappally', city: 'Kochi',
    address: 'NH 66, Edappally Junction, Kochi 682024', phone: '0484 2345101',
    managerName: 'Anjali Menon', openingFloat: 5000, active: true, avgDaily: 62000,
  },
  {
    id: 'b-kkd', code: 'KKD', name: 'Kakkanad (Infopark Rd)', area: 'Kakkanad', city: 'Kochi',
    address: 'Infopark Road, Kakkanad, Kochi 682030', phone: '0484 2345102',
    managerName: 'Rahul Varghese', openingFloat: 4000, active: true, avgDaily: 48000,
  },
  {
    id: 'b-vyt', code: 'VYT', name: 'Vyttila Hub', area: 'Vyttila', city: 'Kochi',
    address: 'Mobility Hub, Vyttila, Kochi 682019', phone: '0484 2345103',
    managerName: 'Fathima Nazar', openingFloat: 4000, active: true, avgDaily: 41000,
  },
  {
    id: 'b-tsr', code: 'TSR', name: 'Swaraj Round', area: 'Thrissur Round', city: 'Thrissur',
    address: 'Swaraj Round, Thrissur 680001', phone: '0487 2345104',
    managerName: 'Joseph Thomas', openingFloat: 5000, active: true, avgDaily: 55000,
  },
  {
    id: 'b-cky', code: 'CKY', name: 'Chalakudy', area: 'Chalakudy', city: 'Thrissur',
    address: 'Main Road, Chalakudy 680307', phone: '0480 2345105',
    managerName: 'Sneha Pillai', openingFloat: 3000, active: true, avgDaily: 28000,
  },
]

export const BRANCHES: Branch[] = BRANCH_SEEDS.map(({ avgDaily: _a, ...b }) => b)

// ------------------------------------------------------------------- users
export const USERS: User[] = [
  { id: 'u-edp', name: 'Anjali Menon', username: 'edappally', role: 'branch', branchId: 'b-edp', passwordHash: null, active: true },
  { id: 'u-kkd', name: 'Rahul Varghese', username: 'kakkanad', role: 'branch', branchId: 'b-kkd', passwordHash: null, active: true },
  { id: 'u-vyt', name: 'Fathima Nazar', username: 'vyttila', role: 'branch', branchId: 'b-vyt', passwordHash: null, active: true },
  { id: 'u-tsr', name: 'Joseph Thomas', username: 'thrissur', role: 'branch', branchId: 'b-tsr', passwordHash: null, active: true },
  { id: 'u-cky', name: 'Sneha Pillai', username: 'chalakudy', role: 'branch', branchId: 'b-cky', passwordHash: null, active: true },
  { id: 'u-ho', name: 'Arun Krishnan', username: 'hoadmin', role: 'ho', passwordHash: null, active: true },
  { id: 'u-prod', name: 'Deepa Raghavan', username: 'production', role: 'ho', passwordHash: null, active: true },
  { id: 'u-ceo', name: 'Navya Mathew', username: 'ceo', role: 'cxo', passwordHash: null, active: true },
]

// ----------------------------------------------------------- raw materials
type RmSeed = { id: string; name: string; unit: RawMaterialUnit; cost: number; supplier: string }

const S = {
  flour: 's-malabar',
  dairy: 's-milma',
  poultry: 's-periyar',
  agro: 's-agro',
  pack: 's-cochin',
  spice: 's-spice',
} as const

export const RM_SEEDS: RmSeed[] = [
  { id: 'rm-maida', name: 'Maida', unit: 'kg', cost: 42, supplier: S.flour },
  { id: 'rm-wheat', name: 'Wheat flour', unit: 'kg', cost: 46, supplier: S.flour },
  { id: 'rm-sugar', name: 'Sugar', unit: 'kg', cost: 44, supplier: S.spice },
  { id: 'rm-icing', name: 'Icing sugar', unit: 'kg', cost: 62, supplier: S.spice },
  { id: 'rm-butter', name: 'Butter', unit: 'kg', cost: 520, supplier: S.dairy },
  { id: 'rm-margarine', name: 'Margarine', unit: 'kg', cost: 190, supplier: S.dairy },
  { id: 'rm-eggs', name: 'Eggs', unit: 'dozen', cost: 96, supplier: S.poultry },
  { id: 'rm-milk', name: 'Milk', unit: 'l', cost: 54, supplier: S.dairy },
  { id: 'rm-cream', name: 'Fresh cream', unit: 'l', cost: 280, supplier: S.dairy },
  { id: 'rm-yeast', name: 'Yeast', unit: 'kg', cost: 380, supplier: S.spice },
  { id: 'rm-cocoa', name: 'Cocoa powder', unit: 'kg', cost: 620, supplier: S.spice },
  { id: 'rm-choc', name: 'Dark compound chocolate', unit: 'kg', cost: 340, supplier: S.spice },
  { id: 'rm-oil', name: 'Vegetable oil', unit: 'l', cost: 140, supplier: S.spice },
  { id: 'rm-coil', name: 'Coconut oil', unit: 'l', cost: 210, supplier: S.spice },
  { id: 'rm-ghee', name: 'Ghee', unit: 'kg', cost: 640, supplier: S.dairy },
  { id: 'rm-chicken', name: 'Chicken', unit: 'kg', cost: 180, supplier: S.poultry },
  { id: 'rm-onion', name: 'Onion', unit: 'kg', cost: 38, supplier: S.agro },
  { id: 'rm-potato', name: 'Potato & vegetables', unit: 'kg', cost: 40, supplier: S.agro },
  { id: 'rm-mushroom', name: 'Mushroom', unit: 'kg', cost: 220, supplier: S.agro },
  { id: 'rm-nendran', name: 'Nendran banana', unit: 'kg', cost: 55, supplier: S.agro },
  { id: 'rm-coconut', name: 'Grated coconut', unit: 'kg', cost: 90, supplier: S.agro },
  { id: 'rm-cashew', name: 'Cashew', unit: 'kg', cost: 780, supplier: S.spice },
  { id: 'rm-raisins', name: 'Raisins', unit: 'kg', cost: 360, supplier: S.spice },
  { id: 'rm-jaggery', name: 'Jaggery', unit: 'kg', cost: 85, supplier: S.agro },
  { id: 'rm-baking', name: 'Baking powder', unit: 'kg', cost: 190, supplier: S.flour },
  { id: 'rm-box', name: 'Packaging boxes', unit: 'pcs', cost: 9, supplier: S.pack },
]

/** Raw materials with placeholder stock; generateSeed sets levels from real consumption. */
export const RAW_MATERIALS: RawMaterial[] = RM_SEEDS.map((r, i) => ({
  id: r.id,
  code: `RM${String(i + 1).padStart(3, '0')}`,
  name: r.name,
  unit: r.unit,
  costPerUnit: r.cost,
  stockQty: 0,
  reorderLevel: 0,
  reorderQty: 0,
  preferredSupplierId: r.supplier,
}))

export const SUPPLIERS: Supplier[] = [
  { id: S.flour, name: 'Malabar Flour Mills', contactPerson: 'K. Abdul Rahman', phone: '0484 2550011', city: 'Kalamassery', gstin: '32AAACM1234F1Z5', materialIds: [], active: true },
  { id: S.dairy, name: 'Milma Dairy Distributor', contactPerson: 'T. R. Suresh', phone: '0484 2360022', city: 'Ernakulam', gstin: '32AABCM5678K1Z2', materialIds: [], active: true },
  { id: S.poultry, name: 'Periyar Poultry', contactPerson: 'Varghese P. J.', phone: '0484 2620033', city: 'Aluva', gstin: '32AAFFP9012L1Z8', materialIds: [], active: true },
  { id: S.agro, name: 'Kerala Agro Fresh', contactPerson: 'Mohanan C.', phone: '0487 2420044', city: 'Thrissur', gstin: '32AAHCK3456M1Z4', materialIds: [], active: true },
  { id: S.pack, name: 'Cochin Packaging Co.', contactPerson: 'Lakshmi Nair', phone: '0484 2670055', city: 'Kochi', gstin: '32AAGCC7890N1Z1', materialIds: [], active: true },
  { id: S.spice, name: 'Spice Coast Traders', contactPerson: 'Shafeeq M.', phone: '0484 2230066', city: 'Mattancherry', gstin: '32AAJFS2345P1Z9', materialIds: [], active: true },
].map((s) => ({ ...s, materialIds: RM_SEEDS.filter((r) => r.supplier === s.id).map((r) => r.id) }))

// ---------------------------------------------------------------- products
type RecipeTemplate =
  | 'bread' | 'bun' | 'creamBun' | 'puffVeg' | 'puffEgg' | 'puffChicken' | 'puffMushroom' | 'roll'
  | 'fried' | 'vada' | 'pazham' | 'unniyappam' | 'cakeCream' | 'cakeChoc' | 'cakePlum' | 'teaCake'
  | 'pastry' | 'pastryChoc' | 'cookie' | 'cookieCoconut' | 'cookieCashew' | 'rusk' | 'halwa'
  | 'laddu' | 'jalebi' | 'mysore' | 'achappam' | 'chips' | 'upperi' | 'mixture'

/** relative ingredient weights per batch — scaled later so cost lands at 35–50% of net price */
const TEMPLATES: Record<RecipeTemplate, [string, number][]> = {
  bread: [['rm-maida', 8], ['rm-wheat', 2], ['rm-sugar', 0.8], ['rm-yeast', 0.15], ['rm-margarine', 0.6], ['rm-milk', 2]],
  bun: [['rm-maida', 9], ['rm-sugar', 1.2], ['rm-yeast', 0.15], ['rm-margarine', 0.8], ['rm-milk', 1.5]],
  creamBun: [['rm-maida', 6], ['rm-sugar', 1.5], ['rm-yeast', 0.12], ['rm-butter', 0.6], ['rm-cream', 1.5], ['rm-icing', 0.5]],
  puffVeg: [['rm-maida', 5], ['rm-margarine', 3], ['rm-potato', 5], ['rm-onion', 1.5], ['rm-oil', 0.5]],
  puffEgg: [['rm-maida', 5], ['rm-margarine', 3], ['rm-eggs', 1.5], ['rm-onion', 1.5], ['rm-oil', 0.5]],
  puffChicken: [['rm-maida', 5], ['rm-margarine', 3], ['rm-chicken', 4], ['rm-onion', 1.5], ['rm-oil', 0.6]],
  puffMushroom: [['rm-maida', 5], ['rm-margarine', 3], ['rm-mushroom', 3], ['rm-onion', 1.5], ['rm-oil', 0.5]],
  roll: [['rm-maida', 4], ['rm-chicken', 4], ['rm-onion', 1.5], ['rm-oil', 1], ['rm-eggs', 0.5]],
  fried: [['rm-maida', 3], ['rm-potato', 4], ['rm-onion', 1.5], ['rm-oil', 1.5]],
  vada: [['rm-wheat', 4], ['rm-onion', 2], ['rm-oil', 2]],
  pazham: [['rm-maida', 3], ['rm-nendran', 6], ['rm-oil', 2], ['rm-sugar', 0.3]],
  unniyappam: [['rm-wheat', 2], ['rm-jaggery', 2], ['rm-nendran', 2], ['rm-coconut', 0.5], ['rm-coil', 1]],
  cakeCream: [['rm-maida', 4], ['rm-sugar', 3], ['rm-eggs', 3], ['rm-butter', 1.5], ['rm-cream', 2], ['rm-baking', 0.1], ['rm-box', 6]],
  cakeChoc: [['rm-maida', 4], ['rm-sugar', 3], ['rm-eggs', 3], ['rm-butter', 1.5], ['rm-cream', 1.5], ['rm-cocoa', 0.8], ['rm-choc', 1], ['rm-baking', 0.1], ['rm-box', 6]],
  cakePlum: [['rm-maida', 4], ['rm-sugar', 3], ['rm-butter', 2], ['rm-eggs', 3], ['rm-raisins', 1.5], ['rm-cashew', 0.8], ['rm-box', 6]],
  teaCake: [['rm-maida', 4], ['rm-sugar', 2.5], ['rm-eggs', 2], ['rm-margarine', 1.5], ['rm-baking', 0.1]],
  pastry: [['rm-maida', 3], ['rm-sugar', 2.5], ['rm-eggs', 2], ['rm-cream', 2], ['rm-butter', 1], ['rm-box', 6]],
  pastryChoc: [['rm-maida', 3], ['rm-sugar', 2.5], ['rm-eggs', 2], ['rm-cream', 1.5], ['rm-cocoa', 0.6], ['rm-choc', 0.8], ['rm-butter', 1], ['rm-box', 6]],
  cookie: [['rm-maida', 6], ['rm-butter', 3], ['rm-sugar', 2.5], ['rm-eggs', 0.5], ['rm-baking', 0.1]],
  cookieCoconut: [['rm-maida', 5], ['rm-butter', 2.5], ['rm-sugar', 2.5], ['rm-coconut', 1.5], ['rm-baking', 0.1]],
  cookieCashew: [['rm-maida', 5], ['rm-butter', 3], ['rm-sugar', 2.5], ['rm-cashew', 1.2], ['rm-baking', 0.1]],
  rusk: [['rm-maida', 8], ['rm-sugar', 1.5], ['rm-margarine', 1], ['rm-yeast', 0.1], ['rm-milk', 1]],
  halwa: [['rm-maida', 3], ['rm-sugar', 5], ['rm-coil', 2], ['rm-ghee', 1], ['rm-cashew', 0.3]],
  laddu: [['rm-ghee', 3], ['rm-sugar', 3], ['rm-cashew', 0.5], ['rm-maida', 2]],
  jalebi: [['rm-maida', 4], ['rm-sugar', 5], ['rm-oil', 3]],
  mysore: [['rm-ghee', 4], ['rm-sugar', 4], ['rm-maida', 2]],
  achappam: [['rm-maida', 3], ['rm-sugar', 1], ['rm-coconut', 1], ['rm-eggs', 1], ['rm-coil', 3]],
  chips: [['rm-nendran', 10], ['rm-coil', 3]],
  upperi: [['rm-nendran', 10], ['rm-jaggery', 3], ['rm-coil', 2]],
  mixture: [['rm-wheat', 3], ['rm-oil', 3], ['rm-cashew', 0.5]],
}

interface ProductSeed {
  slug: string
  name: string
  category: ProductCategory
  price: number
  gst: GstRate
  shelf: number
  tpl: RecipeTemplate
  yieldQty: number
  /** demand weight (units/day weight) */
  w: number
  color: string
}

const C = {
  Breads: '#C98A4B',
  'Puffs & Snacks': '#E0A030',
  Cakes: '#8A4B3A',
  Pastries: '#C86B85',
  'Cookies & Rusk': '#A8743C',
  Sweets: '#D9822B',
  'Chips & Savouries': '#6B8E4E',
} as const

function ps(
  slug: string, name: string, category: ProductCategory, price: number, gst: GstRate, shelf: number,
  tpl: RecipeTemplate, yieldQty: number, w: number,
): ProductSeed {
  return { slug, name, category, price, gst, shelf, tpl, yieldQty, w, color: C[category] }
}

export const PRODUCT_SEEDS: ProductSeed[] = [
  // Breads
  ps('milk-bread', 'Milk Bread 400g', 'Breads', 45, 0, 3, 'bread', 40, 10),
  ps('sandwich-bread', 'Sandwich Bread', 'Breads', 50, 0, 3, 'bread', 40, 8),
  ps('brown-bread', 'Brown Bread', 'Breads', 55, 0, 3, 'bread', 40, 5),
  ps('bun', 'Bun (4 pc)', 'Breads', 30, 0, 3, 'bun', 50, 7),
  ps('fruit-bun', 'Fruit Bun', 'Breads', 15, 0, 3, 'bun', 60, 4),
  ps('pav', 'Pav (6 pc)', 'Breads', 30, 0, 3, 'bun', 50, 6),
  ps('cream-bun', 'Cream Bun (5 pc)', 'Breads', 40, 5, 2, 'creamBun', 50, 6),
  // Puffs & Snacks
  ps('egg-puff', 'Egg Puff', 'Puffs & Snacks', 18, 5, 1, 'puffEgg', 60, 14),
  ps('chicken-puff', 'Chicken Puff', 'Puffs & Snacks', 25, 5, 1, 'puffChicken', 60, 12),
  ps('veg-puff', 'Veg Puff', 'Puffs & Snacks', 15, 5, 1, 'puffVeg', 60, 10),
  ps('mushroom-puff', 'Mushroom Puff', 'Puffs & Snacks', 25, 5, 1, 'puffMushroom', 60, 4),
  ps('chicken-roll', 'Chicken Roll', 'Puffs & Snacks', 30, 5, 1, 'roll', 50, 6),
  ps('meat-roll', 'Meat Roll', 'Puffs & Snacks', 35, 5, 1, 'roll', 50, 3),
  ps('samosa', 'Samosa', 'Puffs & Snacks', 12, 5, 1, 'fried', 80, 9),
  ps('cutlet', 'Cutlet', 'Puffs & Snacks', 15, 5, 1, 'fried', 80, 6),
  ps('pazhampori', 'Pazhampori', 'Puffs & Snacks', 15, 5, 1, 'pazham', 60, 6),
  ps('parippu-vada', 'Parippu Vada', 'Puffs & Snacks', 10, 5, 1, 'vada', 100, 7),
  ps('uzhunnu-vada', 'Uzhunnu Vada', 'Puffs & Snacks', 12, 5, 1, 'vada', 100, 5),
  ps('unniyappam', 'Unniyappam (pack)', 'Puffs & Snacks', 40, 5, 1, 'unniyappam', 40, 4),
  // Cakes
  ps('black-forest', 'Black Forest Cake 500g', 'Cakes', 520, 5, 3, 'cakeChoc', 12, 3),
  ps('white-forest', 'White Forest Cake 500g', 'Cakes', 540, 5, 3, 'cakeCream', 12, 2.5),
  ps('red-velvet', 'Red Velvet Cake 500g', 'Cakes', 620, 5, 3, 'cakeCream', 12, 2),
  ps('choc-truffle', 'Chocolate Truffle Cake 500g', 'Cakes', 650, 5, 3, 'cakeChoc', 12, 2),
  ps('butterscotch', 'Butterscotch Cake 500g', 'Cakes', 480, 5, 3, 'cakeCream', 12, 2.5),
  ps('plum-cake', 'Kerala Plum Cake 400g', 'Cakes', 280, 5, 30, 'cakePlum', 20, 2),
  ps('tea-cake', 'Tea Cake Slice', 'Cakes', 25, 5, 3, 'teaCake', 60, 5),
  // Pastries
  ps('pastry-pineapple', 'Pineapple Pastry', 'Pastries', 55, 5, 2, 'pastry', 30, 5),
  ps('pastry-bf', 'Black Forest Pastry', 'Pastries', 60, 5, 2, 'pastryChoc', 30, 4),
  ps('pastry-choc', 'Chocolate Pastry', 'Pastries', 65, 5, 2, 'pastryChoc', 30, 4),
  ps('pastry-butterscotch', 'Butterscotch Pastry', 'Pastries', 60, 5, 2, 'pastry', 30, 3.5),
  ps('pastry-rv', 'Red Velvet Pastry', 'Pastries', 75, 5, 2, 'pastry', 30, 3),
  // Cookies & Rusk
  ps('rusk', 'Rusk (200g)', 'Cookies & Rusk', 60, 5, 60, 'rusk', 40, 4),
  ps('butter-biscuit', 'Butter Biscuit', 'Cookies & Rusk', 80, 5, 45, 'cookie', 30, 3),
  ps('coconut-cookies', 'Coconut Cookies', 'Cookies & Rusk', 90, 5, 45, 'cookieCoconut', 30, 2.5),
  ps('nankhatai', 'Nankhatai', 'Cookies & Rusk', 100, 5, 30, 'cookie', 30, 2),
  ps('cashew-cookies', 'Cashew Cookies', 'Cookies & Rusk', 140, 5, 30, 'cookieCashew', 30, 2),
  // Sweets
  ps('halwa-black', 'Kozhikodan Halwa (Black)', 'Sweets', 400, 5, 15, 'halwa', 20, 1.2),
  ps('halwa-red', 'Kozhikodan Halwa (Red)', 'Sweets', 380, 5, 15, 'halwa', 20, 1.2),
  ps('laddu', 'Laddu', 'Sweets', 20, 5, 7, 'laddu', 80, 3),
  ps('jalebi', 'Jalebi (pack)', 'Sweets', 60, 5, 7, 'jalebi', 40, 2.5),
  ps('mysore-pak', 'Mysore Pak (250g)', 'Sweets', 120, 5, 15, 'mysore', 30, 2),
  ps('achappam', 'Achappam (pack)', 'Sweets', 90, 5, 15, 'achappam', 30, 2),
  // Chips & Savouries
  ps('banana-chips', 'Banana Chips 200g', 'Chips & Savouries', 90, 5, 30, 'chips', 40, 3),
  ps('jackfruit-chips', 'Jackfruit Chips 200g', 'Chips & Savouries', 130, 5, 30, 'chips', 40, 1.5),
  ps('sharkara-upperi', 'Sharkara Upperi 200g', 'Chips & Savouries', 120, 5, 30, 'upperi', 40, 2),
  ps('mixture', 'Kerala Mixture 200g', 'Chips & Savouries', 100, 5, 30, 'mixture', 40, 2),
]

export const PRODUCTS: Product[] = PRODUCT_SEEDS.map((p, i) => ({
  id: `p-${p.slug}`,
  sku: `NB-${String(i + 1).padStart(3, '0')}`,
  name: p.name,
  category: p.category,
  price: p.price,
  gstRate: p.gst,
  shelfLifeDays: p.shelf,
  active: true,
  color: p.color,
}))

/** Demand weight per productId (units/day weight, relative). */
export const DEMAND_WEIGHT: Record<string, number> = Object.fromEntries(
  PRODUCT_SEEDS.map((p) => [`p-${p.slug}`, p.w]),
)

/** Recipes scaled so unit cost lands at 35–50% of net (ex-GST) price. */
export const RECIPES: Recipe[] = PRODUCT_SEEDS.map((p, i) => {
  const tpl = TEMPLATES[p.tpl]
  const costOf = (id: string) => RM_SEEDS.find((r) => r.id === id)?.cost ?? 0
  const raw = tpl.reduce((s, [id, q]) => s + q * costOf(id), 0)
  const net = p.price / (1 + p.gst / 100)
  const ratio = 0.35 + ((i * 7) % 16) / 100 // deterministic 0.35 … 0.50
  const scale = (ratio * net * p.yieldQty) / raw
  return {
    productId: `p-${p.slug}`,
    yieldQty: p.yieldQty,
    ingredients: tpl.map(([rawMaterialId, q]) => ({
      rawMaterialId,
      qty: Math.max(0.001, Math.round(q * scale * 1000) / 1000),
    })),
  }
})

export const DEFAULT_SETTINGS = {
  companyName: 'Navya Bakers',
  indentCutoffTime: '20:00',
  nearExpiryDays: 1,
  wastageAlertPct: 6,
  salesDropAlertPct: 15,
  cashVarianceAlert: 500,
  transitAlertHours: 4,
}
