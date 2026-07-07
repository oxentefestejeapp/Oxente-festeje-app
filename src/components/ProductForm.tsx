/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, X, Sparkles, AlertCircle, ShoppingBag, Plus, Trash2, Layers, Loader2, Palette } from 'lucide-react';
import { Product, PricingTier, ProductColor } from '../types';
import { getFormattedSupabaseError } from '../lib/supabase';

interface ProductFormProps {
  onAddProduct: (product: Product) => Promise<boolean> | void;
}

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

export function ProductForm({ onAddProduct }: ProductFormProps) {
  const [nome, setNome] = useState('');
  const [precoCusto, setPrecoCusto] = useState<number | ''>('');
  const [precoVenda, setPrecoVenda] = useState<number | ''>('');
  const [estoque, setEstoque] = useState<number | ''>('');
  const [estoqueInfinito, setEstoqueInfinito] = useState(false);
  const [adicional, setAdicional] = useState(false);
  const [photo, setPhoto] = useState<string>(''); // Base64 Data URL
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isCompressing, setIsCompressing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [prazoUrgencia, setPrazoUrgencia] = useState<number | ''>('');
  
  // Progressive Pricing Tiers State
  const [faixasPreco, setFaixasPreco] = useState<PricingTier[]>([]);
  const [novaQuantidadeMinima, setNovaQuantidadeMinima] = useState<number | ''>('');
  const [novoPrecoFaixa, setNovoPrecoFaixa] = useState<number | ''>('');

  // Color Options State
  const [cores, setCores] = useState<ProductColor[]>([]);
  const [novaCorNome, setNovaCorNome] = useState('');
  const [novaCorEstoque, setNovaCorEstoque] = useState<number | ''>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compress and convert file to Base64
  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione apenas arquivos de imagem.');
      return;
    }

    setIsCompressing(true);
    setError('');
    try {
      const compressedBase64 = await compressImage(file);
      setPhoto(compressedBase64);
    } catch (err: any) {
      console.error('Erro de compressão:', err);
      // Fallback to normal loading if canvas fails
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setPhoto(e.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setIsCompressing(false);
    }
  };

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const removePhoto = () => {
    setPhoto('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAddFaixa = () => {
    if (novaQuantidadeMinima === '' || novoPrecoFaixa === '') {
      setError('Por favor, informe a quantidade mínima e o preço da faixa.');
      return;
    }
    const qMin = Number(novaQuantidadeMinima);
    const pFaixa = Number(novoPrecoFaixa);
    if (isNaN(qMin) || qMin <= 0) {
      setError('A quantidade mínima deve ser maior que zero.');
      return;
    }
    if (isNaN(pFaixa) || pFaixa <= 0) {
      setError('O preço para a faixa deve ser maior que zero.');
      return;
    }
    
    if (faixasPreco.some(f => f.quantidadeMinima === qMin)) {
      setError(`Já existe um valor configurado para a quantidade mínima de ${qMin}.`);
      return;
    }

    const updated = [...faixasPreco, { quantidadeMinima: qMin, preco: pFaixa }]
      .sort((a, b) => a.quantidadeMinima - b.quantidadeMinima);

    setFaixasPreco(updated);
    setNovaQuantidadeMinima('');
    setNovoPrecoFaixa('');
    setError('');
  };

  const handleRemoveFaixa = (index: number) => {
    const updated = faixasPreco.filter((_, i) => i !== index);
    setFaixasPreco(updated);
  };

  const handleAddCor = () => {
    if (!novaCorNome.trim()) {
      setError('Por favor, digite o nome da cor.');
      return;
    }
    if (novaCorEstoque === '') {
      setError('Por favor, informe a quantidade para a cor.');
      return;
    }
    const qty = Number(novaCorEstoque);
    if (isNaN(qty) || qty < 0) {
      setError('A quantidade da cor deve ser maior ou igual a zero.');
      return;
    }

    if (cores.some(c => c.nome.toLowerCase() === novaCorNome.trim().toLowerCase())) {
      setError(`A cor "${novaCorNome.trim()}" já foi adicionada.`);
      return;
    }

    setCores([...cores, { nome: novaCorNome.trim(), estoque: Math.floor(qty) }]);
    setNovaCorNome('');
    setNovaCorEstoque('');
    setError('');
  };

  const handleRemoveCor = (index: number) => {
    const updated = cores.filter((_, i) => i !== index);
    setCores(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || isCompressing) return;

    setError('');
    setSuccess('');

    if (!nome.trim()) {
      setError('O nome do produto é obrigatório.');
      return;
    }

    let precoNum = 0;
    if (adicional) {
      if (precoVenda === '') {
        setError('O preço de venda é obrigatório para produtos adicionais.');
        return;
      }
      precoNum = Number(precoVenda);
      if (isNaN(precoNum) || precoNum < 0) {
        setError('Digite um preço de venda válido.');
        return;
      }
    }

    const precoCustoNum = precoCusto !== '' ? Number(precoCusto) : undefined;
    if (precoCustoNum !== undefined && (isNaN(precoCustoNum) || precoCustoNum < 0)) {
      setError('Digite um preço de custo válido.');
      return;
    }

    let estoqueNum = estoqueInfinito ? 0 : Number(estoque);
    if (cores.length > 0 && !estoqueInfinito) {
      estoqueNum = cores.reduce((sum, c) => sum + c.estoque, 0);
    }

    if (!estoqueInfinito && cores.length === 0 && (estoque === '' || isNaN(estoqueNum) || estoqueNum < 0)) {
      setError('O estoque inicial precisa ser maior ou igual a zero.');
      return;
    }

    const prazoUrgenciaNum = prazoUrgencia !== '' ? Number(prazoUrgencia) : undefined;
    if (prazoUrgenciaNum !== undefined && (isNaN(prazoUrgenciaNum) || prazoUrgenciaNum < 1)) {
      setError('O prazo de urgência deve ser de pelo menos 1 dia.');
      return;
    }

    const newProduct: Product = {
      id: `prod-${Date.now()}`,
      nome: nome.trim(),
      preco: precoNum,
      precoCusto: precoCustoNum,
      estoque: Math.floor(estoqueNum),
      cores: cores.length > 0 ? cores : undefined,
      imagemBase64: photo || undefined,
      estoqueInfinito: estoqueInfinito || undefined,
      adicional: adicional || undefined,
      faixasPreco: faixasPreco.length > 0 ? faixasPreco : undefined,
      prazoUrgencia: prazoUrgenciaNum,
    };

    setIsSaving(true);
    try {
      // Execute the product registration
      const result = await onAddProduct(newProduct);
      
      // If the parent handleAddProduct returns undefined, we treat it as success, 
      // but if we update it to return boolean we check the boolean value.
      if (result === false) {
        setError(`O produto foi registrado localmente no seu dispositivo, mas não pôde ser salvo no banco de dados em nuvem do Supabase. Detalhe do Erro: ${getFormattedSupabaseError('Sincronização pendente.')}`);
      } else {
        setSuccess(`"${newProduct.nome}" cadastrado com sucesso no sistema e sincronizado com a nuvem!`);
        setNome('');
        setPrecoCusto('');
        setPrecoVenda('');
        setEstoque('');
        setEstoqueInfinito(false);
        setAdicional(false);
        setPhoto('');
        setFaixasPreco([]);
        setNovaQuantidadeMinima('');
        setNovoPrecoFaixa('');
        setPrazoUrgencia('');
        setCores([]);
        setNovaCorNome('');
        setNovaCorEstoque('');
        
        setTimeout(() => {
          setSuccess('');
        }, 4000);
      }
    } catch (err: any) {
      console.error('Erro ao adicionar produto:', err);
      setError(`Falha ao registrar produto na nuvem: ${getFormattedSupabaseError(err?.message || String(err))}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-zinc-900 rounded-2xl border border-zinc-800/80 p-6 shadow-lg max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <div className="p-2 bg-brand-pink/10 border border-brand-pink/20 rounded-lg text-brand-pink">
          <ShoppingBag className="h-5 w-5" />
        </div>
        <h2 className="font-display font-semibold text-xl text-zinc-100">Adicionar Novo Brinde / Brinco</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        
        {/* Alerts */}
        {error && (
          <div className="p-4 bg-red-950/30 border-l-4 border-red-650 rounded-r-xl flex items-start gap-2.5 text-red-300 text-sm animate-fade-in">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-950/30 border-l-4 border-emerald-650 rounded-r-xl flex items-start gap-2.5 text-emerald-300 text-sm animate-fade-in">
            <Sparkles className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Product Name */}
        <div>
          <label htmlFor="product-name" className="block text-sm font-medium text-zinc-300 mb-1.5">
            Nome do Produto <span className="text-brand-pink font-bold">*</span>
          </label>
          <input
            id="product-name"
            type="text"
            placeholder="Ex: Caneca Porcelana, Brinco Acrílico, Chaveiro Personalizado"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="w-full px-4 py-2.5 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink transition-colors text-zinc-100 placeholder-zinc-600 text-sm"
          />
        </div>

        {/* Price and Stock Row */}
        <div className={`grid grid-cols-1 ${adicional ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 transition-all duration-300`}>
          <div className="md:col-span-1">
            <label htmlFor="product-cost-price" className="block text-sm font-medium text-zinc-300 mb-1.5">
              Preço de Custo <span className="text-zinc-500 text-xs font-normal">(Margem)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-zinc-500 font-medium text-xs">R$</span>
              <input
                id="product-cost-price"
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={precoCusto}
                onChange={(e) => setPrecoCusto(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="w-full pl-8 pr-3 py-2.5 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink transition-colors text-zinc-100 placeholder-zinc-650 text-xs"
              />
            </div>
          </div>

          {adicional && (
            <div className="md:col-span-1 animate-fade-in">
              <label htmlFor="product-sale-price" className="block text-sm font-medium text-emerald-450 mb-1.5">
                Preço de Venda <span className="text-emerald-500 font-bold">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-emerald-500 font-medium text-xs">R$</span>
                <input
                  id="product-sale-price"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  required
                  value={precoVenda}
                  onChange={(e) => setPrecoVenda(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full pl-8 pr-3 py-2.5 bg-black border border-emerald-900/40 focus:border-emerald-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-colors text-emerald-300 placeholder-emerald-800/50 text-xs font-bold font-mono"
                />
              </div>
            </div>
          )}

          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-1.5 gap-2">
              <label htmlFor="product-stock" className="block text-sm font-medium text-zinc-300">
                Estoque Inicial / Quantidade <span className="text-brand-pink font-bold">*</span>
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-xs text-brand-pink font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={estoqueInfinito}
                    onChange={(e) => {
                      setEstoqueInfinito(e.target.checked);
                      if (e.target.checked) setEstoque('');
                    }}
                    className="rounded border-zinc-800 text-brand-pink focus:ring-0 accent-brand-pink focus:ring-offset-0 h-3.5 w-3.5 cursor-pointer bg-black"
                  />
                  <span>Estoque Infinito</span>
                </label>
                <label className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={adicional}
                    onChange={(e) => setAdicional(e.target.checked)}
                    className="rounded border-emerald-500 text-emerald-500 focus:ring-0 accent-emerald-500 h-3.5 w-3.5 cursor-pointer bg-black"
                  />
                  <span>Produto Adicional</span>
                </label>
              </div>
            </div>
            <input
              id="product-stock"
              type="number"
              disabled={estoqueInfinito || cores.length > 0}
              min="0"
              step="1"
              placeholder={estoqueInfinito ? "Sem limites (Estoque Infinito)" : (cores.length > 0 ? "Estoque calculado pelas cores" : "Ex: 50")}
              value={estoqueInfinito ? "" : (cores.length > 0 ? cores.reduce((sum, c) => sum + c.estoque, 0) : estoque)}
              onChange={(e) => setEstoque(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              className="w-full px-4 py-2.5 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-pink/50 focus:border-brand-pink transition-colors text-zinc-100 placeholder-zinc-650 text-sm disabled:opacity-50 disabled:text-zinc-500 disabled:border-zinc-850"
            />
          </div>
        </div>

        {/* Color stock sub-form */}
        {!estoqueInfinito && (
          <div className="bg-zinc-950/60 p-4 border border-zinc-850 rounded-xl space-y-3">
            <div className="flex items-center gap-2 border-b border-zinc-800/80 pb-2">
              <Palette className="h-4 w-4 text-brand-pink" />
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
                Opções de Cores no Estoque (Opcional)
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 leading-relaxed">
              Adicione cores e suas quantidades específicas para controlar de forma exata. Se adicionar cores aqui, o estoque total do produto será o somatório de todas as cores.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="Ex Nome da cor: Vermelho, Azul, Transparente"
                value={novaCorNome}
                onChange={(e) => setNovaCorNome(e.target.value)}
                className="flex-1 px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-brand-pink/50"
              />
              <input
                type="number"
                min="0"
                placeholder="Qtd em estoque"
                value={novaCorEstoque}
                onChange={(e) => setNovaCorEstoque(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className="w-full sm:w-28 px-3 py-2 bg-black border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-700 focus:outline-none focus:ring-1 focus:ring-brand-pink/50"
              />
              <button
                type="button"
                onClick={handleAddCor}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-750 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-zinc-750"
              >
                <Plus className="h-3.5 w-3.5 text-brand-pink" />
                <span>Adicionar</span>
              </button>
            </div>

            {cores.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {cores.map((cor, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-200 shadow-sm"
                  >
                    <span className="w-2 h-2 rounded-full bg-brand-pink" />
                    <span className="font-semibold">{cor.nome}:</span>
                    <span className="font-mono text-zinc-400 font-bold">{cor.estoque} un</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCor(index)}
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

        {/* Custom Urgency Deadline (Aviso de Urgência) Section */}
        <div className="bg-zinc-950/40 p-4 border border-zinc-800/50 rounded-2xl space-y-3 text-left">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500 uppercase tracking-wider select-none font-sans">
            <span>⚡ Alerta de Prazo de Urgência Personalizado (Aviso Antecipado)</span>
          </div>
          <p className="text-[11px] text-zinc-550 leading-relaxed font-sans">
            Especifique quantos dias antes do agendamento (data de retirada) o pedido com este produto acenderá em vermelho na aba <strong className="text-zinc-200">Aguardando Designer</strong>. Caso fique vazio, o sistema usará o prazo padrão de <strong className="text-zinc-200 font-mono">3 dias</strong>.
          </p>
          <div className="relative max-w-xs">
            <input
              type="number"
              min="1"
              step="1"
              placeholder="Ex: Bolsa 10 dias, Copo 3 dias"
              value={prazoUrgencia}
              onChange={(e) => setPrazoUrgencia(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
              className="w-full px-4 py-2.5 bg-black border border-zinc-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors text-zinc-100 placeholder-zinc-650 text-xs font-medium"
            />
          </div>
        </div>

        {/* Progressive Pricing (Tiers) Form Section */}
        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800/60 space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-2.5">
            <Layers className="h-4 w-4 text-brand-pink" />
            <h3 className="text-xs font-bold tracking-wider uppercase text-zinc-300">
              Preços Progressivos (Kits & Atacado)
            </h3>
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed leading-snug">
            Configure preços diferenciados por quantidade. Se o cliente comprar essa quantidade mínima ou superior, este preço será aplicado automaticamente.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                Qtd Mínima (A partir de)
              </label>
              <input
                type="number"
                min="2"
                placeholder="Ex : 10"
                value={novaQuantidadeMinima}
                onChange={(e) => setNovaQuantidadeMinima(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className="w-full px-3 py-2 bg-black border border-zinc-900 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink/50 text-xs text-zinc-100 placeholder-zinc-700"
              />
            </div>

            <div className="sm:col-span-4">
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                Preço Unitário (R$)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="0,00"
                value={novoPrecoFaixa}
                onChange={(e) => setNovoPrecoFaixa(e.target.value === '' ? '' : parseFloat(e.target.value))}
                className="w-full px-3 py-2 bg-black border border-zinc-900 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-pink/50 text-xs text-zinc-100 placeholder-zinc-700"
              />
            </div>

            <div className="sm:col-span-3">
              <button
                type="button"
                onClick={handleAddFaixa}
                className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-brand-pink hover:text-zinc-100 text-xs font-bold rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer border border-zinc-700/50"
              >
                <Plus className="h-3 w-3" />
                <span>Adicionar</span>
              </button>
            </div>
          </div>

          {/* List existing pricing tiers, sorted ascendingly */}
          {faixasPreco.length > 0 ? (
            <div className="mt-3 space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {faixasPreco.map((faixa, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-3 py-1.5 bg-black border border-zinc-900 rounded-lg text-xs"
                >
                  <div className="flex items-center gap-2 text-zinc-300">
                    <span className="h-1.5 w-1.5 bg-brand-pink rounded-full" />
                    <span>A partir de <strong>{faixa.quantidadeMinima}</strong> itens:</span>
                    <span className="font-mono font-bold text-brand-pink">R$ {faixa.preco.toFixed(2)} /un</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveFaixa(i)}
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
              Nenhum preço progressivo adicionado. (O produto terá apenas o preço de venda padrão acima)
            </div>
          )}
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full flex items-center justify-center gap-2 py-3 bg-brand-pink hover:bg-brand-pink-hover text-black font-bold rounded-xl shadow-md hover:shadow-lg transition-all transform active:scale-98 cursor-pointer mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Sincronizando com Supabase...</span>
            </>
          ) : (
            <>
              <Plus className="h-5 w-5" />
              <span>Salvar no Sistema</span>
            </>
          )}
        </button>

      </form>
    </div>
  );
}
