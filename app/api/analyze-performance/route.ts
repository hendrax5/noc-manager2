import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";
import { getAppConfig } from "@/lib/config";

interface MetricParams {
  finalScore: number;
  resolvedCount: number;
  totalInvolvedCount: number;
  totalComments: number;
}

interface UserDataPayload {
  user: {
    name: string;
    department: string;
  };
  metrics: MetricParams;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const usersData = body.usersData as UserDataPayload[];
    
    if (!usersData || !Array.isArray(usersData) || usersData.length === 0) {
      return NextResponse.json({ error: "Data pengguna tidak valid" }, { status: 400 });
    }

    const config = getAppConfig();
    const resolvedApiKey = process.env.GEMINI_API_KEY || config.geminiApiKey;

    if (!resolvedApiKey) {
      return NextResponse.json({ 
        analysis: "MOHON PERHATIAN: Admin belum mengkonfigurasi Gemini API Key di menu Settings > Team Preferences. Fitur AI saat ini belum dapat digunakan." 
      });
    }

    const genAI = new GoogleGenerativeAI(resolvedApiKey);

    // Buat rangkuman string untuk Gemini agar tidak kebesaran payload (hanya ambil data esensial)
    const summarizedData = usersData.map(u => ({
      name: u.user.name,
      department: u.user.department,
      score: u.metrics.finalScore,
      resolved: u.metrics.resolvedCount,
      involved: u.metrics.totalInvolvedCount,
      comments: u.metrics.totalComments
    }));

    const prompt = `Anda adalah analis performa tim NOC yang cerdas dan suportif. 
Tugas Anda adalah membandingkan performa anggota tim berdasarkan data berikut:
${JSON.stringify(summarizedData)}

Buatlah analisa deskriptif singkat (maksimal 2 paragraf padat).
Jelaskan KENAPA seseorang (yang skornya tertinggi) bisa memiliki skor kumulatif yang paling tinggi jika dilihat dari perbandingan metrik 'resolved', 'involved', dan 'comments'-nya terhadap yang lain. 
Soroti juga kontribusi anggota lainnya secara positif.
Gunakan nada profesional namun santai (menggunakan bahasa Indonesia). Jangan tampilkan format JSON di output, cukup teks narasinya.`;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return NextResponse.json({ analysis: text });
  } catch (error: any) {
    console.error("Gemini Error:", error);
    return NextResponse.json({ error: "Gagal menghasilkan analisa. Pastikan API key valid." }, { status: 500 });
  }
}
