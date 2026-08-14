/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PricingTier {
  quantidadeMinima: number;
  preco: number;
}

export interface ProductColor {
  nome: string;
  estoque: number;
}

export interface Product {
  id: string;
  nome: string;
  preco: number;
  estoque: number;
  cores?: ProductColor[]; // Supports individual stock counts per color
  imagemBase64?: string; // Stored as data URL (base64) for robust local storage persistence
  estoqueInfinito?: boolean;
  precoCusto?: number;
  faixasPreco?: PricingTier[];
  adicional?: boolean;
  conferido?: boolean;
  prazoUrgencia?: number;
  linkedProductId?: string;
}

export type PaymentMethod = 'Pix' | 'Dinheiro' | 'Cartão de Crédito' | 'Cartão de Débito';

export interface SaleItem {
  id: string; // unique identifier or product ID
  produtoId: string;
  produtoNome: string;
  precoUn: number;
  quantidade: number;
  total: number;
  corSelecionada?: string; // Optional track color chosen for this item
  custoUn?: number; // Historical unit cost snapshot
}

export interface SaleOriginalValues {
  cliente: string;
  telefoneCliente?: string;
  produtoNome: string;
  total: number;
  formaPagamento: PaymentMethod;
  valorPago?: number;
  valorFaltante?: number;
  numeroPedido?: string;
  statusProducao?: 'Agendado' | 'Em Produção' | 'Pronto para Retirada' | 'Agendado para Entrega' | 'Entregue';
  itens?: SaleItem[];
  notasInternas?: string;
  turnoEntrega?: 'Manhã' | 'Tarde';
  pedidoVinculoNumero?: string;
  corSelecionada?: string;
}

export interface Sale {
  id: string;
  cliente: string;
  telefoneCliente?: string;
  produtoId: string;
  produtoNome: string;
  precoUn: number;
  quantidade: number;
  total: number;
  formaPagamento: PaymentMethod;
  data: string; // ISO datetime string
  valorPago?: number;
  valorFaltante?: number;
  numeroPedido?: string;
  status?: 'Pendente' | 'Concluído' | 'Pago total' | 'Orçamento';
  itens?: SaleItem[];
  criadoPorEmail?: string;
  dataRetirada?: string; // Format YYYY-MM-DD
  statusProducao?: 'Agendado' | 'Em Produção' | 'Pronto para Retirada' | 'Agendado para Entrega' | 'Entregue';
  designerId?: 'designer1' | 'designer2' | null;
  statusArte?: 'Pendente' | 'Arte Finalizada';
  puxadoPor?: string;
  puxadoEm?: string;
  observacoesDesign?: string;
  foiAlterado?: boolean;
  removerDoDesign?: boolean;
  editadoPorEmail?: string;
  editadoEm?: string;
  arteFinalizadaPorEmail?: string;
  arteFinalizadaEm?: string;
  valoresOriginais?: SaleOriginalValues;
  notasInternas?: string;
  pedidoAnotado?: boolean;
  avisoProntoSended?: boolean;
  valorPagoAntesConcluir?: number;
  valorFaltanteAntesConcluir?: number;
  statusProducaoAntesConcluir?: 'Agendado' | 'Em Produção' | 'Pronto para Retirada' | 'Agendado para Entrega' | 'Entregue';
  turnoEntrega?: 'Manhã' | 'Tarde';
  referralCode?: string;
  indicadoCodigo?: string;
  descontoReferral?: number;
  cashbackGasto?: number;
  referralSended?: boolean;
  updatedAt?: string;
  pendingSync?: boolean;
  bloqueadoLembrete?: boolean;
  dataAvisoAtraso?: string; // Format YYYY-MM-DD when delayed reminder was sent
  pedidoVinculoNumero?: string;
  corSelecionada?: string;
}

export interface StoreInfo {
  nome: string;
  instagram: string;
  telefone: string;
  endereco: string;
  whatsappTemplate?: string;
}

export interface InstagramPost {
  id: string | number;
  imageUrl: string;
  likes: string;
  comments: number;
  caption: string;
  tag: string;
  link: string;
  categoria?: string;
  createdAt?: string;
}

export function getProductUnitPrice(product: Product, quantity: number): number {
  let price = product.preco || 0;
  if (product.faixasPreco && product.faixasPreco.length > 0) {
    // Default to the tier with the lowest minimum quantity
    let lowestMinQtyTier = product.faixasPreco[0];
    for (const f of product.faixasPreco) {
      if (f.quantidadeMinima < lowestMinQtyTier.quantidadeMinima) {
        lowestMinQtyTier = f;
      }
    }
    price = lowestMinQtyTier.preco;

    let highestMinQty = 0;
    for (const f of product.faixasPreco) {
      if (quantity >= f.quantidadeMinima && f.quantidadeMinima > highestMinQty) {
        price = f.preco;
        highestMinQty = f.quantidadeMinima;
      }
    }
  }
  return price;
}

