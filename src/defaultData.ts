/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Sale, StoreInfo } from './types';

// Let's create high-quality, beautiful, inline SVG SVG dataURLs for default products:
export const defaultProducts: Product[] = [
  {
    id: 'prod-1',
    nome: 'Caneca Ceramica Oxente Lindona',
    preco: 38.00,
    estoque: 15,
    imagemBase64: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23FBF6EB"/><rect lg="110" x="50" y="60" width="80" height="90" rx="30" fill="%23BD8A14" opacity="0.8"/><rect x="40" y="70" width="100" height="70" rx="15" fill="%23BD8A14"/><circle cx="140" cy="105" r="25" fill="none" stroke="%23BD8A14" stroke-width="12"/><text x="90" y="110" font-family="'Outfit', sans-serif" font-size="14" fill="white" font-weight="bold" text-anchor="middle">Caneca</text></svg>`
  },
  {
    id: 'prod-2',
    nome: 'Chaveiro Acrilico Oxente Festeje',
    preco: 9.90,
    estoque: 42,
    imagemBase64: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23FBF6EB"/><circle cx="100" cy="110" r="45" fill="%23BD8A14" opacity="0.9"/><circle cx="100" cy="110" r="35" fill="white" opacity="0.2"/><circle cx="100" cy="65" r="8" fill="%23E9D5A6"/><line x1="100" y1="40" x2="100" y2="57" stroke="%235C3D21" stroke-width="4"/><circle cx="100" cy="35" r="10" fill="none" stroke="%235C3D21" stroke-width="4"/><text x="100" y="115" font-family="'Outfit', sans-serif" font-size="12" fill="white" font-weight="bold" text-anchor="middle">Chaveiro</text></svg>`
  },
  {
    id: 'prod-3',
    nome: 'Ecobag de Algodão Oxente',
    preco: 28.50,
    estoque: 8,
    imagemBase64: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23FBF6EB"/><path d="M60 40 C60 10, 140 10, 140 40" fill="none" stroke="%23BD8A14" stroke-width="10" stroke-linecap="round"/><rect x="50" y="70" width="100" height="100" rx="10" fill="%23BD8A14"/><text x="100" y="125" font-family="'Outfit', sans-serif" font-size="14" fill="white" font-weight="bold" text-anchor="middle">Ecobag</text></svg>`
  },
  {
    id: 'prod-4',
    nome: 'Almofada Personalizada Festa',
    preco: 45.00,
    estoque: 12,
    imagemBase64: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23FBF6EB"/><rect x="50" y="50" width="100" height="100" rx="20" fill="%23BD8A14" transform="rotate(45 100 100)"/><text x="100" y="105" font-family="'Outfit', sans-serif" font-size="14" fill="white" font-weight="bold" text-anchor="middle">Almofada</text></svg>`
  }
];

export const defaultSales: Sale[] = [
  {
    id: 'sale-1',
    cliente: 'Maria Oliveira',
    produtoId: 'prod-1',
    produtoNome: 'Caneca Ceramica Oxente Lindona',
    precoUn: 38.00,
    quantidade: 2,
    total: 76.00,
    formaPagamento: 'Pix',
    data: new Date(Date.now() - 3600000 * 4).toISOString() // 4 hours ago
  },
  {
    id: 'sale-2',
    cliente: 'Carlos Andrade',
    produtoId: 'prod-2',
    produtoNome: 'Chaveiro Acrilico Oxente Festeje',
    precoUn: 9.90,
    quantidade: 5,
    total: 49.50,
    formaPagamento: 'Dinheiro',
    data: new Date(Date.now() - 3600000 * 2).toISOString() // 2 hours ago
  }
];

export const defaultStoreInfo: StoreInfo = {
  nome: 'OXENTE FESTEJE',
  instagram: '@oxentefesteje',
  telefone: '(81) 99876-5432',
  endereco: 'Recife - PE',
  whatsappTemplate: `Olá, *{cliente}*!

®️ seu pedido está pronto para retirada{pedido}

⚠️ lembrando que fechamos aos sabados ao meio dia

📍 Segue o endereço abaixo

*ENDEREÇO HORÁRIOS & PONTO DE REFERENCIA*:

Rua Josina Lessa Feitosa 176

Mangabeira 1

*Ponto de referência* 

Entrando a direta da Boticário da Av Josefa Taveira, pega a primeira rua à direita.

*🚨Horário  de atendimento e retirada de produtos🚨*

Segunda a Sexta de 8:30h às 12h das 13:00h às 17:00h

Sábados de 8:30h às 12h 

*Fechado aos domingos e feriados*`
};
