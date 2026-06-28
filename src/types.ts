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
  if (!product.faixasPreco || product.faixasPreco.length === 0) {
    return product.preco;
  }
  let price = product.preco;
  let highestMinQty = 0;
  for (const f of product.faixasPreco) {
    if (quantity >= f.quantidadeMinima && f.quantidadeMinima > highestMinQty) {
      price = f.preco;
      highestMinQty = f.quantidadeMinima;
    }
  }
  return price;
}
