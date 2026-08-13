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
  if (product.precoCusto === undefined || product.precoCusto === null) {
    return unitPrice * 0.62; // fallback
  }
  
  // If the product has progressive prices, let's find the lowest minimum quantity
  if (product.faixasPreco && product.faixasPreco.length > 0) {
    let lowestMinQty = product.faixasPreco[0].quantidadeMinima;
    for (const f of product.faixasPreco) {
      if (f.quantidadeMinima < lowestMinQty) {
        lowestMinQty = f.quantidadeMinima;
      }
    }
    
    // If the registered precoCusto is higher than or equal to the selling unitPrice,
    // it's definitely a batch cost! We divide it by the lowestMinQty to get the unit cost.
    if (lowestMinQty > 1 && product.precoCusto >= unitPrice) {
      return product.precoCusto / lowestMinQty;
    }
  }
  
  return product.precoCusto;
}

export function calculateSaleItemUnitCost(
  item: { produtoId?: string; precoUn: number; custoUn?: number },
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

  const todayStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  let saleDateFormatted = '';
  try {
    const saleDateObj = new Date(saleDateStr);
    if (!isNaN(saleDateObj.getTime())) {
      saleDateFormatted = saleDateObj.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
    }
  } catch (err) {
    console.error(err);
  }

  const isToday = saleDateFormatted !== '' && saleDateFormatted === todayStr;
  const matchingProduct = products.find(p => p.id === item.produtoId);

  // If sale was registered TODAY, use the current cost price from the catalog (if matched),
  // so that cost price changes made TODAY immediately update TODAY's sales profit!
  if (isToday) {
    if (matchingProduct) {
      return getProductUnitCost(matchingProduct, item.precoUn);
    }
    return item.custoUn !== undefined ? item.custoUn : item.precoUn * 0.62;
  }

  // For PREVIOUS DAYS, prefer historical custoUn snapshot saved on the item
  if (item.custoUn !== undefined) {
    return item.custoUn;
  }

  // Fallback for older sales made before custoUn was recorded
  if (matchingProduct) {
    return getProductUnitCost(matchingProduct, item.precoUn);
  }

  return item.precoUn * 0.62;
}
