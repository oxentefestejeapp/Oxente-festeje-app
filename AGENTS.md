# Diretrizes de Desenvolvimento - Oxente Festeje

Este arquivo contém instruções de persistência para agentes de IA que desenvolverem ou alterarem o código desta aplicação. Adira sempre a estas regras.

## ⚡ Otimização e Compressão de Imagens (Crucial para Performance)

Para garantir que a página carregue instantaneamente e mantenha uma pontuação excelente de performance móvel, siga sempre estas regras ao adicionar ou modificar imagens:

1. **Use o Componente `OptimizedImage`**:
   Sempre que renderizar uma imagem externa ou interna no aplicativo (como no mural, banners, ou produtos), utilize o componente customizado localizado em `/src/utils/imageOptimizer.tsx` em vez da tag padrão `<img>`.

   *Exemplo de uso:*
   ```tsx
   import { OptimizedImage } from '../utils/imageOptimizer';

   <OptimizedImage
     src={imagemUrl}
     alt="Descrição"
     width={400}      // Defina a largura ideal para o contêiner
     quality={70}     // Qualidade recomendada de 70% (ou 60% para fundos)
     className="w-full h-full object-cover"
   />
   ```

2. **Otimização de URLs da Unsplash**:
   Se a imagem for proveniente do Unsplash, o utilitário `optimizeImageUrl` é automaticamente chamado pelo `OptimizedImage` para injetar os parâmetros corretos (`fm=webp`, `q=70`, `w=400`). Nunca carregue imagens brutas ou sem dimensões apropriadas.

3. **Formatos Recomendados para Arquivos Locais**:
   Ao adicionar novas fotos reais na pasta `/public` ou `/src/assets`:
   - **Formato**: Converta-as sempre para o formato **WebP** antes de usá-las (este formato reduz o peso em até 80% comparado a PNG/JPG sem perder qualidade visível).
   - **Resolução**: Não utilize imagens com mais de 1200px de largura se forem banners, ou mais de 600px se forem produtos ou fotos do mural.
   - **Ferramentas sugeridas para o usuário**: Utilize ferramentas gratuitas online como [TinyPNG](https://tinypng.com/) ou [Squoosh](https://squoosh.app/) para comprimir fotos reais antes de subi-las.
