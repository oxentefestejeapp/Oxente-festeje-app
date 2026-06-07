/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, DragEvent, ChangeEvent } from 'react';
import { Trash2, Search, Plus, Minus, AlertTriangle, PackageOpen, Tag, Box, Check, X, Pencil, Upload, Loader2, Sparkles, AlertCircle, Layers } from 'lucide-react';
import { Product, PricingTier } from '../types';

// Client-side image compression using HTML5 Canvas to keep Base64 strings tiny (~30KB-50KB)
const compressImage = (file: File, maxWidth = 480, maxHeight = 480, quality = 0.6): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Keep aspect ratio
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string || '');
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => {
        reject(new Error('Erro ao processar imagem para compressão. Verifique o formato.'));
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
};

interface StockManagerProps {
  products: Product[];
  onUpdateStock: (id: string, newStock: number, isInfinite?: boolean) => void;
  onDeleteProduct: (id: string) => void;
  onUpdateProduct?: (updatedProduct: Product) => Promise<boolean>;
  isAdmin?: boolean;
}

export function StockManager({ products, onUpdateStock, onDeleteProduct, onUpdateProduct, isAdmin = false }: StockManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [editedStocks, setEditedStocks] = useState<Record<string, number>>({});
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);

  const scrollToProduct = (id: string) => {
    setSearchTerm('');
    setTimeout(() => {
      const element = document.getElementById(`product-card-${id}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedProductId(id);
        setTimeout(() => {
          setHighlightedProductId(null);
        }, 3000);
      }
    }, 100);
  };

  // Edit Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editPreco, setEditPreco] = useState<number | ''>('');
  const [editPrecoCusto, setEditPrecoCusto] = useState<number | ''>('');
  const [editEstoque, setEditEstoque] = useState<number | ''>('');
  const [editEstoqueInfinito, setEditEstoqueInfinito] = useState(false);
  const [editPhoto, setEditPhoto] = useState<string>('');
  const [editDragActive, setEditDragActive] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [isEditCompressing, setIsEditCompressing] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);
  
  // Progressive Pricing Tiers State for Edit
  const [editFaixasPreco, setEditFaixasPreco] = useState<PricingTier[]>([]);
  const [editNovaQuantidadeMinima, setEditNovaQuantidadeMinima] = useState<number | ''>('');
  const [editNovoPrecoFaixa, setEditNovoPrecoFaixa] = useState<number | ''>('');
  
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenEditModal = (product: Product) => {
    setEditingProduct(product);
    setEditNome(product.nome);
    setEditPreco(product.preco);
    setEditPrecoCusto(product.precoCusto !== undefined ? product.precoCusto : '');
    setEditEstoque(product.estoque);
    setEditEstoqueInfinito(!!product.estoqueInfinito);
    setEditPhoto(product.imagemBase64 || '');
    setEditFaixasPreco(product.faixasPreco ? [...product.faixasPreco] : []);
    setEditNovaQuantidadeMinima('');
    setEditNovoPrecoFaixa('');
    setEditError('');
    setEditSuccess('');
  };

  const handleAddEditFaixa = () => {
    if (editNovaQuantidadeMinima === '' || editNovoPrecoFaixa === '') {
      setEditError('Por favor, informe a quantidade mínima e o preço da faixa.');
      return;
    }
    const qMin = Number(editNovaQuantidadeMinima);
    const pFaixa = Number(editNovoPrecoFaixa);
    if (isNaN(qMin) || qMin <= 0) {
      setEditError('A quantidade mínima deve ser maior que zero.');
      return;
    }
    if (isNaN(pFaixa) || pFaixa <= 0) {
      setEditError('O preço para a faixa deve ser maior que zero.');
      return;
    }
    
    if (editFaixasPreco.some(f => f.quantidadeMinima === qMin)) {
      setEditError(`Já existe um valor configurado para a quantidade mínima de ${qMin}.`);
      return;
    }

    const updated = [...editFaixasPreco, { quantidadeMinima: qMin, preco: pFaixa }]
      .sort((a, b) => a.quantidadeMinima - b.quantidadeMinima);

    setEditFaixasPreco(updated);
    setEditNovaQuantidadeMinima('');
    setEditNovoPrecoFaixa('');
    setEditError('');
  };

  const handleRemoveEditFaixa = (index: number) => {
    const updated = editFaixasPreco.filter((_, i) => i !== index);
    setEditFaixasPreco(updated);
  };

  const processEditFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setEditError('Por favor, selecione apenas arquivos de imagem.');
      return;
    }

    setIsEditCompressing(true);
    setEditError('');
    try {
      const compressedBase64 = await compressImage(file);
      setEditPhoto(compressedBase64);
    } catch (err: any) {
      console.error('Erro de compressão de imagem de edição:', err);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setEditPhoto(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsEditCompressing(false);
    }
  };

  const handleEditDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setEditDragActive(true);
    } else if (e.type === "dragleave") {
      setEditDragActive(false);
    }
  };

  const handleEditDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processEditFile(e.dataTransfer.files[0]);
    }
  };

  const handleEditFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processEditFile(e.target.files[0]);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditSaving || isEditCompressing || !editingProduct) return;

    setEditError('');
    setEditSuccess('');

    if (!editNome.trim()) {
      setEditError('O nome do produto é obrigatório.');
      return;
    }

    const precoNum = Number(editPreco);
    if (editPreco === '' || isNaN(precoNum) || precoNum < 0) {
      setEditError('Digite um preço de venda válido.');
      return;
    }

    const precoCustoNum = editPrecoCusto !== '' ? Number(editPrecoCusto) : undefined;
    if (precoCustoNum !== undefined && (isNaN(precoCustoNum) || precoCustoNum < 0)) {
      setEditError('Digite um preço de custo válido.');
      return;
    }

    const estoqueNum = editEstoqueInfinito ? 0 : Number(editEstoque);
    if (!editEstoqueInfinito && (editEstoque === '' || isNaN(estoqueNum) || estoqueNum < 0)) {
      setEditError('O estoque precisa ser maior ou igual a zero.');
      return;
    }

    const updatedProduct: Product = {
      ...editingProduct,
      nome: editNome.trim(),
      preco: precoNum,
      precoCusto: precoCustoNum,
      estoque: Math.floor(estoqueNum),
      imagemBase64: editPhoto || undefined,
      estoqueInfinito: editEstoqueInfinito || undefined,
      faixasPreco: editFaixasPreco.length > 0 ? editFaixasPreco : undefined,
    };

    setIsEditSaving(true);
    try {
      if (onUpdateProduct) {
        const success = await onUpdateProduct(updatedProduct);
        if (success) {
          setEditSuccess('Produto atualizado e sincronizado na nuvem com sucesso!');
          setTimeout(() => {
            setEditingProduct(null);
          }, 1500);
        } else {
          setEditError('Erro ao salvar as alterações no banco de dados.');
        }
      } else {
        setEditError('Ação de atualização indisponível no momento.');
      }
    } catch (err: any) {
      console.error('Erro de salvamento de produto editado:', err);
      setEditError(`Erro ao salvar produto: ${err?.message || String(err)}`);
    } finally {
      setIsEditSaving(false);
    }
  };

  const stockMetrics = useMemo(() => {
    let totalStockVolume = 0;
    let totalStockCostValue = 0;
    let totalStockRetailValue = 0;
    let outOfStockCount = 0;
    let lowStockCount = 0;

    products.forEach(p => {
      if (p.estoqueInfinito) return;
      totalStockVolume += p.estoque;
      const c = p.precoCusto !== undefined ? p.precoCusto : (p.preco * 0.6);
      totalStockCostValue += p.estoque * c;
      totalStockRetailValue += p.estoque * p.preco;

      if (p.estoque === 0) {
        outOfStockCount++;
      } else if (p.estoque < 10) {
        lowStockCount++;
      }
    });

    const expectedMarkup = totalStockCostValue > 0 ? ((totalStockRetailValue - totalStockCostValue) / totalStockCostValue) * 100 : 0;

    return {
      totalStockVolume,
      totalStockCostValue,
      totalStockRetailValue,
      outOfStockCount,
      lowStockCount,
      expectedMarkup
    };
  }, [products]);

  const filteredProducts = products.filter(product =>
    product.nome.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStockChange = (id: string, currentStock: number, value: string) => {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setEditedStocks(prev => ({ ...prev, [id]: parsed }));
    } else if (value === '') {
      setEditedStocks(prev => ({ ...prev, [id]: 0 }));
    }
  };

  const handleIncrement = (id: string, currentStock: number) => {
    const active = editedStocks[id] !== undefined ? editedStocks[id] : currentStock;
    setEditedStocks(prev => ({ ...prev, [id]: active + 1 }));
  };

  const handleDecrement = (id: string, currentStock: number) => {
    const active = editedStocks[id] !== undefined ? editedStocks[id] : currentStock;
    if (active > 0) {
      setEditedStocks(prev => ({ ...prev, [id]: active - 1 }));
    }
  };

  return (
    <div className="space-y-6">

      {/* 📊 STOCK ANALYTICS INDICATORS BAR */}
      {isAdmin && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Total Pieces */}
          <div className="bg-zinc-900 border border-zinc-850 p-4.5 rounded-2xl shadow-xs">
            <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider block">Volume total no físico</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-black text-zinc-150 font-mono">{stockMetrics.totalStockVolume}</span>
              <span className="text-xs text-zinc-450 font-medium">unidades</span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">Exclui brindes com estoque ilimitado</p>
          </div>

          {/* Investment valuation cost estimation */}
          <div className="bg-zinc-900 border border-zinc-850 p-4.5 rounded-2xl shadow-xs">
            <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider block">Custo de Aquisição Estimado</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-black text-brand-pink font-mono">R$ {stockMetrics.totalStockCostValue.toFixed(2)}</span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">Estimado com base em custo ou margem média</p>
          </div>

          {/* Sales retail revenue potential value */}
          <div className="bg-zinc-900 border border-zinc-850 p-4.5 rounded-2xl shadow-xs">
            <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider block">Faturamento Estimado Potencial</span>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-black text-emerald-450 font-mono">R$ {stockMetrics.totalStockRetailValue.toFixed(2)}</span>
            </div>
            <p className="text-[10px] text-zinc-500 mt-1">Lucro bruto: +{stockMetrics.expectedMarkup.toFixed(0)}% de valor agregado</p>
          </div>

          {/* Critical low alert warnings */}
          <div className="bg-zinc-900 border border-zinc-850 p-4.5 rounded-2xl shadow-xs flex flex-col justify-between">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase font-black tracking-wider block">Alertas Críticos de Estoque</span>
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {stockMetrics.outOfStockCount > 0 ? (
                  <span className="text-xs font-bold font-mono px-2 py-0.5 bg-red-950 text-red-400 border border-red-900/40 rounded flex items-center gap-1">
                    {stockMetrics.outOfStockCount} Esgotado
                  </span>
                ) : null}
                {stockMetrics.lowStockCount > 0 ? (
                  <span className="text-xs font-bold font-mono px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-900/40 rounded flex items-center gap-1">
                    {stockMetrics.lowStockCount} Crítico
                  </span>
                ) : null}
                {stockMetrics.outOfStockCount === 0 && stockMetrics.lowStockCount === 0 && (
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                    ✔️ Todos níveis ótimos
                  </span>
                )}
              </div>

              {/* Listagem de link interativo para o estoque baixo */}
              {(stockMetrics.outOfStockCount > 0 || stockMetrics.lowStockCount > 0) && (
                <div className="mt-3.5 space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                  <p className="text-[9px] text-zinc-500 uppercase tracking-widest font-extrabold mb-1">Localizar no Estoque:</p>
                  {products
                    .filter(p => !p.estoqueInfinito && p.estoque < 10)
                    .map(p => {
                      const isZero = p.estoque === 0;
                      return (
                        <button
                          key={p.id}
                          onClick={() => scrollToProduct(p.id)}
                          className={`w-full text-left text-[11px] font-medium leading-tight px-2 py-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-between border ${
                            isZero 
                              ? 'bg-red-950/15 hover:bg-red-950/30 text-red-400 border-red-900/20 hover:border-red-900/50' 
                              : 'bg-amber-950/15 hover:bg-amber-950/30 text-amber-400 border-amber-900/20 hover:border-amber-900/50'
                          }`}
                          title={`Clique para ir até ${p.nome}`}
                        >
                          <span className="truncate max-w-[130px] font-semibold">{p.nome}</span>
                          <span className="font-mono text-[10px] font-bold shrink-0 bg-black/40 px-1.5 py-0.5 rounded border border-zinc-850">
                            {p.estoque} un.
                          </span>
                        </button>
                      );
                    })}
                </div>
              )}
            </div>
            <p className="text-[10px] text-zinc-500 mt-2 pt-2 border-t border-zinc-850/60 font-medium">Produtos com estoque menor que 10!</p>
          </div>

        </div>
      )}
      
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-zinc-900 rounded-xl border border-zinc-800 p-4 shadow-md">
        <div className="relative w-full sm:max-w-md">
          <span className="absolute left-3.5 top-3 text-zinc-500">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Pesquisar por nome de brinde ou brinco..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink transition-colors text-zinc-100 placeholder-zinc-650 text-sm"
          />
        </div>
        <div className="text-xs font-semibold text-zinc-400 shrink-0">
          Mostrando {filteredProducts.length} de {products.length} itens cadastrados
        </div>
      </div>

      {/* Grid of Products */}
      {filteredProducts.length === 0 ? (
        <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-12 text-center shadow-lg">
          <div className="p-4 bg-brand-pink/10 border border-brand-pink/20 rounded-full text-brand-pink inline-block mb-4">
            <PackageOpen className="h-10 w-10" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-105 mb-1">Nenhum brinde encontrado</h3>
          <p className="text-sm text-zinc-450 max-w-sm mx-auto">
            {searchTerm 
              ? 'Nenhum item corresponde à sua pesquisa. Tente buscar por outros termos.'
              : 'Comece adicionando produtos na aba de Cadastro para montar seu estoque.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProducts.map((p) => {
            const isDeleting = productToDelete === p.id;
            const isOutOfStock = !p.estoqueInfinito && p.estoque === 0;
            const isLowStock = !p.estoqueInfinito && p.estoque > 0 && p.estoque < 10;
            const hasDraft = editedStocks[p.id] !== undefined;
            const draftVal = hasDraft ? editedStocks[p.id] : p.estoque;
            const isChanged = hasDraft && editedStocks[p.id] !== p.estoque;

            return (
              <div 
                key={p.id} 
                id={`product-card-${p.id}`}
                className={`bg-zinc-900 rounded-xl border transition-all duration-500 overflow-hidden shadow-sm hover:shadow-lg ${
                  highlightedProductId === p.id
                    ? 'animate-blink-red scale-[1.02] border-red-500'
                    : isOutOfStock 
                      ? 'border-zinc-800/80 bg-zinc-950/40' 
                      : isDeleting 
                        ? 'border-red-900 ring-2 ring-red-950/50'
                        : 'border-zinc-850'
                }`}
              >
                {/* Product Thumbnail Banner */}
                <div className="aspect-square w-full bg-black/30 relative overflow-hidden flex items-center justify-center p-4 border-b border-zinc-800/60">
                  {p.imagemBase64 ? (
                    <img 
                       src={p.imagemBase64} 
                      alt={p.nome} 
                      className="max-h-full max-w-full object-contain hover:scale-105 transition-transform duration-300 pointer-events-none"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-zinc-700">
                      <Box className="h-16 w-16 stroke-1 mb-2" />
                      <span className="text-xs uppercase font-bold tracking-wider opacity-60">Sem Foto</span>
                    </div>
                  )}

                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                    {p.estoqueInfinito ? (
                      <span className="bg-brand-pink text-black text-[10px] font-extrabold px-2 py-1 rounded-md shadow-xs uppercase tracking-wider">
                        Infinito ∞
                      </span>
                    ) : isOutOfStock ? (
                      <span className="bg-red-650 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-xs uppercase tracking-wider">
                        Esgotado
                      </span>
                    ) : isLowStock ? (
                      <span className="bg-amber-600 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-xs uppercase tracking-wider animate-pulse">
                        Estoque Baixo
                      </span>
                    ) : null}
                  </div>

                  <div className="absolute bottom-3 right-3 bg-zinc-950/90 backdrop-blur-xs border border-zinc-800 px-2.5 py-1 rounded-lg text-xs font-bold text-brand-pink shadow-2xs flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5 shrink-0" />
                    R$ {p.preco.toFixed(2)}
                  </div>
                </div>

                {/* Info and Actions Area */}
                <div className="p-5 space-y-4">
                  <div>
                    <h4 className="font-display font-semibold text-zinc-100 text-base line-clamp-1 hover:text-brand-pink transition-colors">
                      {p.nome}
                    </h4>
                    <p className="text-xs text-zinc-450 mt-1">Preço unitário: R$ {p.preco.toFixed(2)}</p>
                  </div>

                  {/* Quantity Editing Control */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-400 block">Estoque Disponível:</label>
                      {isAdmin && (
                        <label className="flex items-center gap-1 text-[11px] text-brand-pink font-semibold cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={!!p.estoqueInfinito}
                            onChange={(e) => {
                              // If they choose infinite, clear any temporary drafts too
                              setEditedStocks(prev => {
                                const next = { ...prev };
                                delete next[p.id];
                                return next;
                              });
                              onUpdateStock(p.id, p.estoque, e.target.checked);
                            }}
                            className="rounded border-zinc-800 text-brand-pink focus:ring-0 accent-brand-pink h-3 w-3 cursor-pointer bg-black"
                          />
                          <span>Estoque Infinito</span>
                        </label>
                      )}
                    </div>
                    
                    {isAdmin ? (
                      <div className="space-y-2">
                        <div className="flex items-center">
                          <button
                            onClick={() => handleDecrement(p.id, p.estoque)}
                            disabled={p.estoqueInfinito || draftVal <= 0}
                            className="p-2 border border-zinc-800 bg-black rounded-l-lg hover:bg-zinc-900 text-zinc-300 focus:outline-none focus:ring-1 focus:ring-brand-pink/50 font-bold active:scale-95 disabled:opacity-40 select-none cursor-pointer"
                            title="Remover 1 item"
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          {p.estoqueInfinito ? (
                            <div className="w-full text-center py-1.5 px-2 bg-black border-y border-zinc-800 text-xs font-extrabold text-brand-pink">
                              ∞ Sem limites
                            </div>
                          ) : (
                            <input
                              type="number"
                              min="0"
                              value={draftVal}
                              onChange={(e) => handleStockChange(p.id, p.estoque, e.target.value)}
                              className="w-full text-center py-1.5 px-2 bg-black border-y border-zinc-800 focus:outline-none focus:ring-1 focus:ring-brand-pink/50 text-sm font-semibold text-zinc-100"
                            />
                          )}
                          <button
                            onClick={() => handleIncrement(p.id, p.estoque)}
                            disabled={p.estoqueInfinito}
                            className="p-2 border border-zinc-800 bg-black rounded-r-lg hover:bg-zinc-900 text-zinc-300 focus:outline-none focus:ring-1 focus:ring-brand-pink/50 font-bold active:scale-95 select-none cursor-pointer disabled:opacity-40"
                            title="Adicionar 1 item"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Save Stock Modification action button */}
                        {isChanged && !p.estoqueInfinito && (
                          <div className="flex items-center gap-2 pt-1 animate-fade-in">
                            <button
                              onClick={() => {
                                onUpdateStock(p.id, draftVal);
                                setEditedStocks(prev => {
                                  const updated = { ...prev };
                                  delete updated[p.id];
                                  return updated;
                                });
                              }}
                              className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-xs flex items-center justify-center gap-1 active:scale-[0.98] transition-all cursor-pointer"
                            >
                              <Check className="h-3.5 w-3.5" />
                              <span>Salvar Estoque</span>
                            </button>
                            <button
                              onClick={() => {
                                setEditedStocks(prev => {
                                  const updated = { ...prev };
                                  delete updated[p.id];
                                  return updated;
                                });
                              }}
                              className="py-1.5 px-2.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 rounded-lg text-xs font-semibold hover:text-zinc-100 transition-colors cursor-pointer"
                              title="Cancelar alterações"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        {p.estoqueInfinito ? (
                          <div className="w-full text-center py-2.5 px-4 bg-zinc-950 border border-zinc-850 rounded-xl text-xs font-black text-brand-pink tracking-wider uppercase">
                            Disponibilidade Ilimitada ∞
                          </div>
                        ) : (
                          <div className="flex items-center justify-between py-2 px-4 bg-zinc-950 border border-zinc-850 rounded-xl">
                            <span className="text-sm font-bold text-zinc-100 font-mono">
                              {p.estoque} {p.estoque === 1 ? 'unidade' : 'unidades'}
                            </span>
                            <span className={`h-2.5 w-2.5 rounded-full ${p.estoque === 0 ? 'bg-red-500' : p.estoque < 10 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Delete or Confirmation Actions (Admin Only) */}
                  {isAdmin && (
                    <>
                      {!isDeleting ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenEditModal(p)}
                            className="flex-1 py-1.5 px-3 bg-zinc-800 hover:bg-zinc-750 text-brand-pink text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 border border-zinc-700/50 hover:border-brand-pink/50 transition-all cursor-pointer active:scale-95"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            <span>Editar</span>
                          </button>
                          <button
                            onClick={() => setProductToDelete(p.id)}
                            className="p-1 px-2.5 bg-zinc-950 hover:bg-red-950/25 text-red-400 hover:text-red-300 rounded-lg border border-zinc-850 hover:border-red-900/40 transition-colors cursor-pointer"
                            title="Excluir Produto"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-3 space-y-2.5 animate-fade-in">
                          <div className="flex items-start gap-1.5 text-red-300 text-[11px] leading-snug">
                            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                            <span>Tem certeza que deseja remover este produto? Isso excluirá seus registros de estoque.</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                onDeleteProduct(p.id);
                                setProductToDelete(null);
                              }}
                              className="flex-1 py-1 px-2.5 bg-red-650 hover:bg-red-700 text-white rounded-md text-xs font-semibold shadow-xs select-none cursor-pointer"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setProductToDelete(null)}
                              className="flex-1 py-1 px-2.5 bg-black border border-zinc-800 rounded-md text-zinc-400 text-xs font-semibold hover:bg-zinc-900 cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ✏️ MODAL DE EDIÇÃO DE PRODUTO COMPLETA (ADMINISTRADOR) */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xs overflow-y-auto">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col my-8 animate-fade-in">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-zinc-800 shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-brand-pink/10 border border-brand-pink/20 rounded-lg text-brand-pink">
                  <Pencil className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-lg text-zinc-100">Editar Detalhes do Produto</h3>
                  <p className="text-[10px] font-mono text-zinc-500">ID: {editingProduct.id}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingProduct(null)}
                className="p-1 px-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 rounded-lg transition-colors cursor-pointer"
                title="Fechar formulário"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleEditSubmit} className="p-6 space-y-5 overflow-y-auto">
              
              {/* Msg de erro */}
              {editError && (
                <div className="p-4 bg-red-950/30 border-l-4 border-red-650 rounded-r-xl flex items-start gap-2.5 text-red-300 text-sm animate-fade-in">
                  <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}

              {/* Msg de sucesso */}
              {editSuccess && (
                <div className="p-4 bg-emerald-950/30 border-l-4 border-emerald-650 rounded-r-xl flex items-start gap-2.5 text-emerald-300 text-sm animate-fade-in">
                  <Sparkles className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{editSuccess}</span>
                </div>
              )}

              {/* Product Nome */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                  Nome do Produto <span className="text-brand-pink font-bold">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Ex: Caneca Porcelana, Brinco Acrílico"
                  value={editNome}
                  onChange={(e) => setEditNome(e.target.value)}
                  className="w-full px-4 py-2.5 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink transition-colors text-zinc-100 placeholder-zinc-650 text-sm"
                />
              </div>

              {/* Price rows */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Preço de Venda <span className="text-brand-pink font-bold">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-zinc-500 font-medium text-xs">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={editPreco}
                        onChange={(e) => setEditPreco(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-full pl-8 pr-3 py-2.5 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink transition-colors text-zinc-100 placeholder-zinc-650 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                      Preço de Custo <span className="text-zinc-500 text-xs font-normal">(Margem)</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-zinc-500 font-medium text-xs">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0,00"
                        value={editPrecoCusto}
                        onChange={(e) => setEditPrecoCusto(e.target.value === '' ? '' : parseFloat(e.target.value))}
                        className="w-full pl-8 pr-3 py-2.5 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink transition-colors text-zinc-100 placeholder-zinc-650 text-xs"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-zinc-300">
                      Estoque Atual <span className="text-brand-pink font-bold">*</span>
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-brand-pink font-semibold cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editEstoqueInfinito}
                        onChange={(e) => {
                          setEditEstoqueInfinito(e.target.checked);
                          if (e.target.checked) setEditEstoque('');
                        }}
                        className="rounded border-zinc-800 text-brand-pink focus:ring-0 accent-brand-pink h-3.5 w-3.5 cursor-pointer bg-black"
                      />
                      <span>Estoque Infinito</span>
                    </label>
                  </div>
                  <input
                    type="number"
                    disabled={editEstoqueInfinito}
                    min="0"
                    step="1"
                    placeholder={editEstoqueInfinito ? "Sem limites (Estoque Infinito)" : "Ex: 50"}
                    value={editEstoqueInfinito ? "" : editEstoque}
                    onChange={(e) => setEditEstoque(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="w-full px-4 py-2.5 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink transition-colors text-zinc-100 placeholder-zinc-650 text-sm disabled:opacity-50 disabled:text-zinc-500"
                  />
                </div>
              </div>

              {/* Progressive price list */}
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/65 space-y-4">
                <div className="flex items-center gap-2 border-b border-zinc-850 pb-2.5">
                  <Layers className="h-4 w-4 text-brand-pink" />
                  <h4 className="text-xs font-bold tracking-wider uppercase text-zinc-100">
                    Preços Progressivos (Kits & Atacado)
                  </h4>
                </div>
                <p className="text-[11px] text-zinc-500 leading-snug">
                  Configure preços diferenciados por quantidade mínima. O sistema aplicará este preço se a quantidade de itens for igual ou superior.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
                  <div className="sm:col-span-5">
                    <label className="block text-[11px] font-semibold text-zinc-450 mb-1">
                      Qtd Mínima (A partir de)
                    </label>
                    <input
                      type="number"
                      min="2"
                      placeholder="Ex: 10"
                      value={editNovaQuantidadeMinima}
                      onChange={(e) => setEditNovaQuantidadeMinima(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 bg-black border border-zinc-900 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink/50 text-xs text-zinc-105 placeholder-zinc-700"
                    />
                  </div>

                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-semibold text-zinc-450 mb-1">
                      Preço Unitário (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0,00"
                      value={editNovoPrecoFaixa}
                      onChange={(e) => setEditNovoPrecoFaixa(e.target.value === '' ? '' : parseFloat(e.target.value))}
                      className="w-full px-3 py-2 bg-black border border-zinc-900 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink/50 text-xs text-zinc-105 placeholder-zinc-700"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <button
                      type="button"
                      onClick={handleAddEditFaixa}
                      className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-brand-pink hover:text-zinc-100 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer border border-zinc-700/50"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </div>

                {/* Listing of tiers */}
                {editFaixasPreco.length > 0 ? (
                  <div className="mt-3 space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {editFaixasPreco.map((faixa, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between px-3 py-1.5 bg-black border border-zinc-900 rounded-lg text-xs"
                      >
                        <div className="flex items-center gap-2 text-zinc-350">
                          <span className="h-1.5 w-1.5 bg-brand-pink rounded-full" />
                          <span>A partir de <strong>{faixa.quantidadeMinima}</strong> itens:</span>
                          <span className="font-mono font-bold text-brand-pink">R$ {faixa.preco.toFixed(2)} /un</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveEditFaixa(i)}
                          className="p-1 hover:bg-zinc-900 rounded-md text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                          title="Remover faixa"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-2.5 border border-dashed border-zinc-850 rounded-xl text-zinc-650 text-[11px]">
                    Nenhum preço progressivo cadastrado para este item.
                  </div>
                )}
              </div>

              {/* Product Photo drag-drop with canvas preview */}
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-1.5 flex items-center justify-between">
                  <span>Foto do Produto (Arrastar ou selecionar nova)</span>
                  {isEditCompressing && (
                    <span className="text-xs text-brand-pink flex items-center gap-1 animate-pulse">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      <span>Otimizando imagem...</span>
                    </span>
                  )}
                </label>
                <input
                  type="file"
                  ref={editFileInputRef}
                  onChange={handleEditFileChange}
                  accept="image/*"
                  className="hidden"
                  disabled={isEditSaving || isEditCompressing}
                />

                {!editPhoto ? (
                  <button
                    type="button"
                    onDragEnter={handleEditDrag}
                    onDragOver={handleEditDrag}
                    onDragLeave={handleEditDrag}
                    onDrop={handleEditDrop}
                    onClick={() => editFileInputRef.current?.click()}
                    disabled={isEditSaving || isEditCompressing}
                    className={`w-full border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                      editDragActive
                        ? 'border-brand-pink bg-brand-pink/10'
                        : 'border-zinc-800 hover:border-brand-pink hover:bg-zinc-950'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-5 w-5 text-brand-pink" />
                      <p className="font-medium text-zinc-300 text-xs">
                        Arraste uma nova imagem aqui ou clique para selecionar
                      </p>
                    </div>
                  </button>
                ) : (
                  <div className="relative border border-zinc-800 rounded-xl overflow-hidden bg-black p-4 flex items-center justify-center">
                    <div className="relative h-32 w-32 rounded-lg overflow-hidden border border-zinc-805 bg-zinc-950">
                      <img
                        src={editPhoto}
                        alt="Previa da Edição"
                        className="h-full w-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setEditPhoto('')}
                        disabled={isEditSaving || isEditCompressing}
                        className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-650 text-white rounded-full shadow cursor-pointer"
                        title="Remover imagem"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Submit triggers */}
              <div className="flex items-center gap-3 pt-4 border-t border-zinc-850 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  disabled={isEditSaving || isEditCompressing}
                  className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 rounded-xl text-sm font-semibold transition-colors cursor-pointer active:scale-98"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isEditSaving || isEditCompressing}
                  className="flex-1 py-2.5 bg-brand-pink hover:bg-brand-pink-hover text-black font-bold rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
                >
                  {isEditSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Sincronizando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Salvar Alterações</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