export function getProductUnitCost(product: Product, unitPrice: number): number {
  if (product.precoCusto !== undefined && product.precoCusto !== null && !isNaN(product.precoCusto)) {
    return product.precoCusto;
  }
  const baseCatalogPrice = product.preco || (product.faixasPreco && product.faixasPreco.length > 0 ? product.faixasPreco[0].preco : unitPrice);
  return baseCatalogPrice * 0.62; // fallback based on catalog base price when cost is not configured
}

function normalizeStr(str: string): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents
    .toLowerCase()
    .replace(/^adicional:\s*/i, '')
    .replace(/[^a-z0-9]/g, ' ') // remove special chars
    .replace(/\s+/g, ' ')
    .trim();
}

export function findMatchingProduct(
  produtoId: string | undefined,
  produtoNome: string | undefined,
  products: Product[]
): Product | undefined {
  if (!products || products.length === 0) return undefined;

  // 1. Direct ID match
  if (produtoId && !produtoId.startsWith('avulso-') && produtoId !== 'produto-avulso') {
    const directMatch = products.find(p => p.id === produtoId);
    if (directMatch) return directMatch;
  }

  if (!produtoNome) return undefined;
  const normItemName = normalizeStr(produtoNome);
  if (!normItemName) return undefined;

  // 2. Exact normalized name match
  const exactNameMatch = products.find(p => normalizeStr(p.nome) === normItemName);
  if (exactNameMatch) return exactNameMatch;

  // 3. Substring name match (e.g. "Taça de Gin 500ml" vs "Taça de Gin")
  const partialMatch = products.find(p => {
    const normProdName = normalizeStr(p.nome);
    if (!normProdName) return false;
    return normProdName.includes(normItemName) || normItemName.includes(normProdName);
  });
  if (partialMatch) return partialMatch;

  // 4. Overlap scoring match (finds best candidate sharing key words)
  const STOP_WORDS = new Set(['de', 'da', 'do', 'dos', 'das', 'com', 'para', 'por', 'sem', 'em', 'a', 'o', 'e', 'ou', 'no', 'na']);
  const itemWords = normItemName
    .split(' ')
    .filter(w => w.length > 2 && !STOP_WORDS.has(w));

  if (itemWords.length > 0) {
    let bestMatch: Product | undefined = undefined;
    let maxScore = 0;

    for (const p of products) {
      const normProdName = normalizeStr(p.nome);
      if (!normProdName) continue;
      
      const prodWords = new Set(
        normProdName
          .split(' ')
          .filter(w => w.length > 2 && !STOP_WORDS.has(w))
      );

      let score = 0;
      for (const w of itemWords) {
        if (prodWords.has(w) || normProdName.includes(w)) {
          score += 1;
        }
      }

      if (score > maxScore) {
        maxScore = score;
        bestMatch = p;
      }
    }

    if (bestMatch && maxScore >= 1) {
      return bestMatch;
    }
  }

  return undefined;
}

function parseToBrazilDateString(dateVal: any): string {
  if (!dateVal) return '';
  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return '';
    return dateVal.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  }
  const str = String(dateVal).trim();
  let d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  }
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brMatch) {
    const day = brMatch[1].padStart(2, '0');
    const month = brMatch[2].padStart(2, '0');
    const year = brMatch[3];
    d = new Date(`${year}-${month}-${day}T12:00:00`);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    }
  }
  return '';
}

export function calculateSaleItemUnitCost(
  item: { produtoId?: string; produtoNome?: string; nome?: string; precoUn: number; custoUn?: number },
  saleDateStr: string,
  products: Product[]
): number {
  if (item.produtoId === 'taxacartao-service') {
    return item.precoUn;
  }
  const isService = item.produtoId?.endsWith('-service');
  if (isService) {
    return 0;
  }

  // 1. If item has a custom/historical custoUn explicitly saved on it (e.g. custom avulso cost or specific product cost)
  if (item.custoUn !== undefined && item.custoUn !== null && !isNaN(item.custoUn) && item.custoUn >= 0) {
    return item.custoUn;
  }

  const nameToMatch = item.produtoNome || item.nome;
  const matchingProduct = findMatchingProduct(item.produtoId, nameToMatch, products);

  if (matchingProduct) {
    // 2. If matching product in catalog has an explicit precoCusto configured:
    if (matchingProduct.precoCusto !== undefined && matchingProduct.precoCusto !== null && !isNaN(matchingProduct.precoCusto)) {
      return matchingProduct.precoCusto;
    }
    // 3. If matching product in catalog has a base catalog price, estimate unit cost from the CATALOG base price
    // (so that discounts or edited sale prices do not distort physical product unit cost)
    const baseCatalogPrice = matchingProduct.preco || (matchingProduct.faixasPreco && matchingProduct.faixasPreco.length > 0 ? matchingProduct.faixasPreco[0].preco : 0);
    if (baseCatalogPrice > 0) {
      return baseCatalogPrice * 0.62;
    }
  }

  // Fallback for avulso / uncataloged items if no custom cost was set
  return item.precoUn * 0.62;
}
