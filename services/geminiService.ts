import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY; 
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const generateMedicineDescription = async (medicineName: string): Promise<string> => {
  const ai = getClient();
  if (!ai) {
    return "API Key not configured. Please add your Gemini API Key.";
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Write a short, professional medical description for a medicine named "${medicineName}". Include common uses and standard precautions. Keep it under 50 words.`,
    });
    return response.text || "No description generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Failed to generate description. Please try again.";
  }
};

export const analyzeSalesTrends = async (salesData: string): Promise<string> => {
  const ai = getClient();
  if (!ai) return "AI Service Unavailable";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analyze this sales data JSON and give 3 bullet points on performance and restocking advice: ${salesData}`,
    });
    return response.text || "No analysis available.";
  } catch (error) {
    return "Failed to analyze sales.";
  }
};
