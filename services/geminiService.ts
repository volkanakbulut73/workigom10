import { GoogleGenAI } from "@google/genai";
import { Voucher } from "../types";

const initAI = () => {
  if (!process.env.API_KEY) {
    console.warn("API_KEY is not set in environment variables.");
    return null;
  }
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Helper to convert File to Base64 for AI processing
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export const analyzeDealWithGemini = async (voucher: Voucher): Promise<string> => {
  const ai = initAI();
  if (!ai) {
    return "API anahtarı eksik olduğu için analiz yapılamıyor.";
  }

  const prompt = `
    Aşağıdaki yemek çeki teklifini bir alıcı gözüyle analiz et.
    Piyasa koşullarında yemek çekleri genellikle %10 ila %20 indirimle nakite çevrilir.
    
    Çek Bilgileri:
    Firma: ${voucher.company}
    Kart Bakiyesi: ${voucher.amount} TL
    Satış Fiyatı: ${voucher.price} TL
    Son Kullanma Tarihi: ${voucher.expiryDate}
    Konum: ${voucher.location}

    Lütfen kısa, samimi ve Türkçe bir tavsiye ver. 
    Bu iyi bir fırsat mı? Riskler neler olabilir? (Örn: Son kullanma tarihi yakın mı?)
    Cevabın 2-3 cümleyi geçmesin.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });

    return response.text || "Analiz şu anda yapılamadı.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Yapay zeka servisine bağlanırken bir hata oluştu.";
  }
};

export const generateSwapDescription = async (title: string, price: number, file?: File): Promise<string> => {
  const ai = initAI();
  if (!ai) return "API anahtarı eksik.";

  try {
      const parts: any[] = [];
      
      // Add image if available
      if (file) {
          const base64Str = await fileToBase64(file);
          // Extract base64 data from data URL
          const match = base64Str.match(/^data:(.+);base64,(.+)$/);
          if (match) {
              parts.push({
                  inlineData: {
                      mimeType: match[1],
                      data: match[2]
                  }
              });
          }
      }

      const prompt = `
          "Workigom" adlı yemek kartı takas platformunda listelenecek bir ürün için satış açıklaması yaz.
          
          Ürün Bilgileri:
          Başlık: ${title}
          Fiyat: ${price} TL (Yemek Kartı Bakiyesi Karşılığı)
          
          GÖREV:
          Kısa, samimi, satış odaklı ve Türkçe bir açıklama oluştur.
          Özellikle alıcıların Sodexo, Multinet, Ticket gibi yemek kartı bakiyeleriyle ödeme yapabileceğini cazip bir şekilde vurgula.
          Emojiler kullan.
          Maksimum 400 karakter olsun.
      `;
      
      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: { parts },
          config: {
            thinkingConfig: { thinkingBudget: 0 }
          }
      });

      return response.text || "Açıklama üretilemedi.";
  } catch (error) {
      console.error("Gemini Description Gen Error:", error);
      return "Yapay zeka şu an meşgul, lütfen manuel yazın.";
  }
};