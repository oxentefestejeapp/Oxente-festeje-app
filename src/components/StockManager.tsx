/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useRef, DragEvent, ChangeEvent } from 'react';
import { Trash2, Search, Plus, Minus, AlertTriangle, PackageOpen, Tag, Box, Check, X, Pencil, Upload, Loader2, Sparkles, AlertCircle, Layers, Undo2, History, Palette } from 'lucide-react';
import { motion } from 'motion/react';
import { Product, PricingTier, ProductColor } from '../types';

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
  onAddProduct?: (newProduct: Product) => Promise<boolean>;
  isAdmin?: boolean;
}

export function StockManager({ products, onUpdateStock, onDeleteProduct, onUpdateProduct, onAddProduct, isAdmin = false }: StockManagerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState(false);
  const [editedStocks, setEditedStocks] = useState<Record<string, number>>({});
  const [highlightedProductId, setHighlightedProductId] = useState<string | null>(null);

  // States and Handlers for Undoing / Restoring Deleted Stock Products
  const [deletedHistory, setDeletedHistory] = useState<Product[]>(() => {
    try {
      const saved = localStorage.getItem('oxente_deleted_products_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [lastDeletedProduct, setLastDeletedProduct] = useState<Product | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const toastTimeoutRef = useRef<any>(null);

  const handleAddToDeletedHistory = (prod: Product) => {
    setDeletedHistory(prev => {
      const filtered = prev.filter(p => p.id !== prod.id);
      const updated = [prod, ...filtered].slice(0, 15); // max 15 products in history
      localStorage.setItem('oxente_deleted_products_history', JSON.stringify(updated));
      return updated;
    });

    setLastDeletedProduct(prod);
    setShowUndoToast(true);

    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = setTimeout(() => {
      setShowUndoToast(false);
    }, 15000); // clear floating undo after 15 seconds
  };

  const handleRestoreDeletedProduct = async (prod: Product) => {
    if (!onAddProduct) return;
    const success = await onAddProduct(prod);
    if (success !== false) {
      setDeletedHistory(prev => {
        const updated = prev.filter(p => p.id !== prod.id);
        localStorage.setItem('oxente_deleted_products_history', JSON.stringify(updated));
        return updated;
      });
      if (lastDeletedProduct?.id === prod.id) {
        setShowUndoToast(false);
        setLastDeletedProduct(null);
      }
    }
  };

  // Self-heal: If any item in deletedHistory (the lixeira) is still present in the active products list
  // (e.g. because of a previous sync bug that resurrected it), delete it permanently from the database.
  React.useEffect(() => {
    if (deletedHistory.length === 0 || products.length === 0) return;
    
    const activeIds = new Set(products.map(p => p.id));
    deletedHistory.forEach((deletedProd) => {
      if (activeIds.has(deletedProd.id)) {
        console.log(`[Auto-Cleanup] Deletando produto ressuscitado do estoque ativo: ${deletedProd.id} (${deletedProd.nome})`);
        onDeleteProduct(deletedProd.id);
      }
    });
  }, [deletedHistory, products, onDeleteProduct]);

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

  const [isResettingAudits, setIsResettingAudits] = useState(false);

  const handleToggleConferido = async (p: Product) => {
    if (!isAdmin) {
      alert('Acesso Restrito: Apenas administradores podem marcar a conferência do estoque físico!');
      return;
    }
    if (onUpdateProduct) {
      await onUpdateProduct({
        ...p,
        conferido: !p.conferido
      });
    }
  };

  const handleResetAllAudits = async () => {
    if (!isAdmin) {
      alert('Acesso Restrito: Apenas administradores podem limpar as marcações de conferência!');
      return;
    }
    if (!onUpdateProduct) return;
    const confirmReset = window.confirm(
      'Tem certeza que deseja redefinir todas as marcações de conferência do estoque físico? Isso limpará a sinalização de todos os produtos para reiniciar a conferência.'
    );
    if (!confirmReset) return;

    setIsResettingAudits(true);
    try {
      // Limpar cache local instantaneamente para resposta visual imediata
      try {
        localStorage.removeItem('oxente_local_conferidos');
      } catch {}

      const checkedProducts = products.filter(p => p.conferido);
      for (const p of checkedProducts) {
        await onUpdateProduct({ ...p, conferido: false });
      }
    } catch (e) {
      console.error('Erro ao redefinir conferências:', e);
    } finally {
      setIsResettingAudits(false);
    }
  };

  // Edit Modal State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editPreco, setEditPreco] = useState<number | ''>('');
  const [editPrecoCusto, setEditPrecoCusto] = useState<number | ''>('');
  const [editEstoque, setEditEstoque] = useState<number | ''>('');
  const [editEstoqueInfinito, setEditEstoqueInfinito] = useState(false);
  const [editAdicional, setEditAdicional] = useState(false);
  const [editPhoto, setEditPhoto] = useState<string>('');
  const [editDragActive, setEditDragActive] = useState(false);
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [isEditCompressing, setIsEditCompressing] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editPrazoUrgencia, setEditPrazoUrgencia] = useState<number | ''>('');
  
  // Color Options State for Edit
  const [editCores, setEditCores] = useState<ProductColor[]>([]);
  const [editNovaCorNome, setEditNovaCorNome] = useState('');
  const [editNovaCorEstoque, setEditNovaCorEstoque] = useState<number | ''>('');
  
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
    setEditAdicional(!!product.adicional);
    setEditPhoto(product.imagemBase64 || '');
    setEditCores(product.cores ? [...product.cores] : []);
    setEditNovaCorNome('');
    setEditNovaCorEstoque('');
    setEditFaixasPreco(product.faixasPreco ? [...product.faixasPreco] : []);
    setEditNovaQuantidadeMinima('');
    setEditNovoPrecoFaixa('');
    setEditPrazoUrgencia(product.prazoUrgencia !== undefined && product.prazoUrgencia !== null ? product.prazoUrgencia : '');
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

  const handleEditFileChange = (changeEvent: ChangeEvent<HTMLInputElement>) => {
    changeEvent.preventDefault();
    if (changeEvent.target.files && changeEvent.target.files[0]) {
      processEditFile(changeEvent.target.files[0]);
    }
  };

  const handleEditAddCor = () => {
    if (!editNovaCorNome.trim()) {
      setEditError('Por favor, digite o nome da cor.');
      return;
    }
    if (editNovaCorEstoque === '') {
      setEditError('Por favor, informe a quantidade para a cor.');
      return;
    }
    const qty = Number(editNovaCorEstoque);
    if (isNaN(qty) || qty < 0) {
      setEditError('A quantidade da cor deve ser maior ou igual a zero.');
      return;
    }

    if (editCores.some(c => c.nome.toLowerCase() === editNovaCorNome.trim().toLowerCase())) {
      setEditError(`A cor "${editNovaCorNome.trim()}" já foi adicionada.`);
      return;
    }

    setEditCores([...editCores, { nome: editNovaCorNome.trim(), estoque: Math.floor(qty) }]);
    setEditNovaCorNome('');
    setEditNovaCorEstoque('');
    setEditError('');
  };

  const handleEditRemoveCor = (index: number) => {
    const updated = editCores.filter((_, i) => i !== index);
    setEditCores(updated);
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

    let estoqueNum = editEstoqueInfinito ? 0 : Number(editEstoque);
    if (editCores.length > 0 && !editEstoqueInfinito) {
      estoqueNum = editCores.reduce((sum, c) => sum + c.estoque, 0);
    }

    if (!editEstoqueInfinito && editCores.length === 0 && (editEstoque === '' || isNaN(estoqueNum) || estoqueNum < 0)) {
      setEditError('O estoque precisa ser maior ou igual a zero.');
      return;
    }

    const prazoUrgenciaNum = editPrazoUrgencia !== '' ? Number(editPrazoUrgencia) : undefined;
    if (prazoUrgenciaNum !== undefined && (isNaN(prazoUrgenciaNum) || prazoUrgenciaNum < 1)) {
      setEditError('O prazo de urgência deve ser de pelo menos 1 dia.');
      return;
    }

    const updatedProduct: Product = {
      ...editingProduct,
      nome: editNome.trim(),
      preco: precoNum,
      precoCusto: precoCustoNum,
      estoque: Math.floor(estoqueNum),
      cores: editCores.length > 0 ? editCores : undefined,
      imagemBase64: editPhoto || undefined,
      estoqueInfinito: editEstoqueInfinito || undefined,
      adicional: editAdicional || undefined,
      faixasPreco: editFaixasPreco.length > 0 ? editFaixasPreco : undefined,
      prazoUrgencia: prazoUrgenciaNum,
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

      if (p.estoque <= 0) {
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

  const auditMetrics = useMemo(() => {
    const total = products.length;
    const checked = products.filter(p => p.conferido).length;
    const percentage = total > 0 ? Math.round((checked / total) * 100) : 0;
    return {
      total,
      checked,
      percentage
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

      {/* 🔔 Toast Flutuante de Desfazer Exclusão */}
      {showUndoToast && lastDeletedProduct && (
        <div className="fixed bottom-6 right-6 z-50 bg-zinc-900 border border-brand-pink/50 shadow-[0_8px_32px_rgba(219,39,119,0.3)] rounded-2xl py-3.5 px-4.5 flex items-center justify-between gap-4 animate-fade-in max-w-sm w-full">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-red-950/40 border border-red-900/40 flex items-center justify-center text-red-400 shrink-0">
              <Trash2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-zinc-500 uppercase font-black tracking-widest block">Excluído por engano?</span>
              <strong className="text-zinc-200 text-xs font-semibold truncate block mt-0.5">{lastDeletedProduct.nome}</strong>
            </div>
          </div>
          <button
            onClick={() => handleRestoreDeletedProduct(lastDeletedProduct)}
            className="px-3.5 py-2 bg-brand-pink text-white rounded-xl text-xs font-black tracking-wider uppercase hover:bg-brand-pink/90 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shrink-0 shadow-md font-sans"
          >
            <Undo2 className="h-4 w-4" />
            Desfazer
          </button>
        </div>
      )}

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
                      const isZero = p.estoque <= 0;
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

      {/* 🗑️ Lixeira de Itens Excluídos (Apenas Administrador) */}
      {isAdmin && deletedHistory.length > 0 && (
        <div className="bg-zinc-950/40 border border-zinc-850 rounded-2xl p-4.5 shadow-xs animate-fade-in space-y-3">
          <div className="flex items-center justify-between border-b border-zinc-850/60 pb-2.5">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-brand-pink" />
              <h4 className="text-xs font-extrabold text-zinc-300 uppercase tracking-widest font-sans">Lixeira de Brindes Excluídos ({deletedHistory.length})</h4>
            </div>
            <button
              onClick={() => {
                // Ensure all items in the trash are deleted from Supabase again to guarantee they don't resurrect
                deletedHistory.forEach((p) => {
                  onDeleteProduct(p.id);
                });
                setDeletedHistory([]);
                localStorage.removeItem('oxente_deleted_products_history');
              }}
              className="text-[10px] text-zinc-500 hover:text-red-400 font-black uppercase tracking-wider transition-colors cursor-pointer select-none"
            >
              Esvaziar Lixeira
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[220px] overflow-y-auto pr-1">
            {deletedHistory.map((p) => (
              <div key={p.id} className="bg-zinc-900 border border-zinc-850 rounded-xl p-3 flex items-center gap-3 hover:border-zinc-800 transition-all shadow-xs">
                <div className="shrink-0 h-10 w-10 rounded-lg bg-zinc-950 border border-zinc-850 flex items-center justify-center text-zinc-500">
                  <Box className="h-5 w-5" />
                </div>
                {/* Nome e Estoque Anterior */}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-zinc-150 truncate leading-tight" title={p.nome}>{p.nome}</p>
                  <p className="text-[10px] font-semibold text-zinc-550 mt-1 flex items-center gap-1">
                    <span className="font-sans">Estoque:</span> 
                    <span className="font-mono text-zinc-400 font-bold">{p.estoque} un.</span>
                  </p>
                </div>
                {/* Botão de Recuperar */}
                <button
                  onClick={() => handleRestoreDeletedProduct(p)}
                  className="px-2.5 py-1.5 bg-brand-pink/10 hover:bg-brand-pink hover:text-white border border-brand-pink/25 hover:border-brand-pink text-brand-pink text-[11px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
                  title="Restaurar produto para o estoque ativo"
                >
                  <Undo2 className="h-3 w-3" />
                  <span>Recuperar</span>
                </button>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-zinc-550 leading-tight">
            Clique em <strong>Recuperar</strong> para restaurar o brinde de volta ao estoque principal com as mesmas configurações de preço e histórico.
          </p>
        </div>
      )}
      
      {/* 📝 PAINEL DE CONFERÊNCIA DE ESTOQUE FÍSICO */}
      <div className="bg-gradient-to-r from-zinc-950 to-zinc-900 border border-zinc-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-450 shrink-0">
              <Check className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="font-display font-semibold text-base text-zinc-100 flex items-center gap-2">
                Conferência de Estoque Físico
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Auditoria de Caixa
                </span>
              </h3>
              <p className="text-xs text-zinc-450 leading-relaxed max-w-xl">
                Marque cada brinde abaixo ao contar o estoque físico na loja. Verifique se as quantidades físicas batem com as mostradas no aplicativo para evitar divergências e quebras de caixa!
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0 bg-black/40 border border-zinc-850 p-3 rounded-xl min-w-[160px] text-center sm:text-right">
            <span className="text-[10px] text-zinc-550 font-bold uppercase tracking-wider block">Progresso da Auditoria</span>
            <div className="flex items-baseline gap-1 mt-0.5 justify-center sm:justify-end w-full">
              <span className="text-2xl font-mono font-black text-emerald-400">{auditMetrics.checked}</span>
              <span className="text-sm font-medium text-zinc-550">de</span>
              <span className="text-sm font-mono font-bold text-zinc-350">{auditMetrics.total}</span>
            </div>
            
            {auditMetrics.checked > 0 && (
              <button
                type="button"
                onClick={handleResetAllAudits}
                disabled={isResettingAudits}
                className="mt-2 text-[10px] text-zinc-500 hover:text-red-400 font-black uppercase tracking-wider flex items-center gap-1 transition-colors cursor-pointer select-none disabled:opacity-50"
              >
                {isResettingAudits ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <X className="h-3 w-3" />
                )}
                <span>Limpar Marcações</span>
              </button>
            )}
          </div>
        </div>

        {/* Barra de Progresso Real */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-zinc-500 font-semibold">
            <span>{auditMetrics.percentage}% Concluído</span>
            <span>{auditMetrics.total - auditMetrics.checked} restantes para verificação completa</span>
          </div>
          <div className="h-2 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-850">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${auditMetrics.percentage}%` }}
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>
      </div>

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
            autoComplete="off"
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
            const isOutOfStock = !p.estoqueInfinito && p.estoque <= 0;
            const isLowStock = !p.estoqueInfinito && p.estoque > 0 && p.estoque < 10;
            const hasDraft = editedStocks[p.id] !== undefined;
            const draftVal = hasDraft ? editedStocks[p.id] : p.estoque;
            const isChanged = hasDraft && editedStocks[p.id] !== p.estoque;

            return (
              <div 
                key={p.id} 
                id={`product-card-${p.id}`}
                className={`bg-zinc-950 border transition-all duration-300 rounded-2xl flex flex-col justify-between shadow-sm hover:shadow-md ${
                  highlightedProductId === p.id
                    ? 'animate-blink-red scale-[1.02] border-brand-pink'
                    : isOutOfStock 
                      ? 'border-red-900 bg-red-950/5' 
                      : isDeleting 
                        ? 'border-red-900 ring-2 ring-red-950/50'
                        : 'border-zinc-850 hover:border-zinc-700 hover:bg-zinc-900/40'
                }`}
              >
                {/* Highlighted info / Badges Header Block */}
                <div className="p-5 pb-0 space-y-4">
                  <div className="flex flex-wrap gap-1.5 select-none animate-fade-in">
                    {p.adicional && (
                      <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1 shrink-0">
                        ✨ Adicional
                      </span>
                    )}
                    {p.estoqueInfinito ? (
                      <span className="bg-brand-pink/10 border border-brand-pink/30 text-brand-pink text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1 shrink-0">
                        ♾️ Estoque Infinito
                      </span>
                    ) : isOutOfStock ? (
                      <span className={`bg-red-500/15 border border-red-500/30 text-red-400 text-[10px] font-black px-3 py-1.5 rounded-lg uppercase tracking-wider ${p.estoque < 0 ? '' : 'animate-pulse'} flex items-center gap-1 shrink-0 w-full justify-center`}>
                        {p.estoque < 0 ? `🚨 ESTOQUE CRÍTICO (NEGATIVO: ${p.estoque})` : '🚨 ESGOTADO / FALTA NO ESTOQUE'}
                      </span>
                    ) : isLowStock ? (
                      <span className="bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1 shrink-0">
                        ⚠️ Estoque Baixo ({p.estoque})
                      </span>
                    ) : (
                      <span className="bg-zinc-800/40 border border-zinc-750 text-zinc-400 text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1 shrink-0">
                        📦 Em Estoque ({p.estoque} un)
                      </span>
                    )}
                  </div>

                  {/* Product Name & Price Row */}
                  <div className="flex items-start justify-between gap-3 pt-1">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-display font-black text-white text-base leading-tight truncate hover:text-brand-pink transition-colors" title={p.nome}>
                        {p.nome}
                      </h4>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1 flex items-center gap-1">
                        <Box className="h-3 w-3 text-zinc-650" />
                        <span>Brinde / Código cadastrado</span>
                      </p>
                    </div>
                    <div className="bg-zinc-900 border border-zinc-800 px-2.5 py-1.5 rounded-xl text-xs sm:text-sm font-black text-brand-pink shrink-0 shadow-inner flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5 animate-pulse text-brand-pink" />
                      <span>R$ {p.preco.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Details and pricing Grid */}
                  <div className="grid grid-cols-2 gap-2 bg-zinc-900/40 p-3 rounded-xl border border-zinc-900/60 text-left">
                    <div>
                      <span className="block text-[8px] text-zinc-500 font-extrabold uppercase tracking-widest leading-none mb-1">Preço de Venda</span>
                      <span className="text-xs font-mono font-bold text-zinc-200">R$ {p.preco.toFixed(2)}</span>
                    </div>
                    <div className="border-l border-zinc-850/80 pl-3">
                      <span className="block text-[8px] text-zinc-500 font-extrabold uppercase tracking-widest leading-none mb-1">Preço de Custo</span>
                      <span className="text-xs font-mono font-bold text-zinc-400">
                        {p.precoCusto !== undefined ? `R$ ${Number(p.precoCusto).toFixed(2)}` : 'Não conf.'}
                      </span>
                    </div>
                  </div>

                  {/* Colors Stock list indicator on card */}
                  {p.cores && p.cores.length > 0 && (
                    <div className="bg-zinc-900/40 p-2.5 rounded-xl border border-zinc-850 text-left text-xs space-y-1.5 mt-2">
                      <div className="flex items-center gap-1.5 text-[9px] text-zinc-500 uppercase font-black tracking-wider">
                        <Palette className="h-3 w-3 text-brand-pink" />
                        <span>Cores no Estoque</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {p.cores.map((cor, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-black text-[10px] font-bold text-zinc-300 border border-zinc-800"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-brand-pink" />
                            <span>{cor.nome}:</span>
                            <span className="font-mono text-brand-pink">{cor.estoque}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Info and Actions Area */}
                <div className="p-5 pt-3 space-y-4">

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
                              {p.estoque} {p.estoque === 1 || p.estoque === -1 ? 'unidade' : 'unidades'}
                            </span>
                            <span className={`h-2.5 w-2.5 rounded-full ${p.estoque <= 0 ? 'bg-red-500' : p.estoque < 10 ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ☑️ CONFERÊNCIA DE ESTOQUE FÍSICO */}
                  {onUpdateProduct && (
                    <button
                      type="button"
                      onClick={() => handleToggleConferido(p)}
                      className={`w-full py-2 px-3 rounded-xl border flex items-center justify-between transition-all active:scale-[0.98] text-xs cursor-pointer ${
                        p.conferido 
                          ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-950/35'
                          : 'bg-zinc-900/35 border-zinc-850 text-zinc-400 hover:bg-zinc-900/65 hover:text-zinc-300'
                      }`}
                      title="Sinalizar que a contagem do estoque na loja bate com o app"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`h-4.5 w-4.5 rounded-md border flex items-center justify-center transition-all shrink-0 ${
                          p.conferido
                            ? 'bg-emerald-500 border-emerald-400 text-black shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                            : 'border-zinc-700 bg-black'
                        }`}>
                          {p.conferido && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </div>
                        <span className="font-bold">Quantidade Conferida</span>
                      </div>
                      {p.conferido ? (
                        <span className="text-[9px] bg-emerald-500/15 border border-emerald-400/20 px-2 py-0.5 rounded text-emerald-400 font-extrabold uppercase tracking-widest animate-pulse">
                          OK!
                        </span>
                      ) : (
                        <span className="text-[9px] text-zinc-550 font-medium">Pendente</span>
                      )}
                    </button>
                  )}

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
                          <div className="space-y-1">
                            <input
                              type="text"
                              style={{ WebkitTextSecurity: 'disc', MozTextSecurity: 'disc' } as React.CSSProperties}
                              autoComplete="new-password"
                              placeholder="Digite a senha de exclusão"
                              value={deletePassword}
                              onChange={(e) => {
                                setDeletePassword(e.target.value);
                                setDeleteError(false);
                              }}
                              className="w-full px-2.5 py-1.5 bg-black border border-red-900/40 rounded-lg text-zinc-150 text-xs placeholder-zinc-650 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-550/30 transition-all"
                            />
                            {deleteError && (
                              <p className="text-[10px] font-bold text-red-400">Senha incorreta!</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                if (deletePassword === '69apagar69') {
                                  handleAddToDeletedHistory(p);
                                  onDeleteProduct(p.id);
                                  setProductToDelete(null);
                                  setDeletePassword('');
                                  setDeleteError(false);
                                } else {
                                  setDeleteError(true);
                                }
                              }}
                              className="flex-1 py-1 px-2.5 bg-red-650 hover:bg-red-700 text-white rounded-md text-xs font-semibold shadow-xs select-none cursor-pointer"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => {
                                setProductToDelete(null);
                                setDeletePassword('');
                                setDeleteError(false);
                              }}
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
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1.5 gap-2">
                    <label className="block text-sm font-medium text-zinc-300">
                      Estoque Atual <span className="text-brand-pink font-bold">*</span>
                    </label>
                    <div className="flex gap-4">
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
                      <label className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={editAdicional}
                          onChange={(e) => setEditAdicional(e.target.checked)}
                          className="rounded border-emerald-500 text-emerald-500 focus:ring-0 accent-emerald-500 h-3.5 w-3.5 cursor-pointer bg-black"
                        />
                        <span>Produto Adicional</span>
                      </label>
                    </div>
                  </div>
                  <input
                    type="number"
                    disabled={editEstoqueInfinito || editCores.length > 0}
                    min="0"
                    step="1"
                    placeholder={editEstoqueInfinito ? "Sem limites (Estoque Infinito)" : (editCores.length > 0 ? "Estoque calculado pelas cores" : "Ex: 50")}
                    value={editEstoqueInfinito ? "" : (editCores.length > 0 ? editCores.reduce((sum, c) => sum + c.estoque, 0) : editEstoque)}
                    onChange={(e) => setEditEstoque(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="w-full px-4 py-2.5 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink transition-colors text-zinc-100 placeholder-zinc-650 text-sm disabled:opacity-50 disabled:text-zinc-500"
                  />
                </div>
              </div>

              {/* Edit Color stock sub-form */}
              {!editEstoqueInfinito && (
                <div className="bg-zinc-950/60 p-4 border border-zinc-850 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-2">
                    <Palette className="h-4 w-4 text-brand-pink" />
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                      Editar Opções de Cores no Estoque (Opcional)
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Personalize as cores e suas respectivas quantidades em estoque. Ao salvar, o estoque geral do produto será recalculado baseado no total das cores.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="Ex Nome da cor: Vermelho, Azul, Transparente"
                      value={editNovaCorNome}
                      onChange={(e) => setEditNovaCorNome(e.target.value)}
                      className="flex-1 px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-brand-pink/50"
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Qtd em estoque"
                      value={editNovaCorEstoque}
                      onChange={(e) => setEditNovaCorEstoque(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                      className="w-full sm:w-28 px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-brand-pink/50"
                    />
                    <button
                      type="button"
                      onClick={handleEditAddCor}
                      className="px-4 py-2 bg-zinc-800 hover:bg-zinc-755 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-zinc-750"
                    >
                      <Plus className="h-3.5 w-3.5 text-brand-pink" />
                      <span>Adicionar</span>
                    </button>
                  </div>

                  {editCores.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {editCores.map((cor, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 shadow-sm"
                        >
                          <span className="w-2 h-2 rounded-full bg-brand-pink" />
                          <span className="font-semibold">{cor.nome}:</span>
                          <span className="font-mono text-zinc-400 font-bold">{cor.estoque} un</span>
                          <button
                            type="button"
                            onClick={() => handleEditRemoveCor(index)}
                            className="ml-1 text-zinc-500 hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Custom Urgency Deadline input in Editing Modal */}
              <div className="bg-zinc-950/40 p-4 border border-zinc-850 p-4 rounded-xl space-y-3 text-left">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-500 uppercase tracking-wider select-none font-sans">
                  <span>⚡ Alerta de Prazo de Urgência (Aviso Antecipado)</span>
                </div>
                <p className="text-[10.5px] text-zinc-400 leading-snug font-sans">
                  Configure com quantos dias de antecedência do agendamento o pedido contendo este item deve acender em vermelho. Se vazio, o padrão de <strong className="text-zinc-200">3 dias</strong> será mantido.
                </p>
                <div className="relative max-w-xs">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    placeholder="Padrão: 3 dias (Ex: Bolsa 10, Copo 3)"
                    value={editPrazoUrgencia}
                    onChange={(e) => setEditPrazoUrgencia(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    className="w-full px-4 py-2.5 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors text-zinc-100 placeholder-zinc-650 text-xs font-semibold"
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
