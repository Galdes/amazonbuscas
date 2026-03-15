# Configuração da API do Amazon Associates

## Credenciais Necessárias

Para usar a integração com a Amazon Product Advertising API, você precisa adicionar as seguintes variáveis no arquivo `.env.local`:

```env
# Amazon Product Advertising API
AMAZON_ACCESS_KEY=AKPA1QTCWL1768325410
AMAZON_SECRET_KEY=v1vO/Y9xARqmE2DSmTbokzXJ4vyK1M62rZ9EDd/s
```

## Como Funciona

1. **Credenciais no Backend**: As credenciais ficam seguras no servidor (não são expostas no frontend)
2. **Seleção de Associate Tag**: Ao gerar um artigo, você pode selecionar qual Associate Tag usar
3. **Busca Automática**: O sistema busca produtos mencionados no artigo na Amazon
4. **Links de Afiliados**: Links de afiliados são adicionados automaticamente no HTML gerado

## Uso

1. Abra o gerador de artigos
2. Antes de iniciar a geração, preencha o campo "Amazon Associate Tag"
3. Você pode salvar múltiplas tags para uso futuro
4. Ao gerar o artigo, os produtos mencionados terão links de afiliados automaticamente

## Notas Importantes

- As credenciais são armazenadas apenas no servidor (`.env.local`)
- A Secret Key nunca é exposta no frontend
- Rate limits: A API tem limites de requisições (delay de 500ms entre buscas)
- Se a busca falhar, o artigo ainda é gerado normalmente (sem links)
