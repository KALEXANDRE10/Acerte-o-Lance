
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { VehicleInfo } from "../types";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Extração de alta fidelidade para leilões brasileiros com mecanismo de retry.
 */
export const getCompleteVehicleData = async (url: string, retries = 3): Promise<Partial<VehicleInfo & { sourceSite: string, searchSources?: any[] }>> => {
  if (!url || !url.startsWith('http')) {
    throw new Error("URL inválida. Certifique-se de que o link começa com http ou https.");
  }

  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  
  if (!apiKey) {
    throw new Error("API_KEY_MISSING");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = 'gemini-3-flash-preview';

  // Pequeno delay inicial para evitar picos de cota se o usuário colar vários links
  await sleep(1000);

  const extractionPrompt = `
    VOCÊ É UM ESPECIALISTA EM LEILÕES DE VEÍCULOS NO BRASIL.
    
    URL DO LOTE: ${url}.
    
    OBJETIVO: Extrair os dados técnicos do veículo da URL fornecida e buscar o valor da Tabela FIPE correspondente.
    
    REGRAS DE EXTRAÇÃO (MANDATÓRIAS - ALTA PRECISÃO):
    1. ACESSO À URL: Use a ferramenta urlContext para acessar o conteúdo da URL ${url}.
    2. IDENTIFICAÇÃO DO VEÍCULO: Analise todo o conteúdo da página. 
       - Marca, Modelo e Versão (ex: Ford Fiesta 1.6 SE). Ignore veículos sugeridos ou lotes vizinhos.
       - Ano de Fabricação e Ano do Modelo (ex: 2016/2017).
       - Quilometragem (KM) - procure por "KM", "Quilometragem", "Odometer" ou "Odômetro".
       - ID do Lote ou Número do Lote.
       - PÁTIO/LOCALIZAÇÃO: Identifique o local onde o veículo se encontra (Pátio, Cidade/Estado). No Copart, procure por "Yard" ou "Pátio".
       - Se os dados não estiverem no título, procure em tabelas de "Dados do Lote", "Descrição" ou "Ficha Técnica".
    
    3. ARQUITETURA DOS SITES:
       - SODRÉ SANTORO: Procure em "Descrição do Lote" ou "Ficha Técnica". O Pátio costuma estar no cabeçalho ou dados do lote.
       - FREITAS LEILOEIRO: Procure na tabela "Dados do Lote".
       - MILAN LEILÕES: Procure na tabela "Dados do Lote" ou "Descrição". IGNORE COMPLETAMENTE a seção de "Lotes Relacionados", "Próximos Lotes" ou "Sugestões" no final da página, que costumam listar outros bancos. Foque apenas no veículo do Lote ${url.split('/').pop()}.
       - GUARIGLIA: Procure em "Informações do Lote".
       - COPART: Procure em "Lot Details" ou "Informações do Veículo". O Pátio é o "Yard".
    
    4. TABELA FIPE: Use o Google Search para encontrar o valor da Tabela FIPE atual para este veículo exato (marca, modelo, motorização e ano do modelo).
    
    5. RESUMO E ATENÇÃO: Extraia pontos críticos (débitos, motor travado, sinistro, falta de peças).
    
    IMPORTANTE: Retorne APENAS o JSON. Não inclua texto antes ou depois. Se não conseguir acessar a URL, use o Google Search para encontrar informações sobre este lote específico.
  `;

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: extractionPrompt,
        config: {
          tools: [
            { googleSearch: {} },
            { urlContext: {} }
          ],
          thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              brand: { type: Type.STRING },
              model: { type: Type.STRING },
              year: { type: Type.STRING },
              km: { type: Type.NUMBER },
              auctionDate: { type: Type.STRING },
              lotId: { type: Type.STRING },
              patio: { type: Type.STRING },
              description: { type: Type.STRING },
              sourceSite: { type: Type.STRING },
              fipeValue: { type: Type.NUMBER },
              auctionSummary: { type: Type.STRING },
              pointsOfAttention: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING }
              }
            },
            required: ["brand", "model", "year", "fipeValue"]
          }
        }
      });

      let text = "";
      try {
        text = response.text || "";
      } catch (e) {
        const candidate = response.candidates?.[0];
        const part = candidate?.content?.parts?.find(p => p.text);
        text = part?.text || "";
      }

      text = text.trim();
      
      // Limpeza de possíveis blocos de código markdown se o responseMimeType falhar
      if (text.startsWith("```")) {
        text = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");
      }
      
      if (!text) throw new Error("A IA retornou uma resposta vazia.");
      
      const data = JSON.parse(text);
      
      // Validação mínima dos dados obrigatórios
      if (!data.brand || !data.model || !data.fipeValue) {
        throw new Error("Dados incompletos retornados pela IA.");
      }

      const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      
      return {
        ...data,
        searchSources: sources
      };
    } catch (error: any) {
      const errorMsg = error.message || "";
      const isQuotaError = 
        errorMsg.includes("429") || 
        errorMsg.includes("RESOURCE_EXHAUSTED") || 
        errorMsg.includes("quota");

      if (isQuotaError && i < retries) {
        const waitTime = (i + 1) * 10000; // Aumentado para 10s, 20s, 30s
        console.warn(`Cota excedida. Tentativa ${i+1}/${retries}. Aguardando ${waitTime/1000}s...`);
        await sleep(waitTime);
        continue;
      }

      if (isQuotaError) {
        throw new Error("QUOTA_EXCEEDED");
      }
      
      console.error(`Erro na extração (Tentativa ${i+1}):`, error);
      
      if (i === retries) {
        throw new Error("Não conseguimos processar este link. Pode ser que o site esteja bloqueando o acesso ou os dados não estejam claros. Tente outro lote.");
      }
      
      await sleep(2000); // Pequena pausa antes de tentar novamente em erros genéricos
    }
  }
  throw new Error("Falha total na extração.");
};
